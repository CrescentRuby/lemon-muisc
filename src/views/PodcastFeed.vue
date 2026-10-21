<template>
  <div class="podcast-feed-page">
    <div class="feed-head">
      <div class="title-line">
        <router-link to="/podcasts" class="page-title"><PodcastIcon :size="20" />播客</router-link>
        <button type="button" class="back-btn" @click="goBack">← 返回</button>
      </div>
      <div v-if="feed" class="feed-hero">
        <div class="hero-top">
          <img v-if="feed.imageUrl" class="hero-cover" :src="feed.imageUrl" alt="" />
          <div v-else class="hero-cover hero-cover-empty"><PodcastIcon :size="40" /></div>
          <div class="hero-copy">
            <h2>{{ feed.title }}</h2>
            <p class="hero-meta">{{ feed.author }} · {{ total }} 期</p>
          </div>
        </div>
        <p v-if="feed.description" class="hero-desc">{{ feed.description }}</p>
        <div class="hero-actions">
          <button class="btn-primary btn-sm play-btn" type="button" :disabled="!tracks.length" @click="playAll">
            <span class="play-label-full">从最新播放</span>
            <span class="play-label-short">播放</span>
          </button>
          <button
            class="btn-ghost btn-sm"
            type="button"
            :disabled="refreshing"
            title="重新请求 RSS，拉取最新节目"
            @click="onRefresh"
          >
            {{ refreshing ? '拉取中…' : '拉取最新' }}
          </button>
          <button class="btn-ghost btn-sm" type="button" @click="onUnsubscribe">取消订阅</button>
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
import PodcastIcon from '../components/PodcastIcon.vue'
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

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/podcasts')
}

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
  startPlayTracks(tracks.value.slice(index), 'podcast', { dynamic: false }).catch((e) => {
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
.podcast-feed-page { padding: 4px 0 28px; }
.title-line {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
  line-height: 1.2;
}
.back-btn {
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}
.back-btn:active { opacity: 0.7; }
.feed-hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0 12px;
}
.hero-top {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.hero-copy { min-width: 0; flex: 1; }
.hero-cover {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}
.hero-cover-empty {
  display: grid;
  place-items: center;
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border-light);
}
.feed-hero h2 {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.hero-meta { margin: 0; color: var(--text-muted); font-size: 13px; }
.hero-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.play-btn { min-width: 88px; }
.play-label-short { display: none; }
.form-error { color: var(--danger, #ef4444); font-size: 13px; }
.form-toast { color: var(--accent); font-size: 13px; }
.empty { padding: 24px; text-align: center; color: var(--text-muted); }
.ep-list { display: flex; flex-direction: column; gap: 0; }
.ep-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 10px 4px;
  border-radius: 10px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.ep-row:hover { background: var(--bg-hover); }
.ep-row:active { opacity: 0.85; }
.ep-idx {
  width: 24px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
  padding-top: 1px;
}
.ep-info { min-width: 0; flex: 1; }
.ep-title {
  font-weight: 600;
  font-size: 14.5px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.ep-meta { font-size: 12px; color: var(--text-muted); margin-top: 3px; display: flex; gap: 10px; }
.more-row { margin-top: 12px; text-align: center; }
@media (max-width: 768px) {
  .podcast-feed-page { padding: 0 0 8px; }
  .page-title { font-size: 18px; }
  .feed-hero { gap: 8px; margin: 10px 0 8px; }
  .hero-top { gap: 12px; }
  .hero-cover { width: 72px; height: 72px; border-radius: 10px; }
  .feed-hero h2 { font-size: 16px; margin: 0 0 4px; }
  .hero-meta { font-size: 12px; }
  .hero-desc {
    -webkit-line-clamp: 2;
    font-size: 12.5px;
    line-height: 1.45;
  }
  .hero-actions {
    flex-wrap: nowrap;
    gap: 6px;
  }
  .hero-actions .btn-sm {
    flex: 1;
    height: 34px;
    padding: 0 8px;
    font-size: 12.5px;
    min-width: 0;
  }
  .play-btn { min-width: 0; }
  .play-label-full { display: none; }
  .play-label-short { display: inline; }
  .ep-row { padding: 10px 2px; gap: 8px; }
  .ep-idx { width: 20px; font-size: 12px; }
  .ep-title { font-size: 14px; }
}
</style>
