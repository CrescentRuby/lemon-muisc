/**
 * 本机试听音频缓存（浏览器 Cache Storage + 索引）。
 * 与服务端缓存分区完全独立：
 * - 服务端：discover-feed-cache / cover-cache / 内存 URL·专辑·歌单缓存（NAS 磁盘与进程内）
 * - 本机：仅当前浏览器，清空/限额不影响服务端
 * - 按「曲目 + 音质(+smooth)」精确匹配，不拿低音质顶高音质
 * - 转码 / 直出与播放时使用的 cacheQuality 一致
 * - 容量超限按 LRU 淘汰
 */
import { playUrlCacheKey } from './playUrlCache.js'

const CACHE_NAME = 'lemon-play-audio-v1'
const INDEX_KEY = 'lemon-play-audio-index-v1'
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024
const MAX_SINGLE_BYTES = 80 * 1024 * 1024

/** @type {{ enabled: boolean, maxBytes: number }} */
let prefs = {
  enabled: true,
  maxBytes: DEFAULT_MAX_BYTES,
}

/** @type {Map<string, string>} key -> objectURL */
const liveObjectUrls = new Map()

export function setPlayAudioCachePrefs({ enabled, maxBytes } = {}) {
  if (typeof enabled === 'boolean') prefs.enabled = enabled
  if (Number.isFinite(maxBytes) && maxBytes >= 32 * 1024 * 1024) {
    prefs.maxBytes = Math.min(maxBytes, 8 * 1024 * 1024 * 1024)
  }
}

export function getPlayAudioCachePrefs() {
  return { ...prefs }
}

function canUseCacheApi() {
  try {
    return typeof caches !== 'undefined' && typeof caches.open === 'function'
  } catch {
    return false
  }
}

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return { entries: [], totalBytes: 0 }
    const data = JSON.parse(raw)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    const totalBytes = entries.reduce((s, e) => s + (Number(e.bytes) || 0), 0)
    return { entries, totalBytes }
  } catch {
    return { entries: [], totalBytes: 0 }
  }
}

function writeIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify({
      entries: index.entries || [],
      totalBytes: index.totalBytes || 0,
      at: Date.now(),
    }))
  } catch {}
}

function cacheRequestForKey(key) {
  // 同源伪 URL，仅作 Cache Storage 键
  return new Request(`${location.origin}/__lemon_audio_cache__/${encodeURIComponent(key)}`, {
    method: 'GET',
  })
}

export function buildPlayAudioCacheKey(item, source, quality) {
  return playUrlCacheKey(item, source, quality || '128k')
}

function revokeLiveUrl(key) {
  const u = liveObjectUrls.get(key)
  if (!u) return
  try { URL.revokeObjectURL(u) } catch {}
  liveObjectUrls.delete(key)
}

/**
 * 命中本地预缓存时返回 blob: URL（调用方播完可继续持有；换键时会回收旧 URL）
 */
export async function getCachedAudioObjectUrl(item, source, quality) {
  if (!prefs.enabled || !canUseCacheApi()) return ''
  const key = buildPlayAudioCacheKey(item, source, quality)
  if (!key) return ''
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(cacheRequestForKey(key))
    if (!hit || !hit.ok) return ''
    const blob = await hit.blob()
    if (!blob?.size) return ''
    // 刷新 LRU
    const index = readIndex()
    const row = index.entries.find((e) => e.key === key)
    if (row) {
      row.at = Date.now()
      writeIndex(index)
    }
    revokeLiveUrl(key)
    const obj = URL.createObjectURL(blob)
    liveObjectUrls.set(key, obj)
    return obj
  } catch {
    return ''
  }
}

async function evictToFit(index, needBytes) {
  if (!canUseCacheApi()) return
  const cache = await caches.open(CACHE_NAME)
  const max = prefs.maxBytes
  let total = index.totalBytes || 0
  const entries = [...(index.entries || [])].sort((a, b) => (a.at || 0) - (b.at || 0))
  while (entries.length && total + needBytes > max) {
    const victim = entries.shift()
    if (!victim?.key) continue
    try {
      await cache.delete(cacheRequestForKey(victim.key))
    } catch {}
    revokeLiveUrl(victim.key)
    total = Math.max(0, total - (Number(victim.bytes) || 0))
  }
  index.entries = entries
  index.totalBytes = total
}

/**
 * 后台把已成功试听的音频写入本地缓存（二次拉取，不挡开播）
 */
export function scheduleStorePlayAudio(item, source, quality, url) {
  if (!prefs.enabled || !canUseCacheApi()) return
  const key = buildPlayAudioCacheKey(item, source, quality)
  const rawUrl = String(url || '').trim()
  if (!key || !rawUrl) return
  // blob/data 已经是本地；勿再存
  if (/^(blob:|data:)/i.test(rawUrl)) return
  // 避免并发重复写入同一键
  if (scheduleStorePlayAudio._inflight?.has(key)) return
  if (!scheduleStorePlayAudio._inflight) scheduleStorePlayAudio._inflight = new Set()
  scheduleStorePlayAudio._inflight.add(key)

  const run = async () => {
    try {
      const cache = await caches.open(CACHE_NAME)
      const exists = await cache.match(cacheRequestForKey(key))
      if (exists?.ok) {
        const index = readIndex()
        const row = index.entries.find((e) => e.key === key)
        if (row) {
          row.at = Date.now()
          writeIndex(index)
        }
        return
      }
      const res = await fetch(rawUrl, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) return
      const len = Number(res.headers.get('content-length') || 0)
      if (len > MAX_SINGLE_BYTES) return
      const buf = await res.arrayBuffer()
      if (!buf?.byteLength || buf.byteLength > MAX_SINGLE_BYTES) return

      const index = readIndex()
      await evictToFit(index, buf.byteLength)
      if (index.totalBytes + buf.byteLength > prefs.maxBytes) return

      const mime = res.headers.get('content-type') || 'application/octet-stream'
      const body = new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(buf.byteLength),
          'X-Lemon-Audio-Key': key,
          'X-Lemon-Audio-Quality': String(quality || ''),
        },
      })
      await cache.put(cacheRequestForKey(key), body)

      index.entries = index.entries.filter((e) => e.key !== key)
      index.entries.push({
        key,
        bytes: buf.byteLength,
        quality: String(quality || ''),
        at: Date.now(),
      })
      index.totalBytes = index.entries.reduce((s, e) => s + (Number(e.bytes) || 0), 0)
      writeIndex(index)
    } catch {
      // 忽略：隐私模式 / 配额 / 网络
    } finally {
      scheduleStorePlayAudio._inflight.delete(key)
    }
  }

  // 错峰：等开播缓冲后再拉，减少和播放抢带宽
  setTimeout(run, 2500)
}

export async function getPlayAudioCacheStats() {
  const index = readIndex()
  return {
    enabled: prefs.enabled,
    maxBytes: prefs.maxBytes,
    totalBytes: index.totalBytes || 0,
    count: (index.entries || []).length,
    supported: canUseCacheApi(),
  }
}

export async function clearPlayAudioCache() {
  for (const key of [...liveObjectUrls.keys()]) revokeLiveUrl(key)
  try {
    if (canUseCacheApi()) await caches.delete(CACHE_NAME)
  } catch {}
  writeIndex({ entries: [], totalBytes: 0 })
}

export function formatCacheBytes(n) {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1048576) return `${(v / 1024).toFixed(1)} KB`
  if (v < 1073741824) return `${(v / 1048576).toFixed(1)} MB`
  return `${(v / 1073741824).toFixed(2)} GB`
}
