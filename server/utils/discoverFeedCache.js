/**
 * 发现页首页/列表内存缓存：短 TTL 新鲜数据 + 过期后仍可作失败回退。
 */
const FRESH_TTL_MS = 8 * 60 * 1000
const STALE_TTL_MS = 2 * 60 * 60 * 1000
const MAX_ENTRIES = 96

/** @type {Map<string, { data: object, freshUntil: number, staleUntil: number }>} */
const cache = new Map()
/** @type {Map<string, Promise<{ data: object, cached: boolean, stale: boolean }>>} */
const inflight = new Map()

function touchOrder(key) {
  const entry = cache.get(key)
  if (!entry) return
  cache.delete(key)
  cache.set(key, entry)
}

function trimToMax() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
}

export function buildDiscoverFeedKey(parts = []) {
  return parts.map((p) => String(p ?? '')).join(':')
}

export function getFreshDiscoverFeed(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.freshUntil) return null
  touchOrder(key)
  return entry.data
}

/** 新鲜窗口已过、仍在 stale 窗口内的数据（失败时回退用） */
export function getStaleDiscoverFeed(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.staleUntil) {
    cache.delete(key)
    return null
  }
  touchOrder(key)
  return entry.data
}

export function setDiscoverFeed(key, data, {
  freshTtlMs = FRESH_TTL_MS,
  staleTtlMs = STALE_TTL_MS,
} = {}) {
  if (!key || data == null) return
  const now = Date.now()
  cache.set(key, {
    data,
    freshUntil: now + freshTtlMs,
    staleUntil: now + Math.max(freshTtlMs, staleTtlMs),
  })
  trimToMax()
}

/**
 * 有新鲜缓存直接返回；否则拉取。拉取失败时若有过期缓存则返回并标 stale。
 */
export async function getOrFetchDiscoverFeed(key, fetcher) {
  const fresh = getFreshDiscoverFeed(key)
  if (fresh != null) return { data: fresh, cached: true, stale: false }

  const pending = inflight.get(key)
  if (pending) return pending

  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setDiscoverFeed(key, data)
      return { data, cached: false, stale: false }
    })
    .catch((err) => {
      const stale = getStaleDiscoverFeed(key)
      if (stale != null) return { data: stale, cached: true, stale: true }
      throw err
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, promise)
  return promise
}

export function getDiscoverFeedCacheStats() {
  return {
    size: cache.size,
    maxEntries: MAX_ENTRIES,
    inflight: inflight.size,
    freshTtlMs: FRESH_TTL_MS,
    staleTtlMs: STALE_TTL_MS,
  }
}
