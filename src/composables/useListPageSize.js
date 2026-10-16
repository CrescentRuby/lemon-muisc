import { ref, watch } from 'vue'

export const LIST_PAGE_SIZE_OPTIONS = [10, 20, 50]
export const LIST_PAGE_SIZE_DEFAULT = 20
const STORAGE_KEY = 'lemon-list-page-size'

function readStored() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY))
    if (LIST_PAGE_SIZE_OPTIONS.includes(n)) return n
  } catch {
    /* ignore */
  }
  return LIST_PAGE_SIZE_DEFAULT
}

/** 全站列表共用「每页条数」偏好 */
const sharedPageSize = ref(readStored())

watch(sharedPageSize, (n) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(n))
  } catch {
    /* ignore */
  }
})

export const listPageSizeSelectOptions = LIST_PAGE_SIZE_OPTIONS.map((n) => ({
  value: n,
  label: `${n} 条/页`,
}))

/** 分页用的非负整数；忽略 boolean（Vue 空 attribute 会变成 true） */
export function toListCount(value, fallback = 0) {
  if (typeof value === 'boolean' || value == null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.floor(n)
}

export function countListPages(total, pageSize, fallbackPages = 0) {
  const size = Math.max(1, toListCount(pageSize, LIST_PAGE_SIZE_DEFAULT) || LIST_PAGE_SIZE_DEFAULT)
  const n = toListCount(total, 0)
  if (n > 0) return Math.max(1, Math.ceil(n / size))
  return Math.max(1, toListCount(fallbackPages, 0) || 1)
}

/** 服务端 total 缺失或偏小时，用已加载条数托底 */
export function resolveLoadedTotal(reportedTotal, page, pageSize, pageItemCount) {
  const reported = toListCount(reportedTotal, 0)
  const size = Math.max(1, toListCount(pageSize, LIST_PAGE_SIZE_DEFAULT) || LIST_PAGE_SIZE_DEFAULT)
  const p = Math.max(1, toListCount(page, 1) || 1)
  const loaded = Math.max(0, (p - 1) * size + toListCount(pageItemCount, 0))
  return Math.max(reported, loaded)
}

/**
 * @param {{ shared?: boolean, initial?: number }} [opts]
 * - shared（默认 true）：读写全局偏好
 * - shared false：组件内独立条数（仍默认从全局读取初值）
 */
export function useListPageSize(opts = {}) {
  const shared = opts.shared !== false
  const initial = LIST_PAGE_SIZE_OPTIONS.includes(opts.initial)
    ? opts.initial
    : sharedPageSize.value
  const pageSize = shared ? sharedPageSize : ref(initial)

  function setPageSize(n) {
    const next = Number(n)
    if (!LIST_PAGE_SIZE_OPTIONS.includes(next)) return
    pageSize.value = next
  }

  return {
    pageSize,
    setPageSize,
    pageSizeOptions: listPageSizeSelectOptions,
    pageSizeValues: LIST_PAGE_SIZE_OPTIONS,
  }
}
