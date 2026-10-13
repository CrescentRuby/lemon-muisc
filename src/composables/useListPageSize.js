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
