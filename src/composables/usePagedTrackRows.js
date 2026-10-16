import { ref, computed, unref, watch } from 'vue'
import { LIST_PAGE_SIZE_DEFAULT, countListPages, toListCount } from './useListPageSize.js'

/** 大列表分页展示，避免一次渲染过多 DOM 行 */
export function usePagedTrackRows(getTracks, { pageSize = 50, enabled = () => true } = {}) {
  const page = ref(1)

  const resolvedSize = computed(() => {
    const raw = typeof pageSize === 'function' ? pageSize() : unref(pageSize)
    return Math.max(1, toListCount(raw, LIST_PAGE_SIZE_DEFAULT) || LIST_PAGE_SIZE_DEFAULT)
  })

  const totalPages = computed(() => {
    if (!enabled()) return 1
    return countListPages(getTracks().length, resolvedSize.value)
  })

  const displayRows = computed(() => {
    const tracks = getTracks()
    const size = resolvedSize.value
    if (!enabled()) {
      return tracks.map((item, i) => ({ item, i }))
    }
    const start = (page.value - 1) * size
    return tracks
      .slice(start, start + size)
      .map((item, offset) => ({ item, i: start + offset }))
  })

  function resetPage() {
    page.value = 1
  }

  watch([resolvedSize, totalPages], () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  })

  return { page, totalPages, displayRows, resetPage, pageSize: resolvedSize }
}
