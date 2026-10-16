<template>
  <div class="cast-inner">
    <div class="queue-header">
      <span class="queue-title"><CastIcon :size="16" />投屏到 DLNA</span>
      <div class="queue-header-actions">
        <button class="btn-ghost btn-sm" type="button" :disabled="loading" @click="search(true)">
          {{ loading ? '搜索中…' : '重新搜索' }}
        </button>
        <button
          v-if="castingUdn"
          class="btn-ghost btn-sm"
          type="button"
          @click="stopCast"
        >停止</button>
        <button class="btn-icon" type="button" @click="emit('close')">×</button>
      </div>
    </div>
    <p class="cast-tip">把正在播放的歌曲投到局域网电视 / 音箱。Docker 需 host 网络才能搜到设备。</p>
    <p v-if="error" class="cast-err">{{ error }}</p>
    <p v-if="hint" class="cast-ok">{{ hint }}</p>
    <div v-if="loading && !devices.length" class="cast-empty">正在搜索设备…</div>
    <div v-else-if="!devices.length" class="cast-empty">未发现设备。请确认与电视同一局域网。</div>
    <div v-else class="queue-list">
      <button
        v-for="d in devices"
        :key="d.udn"
        type="button"
        class="queue-item dev-row"
        :class="{ active: castingUdn === d.udn }"
        :disabled="playingUdn === d.udn"
        @click="castTo(d)"
      >
        <span class="queue-name">{{ d.name }}</span>
        <em>{{ playingUdn === d.udn ? '投送中…' : (castingUdn === d.udn ? '投送中' : '投送') }}</em>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { currentPlaying, currentLocalTrackPath, currentPlayPlatform, currentPlayQuality, getPlayQuality } from '../stores/player.js'
import { buildPlayPayload } from '../utils/musicPayload.js'
import CastIcon from './CastIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const devices = ref([])
const loading = ref(false)
const error = ref('')
const hint = ref('')
const playingUdn = ref('')
const castingUdn = ref('')

async function search(refresh = false) {
  loading.value = true
  error.value = ''
  try {
    const res = await api.dlna.devices(refresh)
    devices.value = res.data || []
  } catch (e) {
    error.value = e.message || '搜索失败'
  } finally {
    loading.value = false
  }
}

async function castTo(device) {
  const t = currentPlaying.value
  if (!t) {
    error.value = '当前没有正在播放的内容'
    return
  }
  const source = t.podcastEpisodeId || t.source === 'podcast'
    ? 'podcast'
    : (currentPlayPlatform.value || t.source || '')
  const quality = currentPlayQuality.value || getPlayQuality() || '128k'
  const rawId = String(t.id || t.trackId || '')
  const trackId = currentLocalTrackPath.value && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : ''
  const episodeId = t.podcastEpisodeId || (t.source === 'podcast' ? t.id : '')
  playingUdn.value = device.udn
  error.value = ''
  hint.value = ''
  try {
    await api.dlna.play({
      udn: device.udn,
      ...buildPlayPayload(t, source, quality),
      trackId: trackId || undefined,
      localPath: currentLocalTrackPath.value || undefined,
      podcastEpisodeId: episodeId || undefined,
      name: t.name,
      singer: t.singer,
      album: t.album || t.albumName,
    })
    castingUdn.value = device.udn
    hint.value = `已投送到 ${device.name}`
  } catch (e) {
    error.value = e.message || '投送失败'
  } finally {
    playingUdn.value = ''
  }
}

async function stopCast() {
  if (!castingUdn.value) return
  try {
    await api.dlna.stop(castingUdn.value)
    hint.value = '已停止投屏'
    castingUdn.value = ''
  } catch (e) {
    error.value = e.message || '停止失败'
  }
}

watch(() => props.open, (v) => {
  if (v) search(true)
}, { immediate: true })
</script>

<style scoped>
.cast-inner {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: inherit;
}
.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-elevated);
  gap: 8px;
  flex-shrink: 0;
}
.queue-title {
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.queue-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.btn-icon {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  padding: 0 4px;
  line-height: 1;
  cursor: pointer;
}
.btn-icon:hover { color: var(--text); }
.cast-tip, .cast-empty {
  margin: 0;
  padding: 10px 14px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
.cast-err, .cast-ok {
  margin: 0;
  padding: 0 14px 8px;
  font-size: 12px;
}
.cast-err { color: var(--danger, #ef4444); }
.cast-ok { color: var(--accent); }
.queue-list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.dev-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--border-light);
  background: transparent;
  color: inherit;
  padding: 10px 14px;
  cursor: pointer;
  border-radius: 0;
  text-align: left;
}
.dev-row:hover { background: var(--bg-hover); }
.dev-row.active { background: var(--accent-muted); }
.dev-row:disabled { opacity: 0.7; cursor: wait; }
.queue-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dev-row em { font-style: normal; color: var(--accent); font-size: 12px; flex-shrink: 0; }
</style>
