import { computed, ref } from 'vue'
import { api } from '../api.js'
import { onWS } from '../ws.js'

/** 算作「正在下载」的状态（不含已完成 / 失败 / 暂停 / 待确认） */
const ACTIVE_STATUSES = new Set(['waiting', 'downloading'])

const activeIds = new Set()
export const activeDownloadCount = ref(0)

export const activeDownloadBadgeText = computed(() => {
  const n = activeDownloadCount.value
  if (n <= 0) return ''
  return n > 99 ? '99+' : String(n)
})

function syncCount() {
  activeDownloadCount.value = activeIds.size
}

function setActive(id, active) {
  if (!id) return
  const key = String(id)
  if (active) activeIds.add(key)
  else activeIds.delete(key)
  syncCount()
}

export function syncDownloadBadgeFromList(list) {
  activeIds.clear()
  for (const t of list || []) {
    if (ACTIVE_STATUSES.has(String(t?.status || ''))) {
      activeIds.add(String(t.id))
    }
  }
  syncCount()
}

export function applyDownloadStatusEvent(d) {
  if (!d?.id) return
  setActive(d.id, ACTIVE_STATUSES.has(String(d.status || '')))
}

export function applyDownloadRemovedEvent(d) {
  if (!d?.id) return
  setActive(d.id, false)
}

export function applyDownloadAddedEvent(d) {
  const tasks = d?.tasks || []
  if (!tasks.length) return
  let changed = false
  for (const t of tasks) {
    if (!t?.id) continue
    if (ACTIVE_STATUSES.has(String(t.status || 'waiting'))) {
      activeIds.add(String(t.id))
      changed = true
    }
  }
  if (changed) syncCount()
}

export function applyDownloadProgressEvent(d) {
  if (!d?.id) return
  setActive(d.id, true)
}

export async function refreshDownloadBadge() {
  try {
    const list = await api.download.list()
    syncDownloadBadgeFromList(list)
  } catch {
    // 静默失败，保持现有计数
  }
}

let unsubs = []
let inited = false

export function initDownloadBadge() {
  if (inited) return
  inited = true
  refreshDownloadBadge()
  unsubs = [
    onWS('download:status', applyDownloadStatusEvent),
    onWS('download:removed', applyDownloadRemovedEvent),
    onWS('download:added', applyDownloadAddedEvent),
    onWS('download:progress', applyDownloadProgressEvent),
  ]
}

export function disposeDownloadBadge() {
  unsubs.forEach((fn) => {
    try { fn() } catch {}
  })
  unsubs = []
  inited = false
}
