import { computed, unref } from 'vue'
import { usePagedTrackRows } from './usePagedTrackRows.js'
import { useVirtualTrackList } from './useVirtualTrackList.js'
import { useListPageSize, LIST_PAGE_SIZE_DEFAULT } from './useListPageSize.js'

const VIRTUAL_THRESHOLD = 60

/**
 * 曲目列表展示：小列表全量渲染；中等列表分页；大列表可选虚拟滚动
 */
export function useTrackListView(getTracks, {
  paginateWhen = () => true,
  enableVirtual = true,
  /** 不传则用全站共用每页条数偏好 */
  pageSize,
  virtualThreshold = VIRTUAL_THRESHOLD,
  desktopRowHeight,
  mobileRowHeight,
  useSharedPageSize = true,
} = {}) {
  const { pageSize: sharedSize } = useListPageSize({ shared: true })
  const effectivePageSize = computed(() => {
    if (pageSize != null) {
      const raw = typeof pageSize === 'function' ? pageSize() : unref(pageSize)
      const n = Number(raw)
      return Number.isFinite(n) && n > 0 ? n : LIST_PAGE_SIZE_DEFAULT
    }
    if (useSharedPageSize) return sharedSize.value
    return LIST_PAGE_SIZE_DEFAULT
  })

  const trackCount = computed(() => getTracks().length)
  const useVirtualMode = computed(() => enableVirtual && trackCount.value > virtualThreshold)

  const {
    page,
    totalPages,
    displayRows: pagedRows,
    resetPage,
  } = usePagedTrackRows(getTracks, {
    pageSize: effectivePageSize,
    enabled: () => paginateWhen() && trackCount.value > effectivePageSize.value && !useVirtualMode.value,
  })

  const {
    containerRef,
    useVirtual,
    visibleRows,
    paddingTop,
    paddingBottom,
    onScroll,
    resetScroll,
    measureViewport,
  } = useVirtualTrackList(() => {
    if (useVirtualMode.value) return getTracks().map((item, i) => ({ item, i }))
    return pagedRows.value
  }, {
    threshold: virtualThreshold,
    ...(desktopRowHeight != null ? { desktopRowHeight } : {}),
    ...(mobileRowHeight != null ? { mobileRowHeight } : {}),
  })

  const displayRows = computed(() => (
    useVirtualMode.value ? visibleRows.value : pagedRows.value
  ))

  function resetView() {
    resetPage()
    resetScroll()
  }

  return {
    page,
    totalPages,
    /** 可写：未传入 pageSize 时绑定全站偏好；传入时为只读 computed */
    pageSize: pageSize != null ? effectivePageSize : sharedSize,
    displayRows,
    containerRef,
    useVirtual: useVirtualMode,
    paddingTop,
    paddingBottom,
    onScroll,
    resetView,
    measureViewport,
    showPagination: computed(() => !useVirtualMode.value && (
      totalPages.value > 1
      || trackCount.value > effectivePageSize.value
      || trackCount.value > 10
    )),
  }
}
