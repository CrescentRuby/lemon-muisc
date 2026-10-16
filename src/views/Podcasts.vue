<template>
  <div class="podcasts-page">
    <div class="page-title">播客</div>
    <p class="page-subtitle">订阅 RSS / Atom，节目会进入当前播放队列，不经过音乐库扫描</p>

    <form class="subscribe-row" @submit.prevent="onSubscribe">
      <input
        v-model="url"
        class="subscribe-input"
        type="url"
        placeholder="粘贴播客 RSS 地址，例如 https://example.com/feed.xml"
        autocomplete="off"
      />
      <button class="btn-primary btn-sm" type="submit" :disabled="subscribing || !url.trim()">
        {{ subscribing ? '解析中…' : '订阅' }}
      </button>
      <button class="btn-ghost btn-sm" type="button" :disabled="loading" @click="loadFeeds">刷新</button>
    </form>

    <p v-if="error" class="form-error">{{ error }}</p>
    <p v-if="toast" class="form-toast" :class="toast.type">{{ toast.text }}</p>

    <div v-if="loading && !feeds.length" class="empty card">正在加载订阅…</div>
    <div v-else-if="!feeds.length" class="empty card">
      还没有订阅。把播客客户端里的 RSS 链接贴上来即可。
    </div>
    <div v-else class="feed-grid">
      <button
        v-for="feed in feeds"
        :key="feed.id"
        type="button"
        class="feed-card card"
        @click="openFeed(feed.id)"
      >
        <img v-if="feed.imageUrl" class="feed-cover" :src="feed.imageUrl" alt="" />
        <div v-else class="feed-cover feed-cover-empty">播</div>
        <div class="feed-body">
          <div class="feed-title" :title="feed.title">{{ feed.title }}</div>
          <div class="feed-meta">{{ feed.author || '未知作者' }} · {{ feed.episodeCount || 0 }} 期</div>
          <div v-if="feed.lastError" class="feed-err">{{ feed.lastError }}</div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'

const router = useRouter()
const feeds = ref([])
const url = ref('')
const loading = ref(false)
const subscribing = ref(false)
const error = ref('')
const toast = ref(null)

function showToast(text, type = 'info') {
  toast.value = { text, type }
  setTimeout(() => { toast.value = null }, 2800)
}

async function loadFeeds() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.podcasts.list()
    feeds.value = res.data || res || []
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function onSubscribe() {
  const feedUrl = url.value.trim()
  if (!feedUrl) return
  subscribing.value = true
  error.value = ''
  try {
    await api.podcasts.subscribe(feedUrl)
    url.value = ''
    showToast('已订阅', 'success')
    await loadFeeds()
  } catch (e) {
    error.value = e.message || '订阅失败'
  } finally {
    subscribing.value = false
  }
}

function openFeed(id) {
  router.push(`/podcasts/${encodeURIComponent(id)}`)
}

onMounted(() => {
  loadFeeds()
})
</script>

<style scoped>
.podcasts-page { padding: 8px 4px 24px; }
.page-title { font-size: 22px; font-weight: 700; }
.page-subtitle { margin: 6px 0 16px; color: var(--text-muted); font-size: 13px; }
.subscribe-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.subscribe-input {
  flex: 1 1 280px;
  min-width: 0;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  padding: 0 12px;
}
.form-error { color: var(--danger, #ef4444); font-size: 13px; margin: 0 0 12px; }
.form-toast { font-size: 13px; margin: 0 0 12px; color: var(--text-muted); }
.form-toast.success { color: var(--accent); }
.empty { padding: 28px 16px; text-align: center; color: var(--text-muted); }
.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.feed-card {
  display: flex;
  gap: 12px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  padding: 12px;
  border: 0;
  width: 100%;
  color: inherit;
}
.feed-card:hover { background: var(--bg-hover); }
.feed-cover {
  width: 64px;
  height: 64px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg);
}
.feed-cover-empty {
  display: grid;
  place-items: center;
  font-weight: 700;
  color: var(--text-muted);
}
.feed-title {
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feed-meta { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.feed-err { font-size: 12px; color: var(--danger, #ef4444); margin-top: 4px; }
</style>
