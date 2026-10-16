<template>
  <div class="podcast-feed-page">
    <div class="feed-head">
      <router-link to="/podcasts" class="back">← 全部订阅</router-link>
      <div v-if="feed" class="feed-hero">
        <img v-if="feed.imageUrl" class="hero-cover" :src="feed.imageUrl" alt="" />
        <div>
          <h2>{{ feed.title }}</h2>
          <p class="hero-meta">{{ feed.author }} · {{ total }} 期</p>
          <p v-if="feed.description" class="hero-desc">{{ feed.description }}</p>
          <div class="hero-actions">
            <button class="btn-primary btn-sm" type="button" :disabled="!tracks.length" @click="playAll">从最新播放</button>
            <button class="btn-ghost btn-sm" type="button" :disabled="refreshing" @click="onRefresh">
              {{ refreshing ? '刷新中…' : '刷新节目' }}
            </button>
            <button class="btn-ghost btn-sm" type="button" @click="onUnsubscribe">取消订阅</button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="toast" class="form-toast">{{ toast }}</p>

    <div v-if="loading && !episodes.length" class="empty card">正在读取节目…</div>
    <div v-else-if="!episodes.length" class="empty card">没有可播放的音频节目</div>
    <div v-else class="ep-list">
      <button
        v-for="(ep, i) in episodes"
        :key="ep.id"
        type="button"
        class="ep-row"
        @click="playFrom(i)"
      >
        <span class="ep-idx">{{ i + 1 }}</span>
        <div class="ep-info">
          <div class="ep-title">{{ ep.title }}</div>
          <div class="ep-meta">
            <span v-if="ep.pubDate">{{ formatDate(ep.pubDate) }}</span>
            <span v-if="ep.duration">{{ formatDur(ep.duration) }}</span>
          </div>
        </div>
      </button>
    </div>
    <div v-if="total > episodes.length" class="more-row">
      <button class="btn-ghost btn-sm" type="button" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { startPlayTracks } from '../stores/player.js'

const route = useRoute()
const router = useRouter()
const feed = ref(null)
const episodes = ref([])
const tracks = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const refreshing = ref(false)
const error = ref('')
const toast = ref('')

function formatDate(ms) {
  if (!ms) return ''
  try {
    return new Date(ms).toLocaleDateString()
  } catch {
    return ''
  }
}

function formatDur(sec) {
  const n = Number(sec) || 0
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function showToast(text) {
  toast.value = text
  setTimeout(() => { toast.value = '' }, 2800)
}

async function loadPage(nextPage, append = false) {
  const id = String(route.params.id || '')
  if (!id) return
  if (append) loadingMore.value = true
  else loading.value = true
  error.value = ''
  try {
    const res = await api.podcasts.episodes(id, { page: nextPage, limit: 50 })
    const data = res.data || {}
    feed.value = data.feed || null
    total.value = Number(data.total) || 0
    const eps = data.episodes || []
    const tr = data.tracks || []
    if (append) {
      episodes.value = [...episodes.value, ...eps]
      tracks.value = [...tracks.value, ...tr]
    } else {
      episodes.value = eps
      tracks.value = tr
    }
    page.value = nextPage
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function playFrom(index) {
  startPlayTracks(tracks.value.slice(index), 'podcast').catch((e) => {
    showToast(e.message || '播放失败')
  })
}

function playAll() {
  playFrom(0)
}

async function loadMore() {
  await loadPage(page.value + 1, true)
}

async function onRefresh() {
  refreshing.value = true
  try {
    await api.podcasts.refresh(String(route.params.id))
    await loadPage(1)
    showToast('节目已更新')
  } catch (e) {
    error.value = e.message || '刷新失败'
  } finally {
    refreshing.value = false
  }
}

async function onUnsubscribe() {
  if (!window.confirm('取消订阅后节目列表会从本账号移除，确定吗？')) return
  try {
    await api.podcasts.unsubscribe(String(route.params.id))
    router.push('/podcasts')
  } catch (e) {
    error.value = e.message || '取消失败'
  }
}

watch(() => route.params.id, () => loadPage(1))
onMounted(() => loadPage(1))
</script>

<style scoped>
.podcast-feed-page { padding: 8px 4px 28px; }
.back { font-size: 13px; color: var(--text-muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.feed-hero {
  display: flex;
  gap: 16px;
  margin: 12px 0 18px;
  align-items: flex-start;
}
.hero-cover {
  width: 112px;
  height: 112px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}
.feed-hero h2 { margin: 0 0 6px; font-size: 22px; }
.hero-meta { margin: 0; color: var(--text-muted); font-size: 13px; }
.hero-desc {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.form-error { color: var(--danger, #ef4444); font-size: 13px; }
.form-toast { color: var(--accent); font-size: 13px; }
.empty { padding: 24px; text-align: center; color: var(--text-muted); }
.ep-list { display: flex; flex-direction: column; gap: 4px; }
.ep-row {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 10px 8px;
  border-radius: 10px;
  cursor: pointer;
}
.ep-row:hover { background: var(--bg-hover); }
.ep-idx { width: 28px; color: var(--text-muted); font-size: 13px; }
.ep-title { font-weight: 600; }
.ep-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; display: flex; gap: 10px; }
.more-row { margin-top: 12px; }
@media (max-width: 640px) {
  .feed-hero { flex-direction: column; }
}
</style>
