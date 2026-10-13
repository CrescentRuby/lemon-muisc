import { ref, computed, unref, watch } from 'vue'

/** 大列表分页展示，避免一次渲染过多 DOM 行 */
export function usePagedTrackRows(getTracks, { pageSize = 50, enabled = () => true } = {}) {
  const page = ref(1)

  const resolvedSize = computed(() => {
    const raw = typeof pageSize === 'function' ? pageSize() : unref(pageSize)
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : 50
  })

  const totalPages = computed(() => {
    if (!enabled()) return 1
    const total = getTracks().length
    return Math.max(1, Math.ceil(total / resolvedSize.value))
  })

  const displayRows = computed(() => {
    const tracks = getTracks()
    const size = resolvedSize.value
    if (!enabled() || tracks.length <= size) {
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
