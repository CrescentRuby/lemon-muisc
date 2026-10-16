<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="cast-modal card">
      <header class="cast-head">
        <h3>投屏到 DLNA</h3>
        <button type="button" class="btn-icon" @click="emit('close')">×</button>
      </header>
      <p class="cast-tip">把正在播放的本地歌曲或播客投到局域网电视 / 音箱。Docker 需 host 网络才能搜索到设备。</p>
      <div class="cast-toolbar">
        <button class="btn-ghost btn-sm" type="button" :disabled="loading" @click="search(true)">
          {{ loading ? '搜索中…' : '重新搜索' }}
        </button>
        <button
          v-if="castingUdn"
          class="btn-ghost btn-sm"
          type="button"
          @click="stopCast"
        >停止投屏</button>
      </div>
      <p v-if="error" class="cast-err">{{ error }}</p>
      <p v-if="hint" class="cast-ok">{{ hint }}</p>
      <div v-if="!devices.length && !loading" class="cast-empty">未发现设备。请确认手机/NAS 与电视同一局域网。</div>
      <button
        v-for="d in devices"
        :key="d.udn"
        type="button"
        class="dev-row"
        :disabled="playingUdn === d.udn"
        @click="castTo(d)"
      >
        <span>{{ d.name }}</span>
        <em>{{ playingUdn === d.udn ? '投送中…' : '投送' }}</em>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { currentPlaying, currentLocalTrackPath } from '../stores/player.js'

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
    if (!devices.value.length) {
      error.value = '没有搜到 DLNA 渲染器'
    }
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
  const rawId = String(t.id || t.trackId || '')
  const trackId = currentLocalTrackPath.value && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : ''
  const episodeId = t.podcastEpisodeId || (t.source === 'podcast' ? t.id : '')
  if (!trackId && !episodeId && !currentLocalTrackPath.value) {
    error.value = '目前仅支持投送本地音乐库或播客节目（在线平台曲目对电视不稳定）'
    return
  }
  playingUdn.value = device.udn
  error.value = ''
  hint.value = ''
  try {
    await api.dlna.play({
      udn: device.udn,
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
})
</script>

<style scoped>
.cast-modal { width: min(440px, 92vw); padding: 16px 16px 12px; }
.cast-head { display: flex; justify-content: space-between; align-items: center; }
.cast-head h3 { margin: 0; font-size: 16px; }
.cast-tip, .cast-empty { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.cast-toolbar { display: flex; gap: 8px; margin: 10px 0; }
.cast-err { color: var(--danger, #ef4444); font-size: 13px; }
.cast-ok { color: var(--accent); font-size: 13px; }
.dev-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border: 0;
  background: var(--bg-hover);
  color: inherit;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
}
.dev-row em { font-style: normal; color: var(--accent); font-size: 13px; }
</style>
