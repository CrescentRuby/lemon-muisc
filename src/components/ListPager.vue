<template>
  <div v-if="show" class="list-pager">
    <AppSelect
      v-if="showSize"
      class="list-pager-size"
      :model-value="pageSize"
      :options="sizeOptions"
      size="sm"
      min-width="7.5rem"
      title="每页显示条数"
      @update:model-value="onSizeChange"
    />
    <div class="list-pager-nav" role="navigation" :aria-label="ariaLabel">
      <button
        type="button"
        class="list-pager-btn"
        :disabled="page <= 1"
        aria-label="上一页"
        @click="go(page - 1)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <span class="list-pager-current" aria-current="page">{{ page }}</span>
      <button
        type="button"
        class="list-pager-btn"
        :disabled="page >= totalPages"
        aria-label="下一页"
        @click="go(page + 1)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppSelect from './AppSelect.vue'
import { listPageSizeSelectOptions, LIST_PAGE_SIZE_OPTIONS } from '../composables/useListPageSize.js'

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  /** 总条数（优先）；也可只传 totalPages */
  total: { type: Number, default: 0 },
  totalPages: { type: Number, default: 0 },
  /** 总条数不超过最小档且仅一页时是否仍显示（便于改每页条数） */
  alwaysShowSize: { type: Boolean, default: false },
  /** 远程接口不支持改条数时设为 false，仅保留翻页 */
  showSize: { type: Boolean, default: true },
  ariaLabel: { type: String, default: '分页' },
  sizeOptions: {
    type: Array,
    default: () => listPageSizeSelectOptions,
  },
})

const emit = defineEmits(['update:page', 'update:pageSize', 'change-page', 'change-page-size'])

const resolvedTotalPages = computed(() => {
  if (props.totalPages > 0) return Math.max(1, props.totalPages)
  const size = Math.max(1, Number(props.pageSize) || 1)
  return Math.max(1, Math.ceil(Math.max(0, props.total) / size))
})

const minSize = computed(() => {
  const vals = (props.sizeOptions || [])
    .map((o) => Number(o?.value))
    .filter((n) => Number.isFinite(n) && n > 0)
  return vals.length ? Math.min(...vals) : (LIST_PAGE_SIZE_OPTIONS[0] || 10)
})

const show = computed(() => {
  const total = Math.max(0, Number(props.total) || 0)
  const pages = resolvedTotalPages.value
  if (pages > 1) return true
  if (!props.showSize) return false
  if (props.alwaysShowSize && total > 0) return true
  if (total > minSize.value) return true
  return false
})

function go(next) {
  const p = Math.min(resolvedTotalPages.value, Math.max(1, next))
  if (p === props.page) return
  emit('update:page', p)
  emit('change-page', p)
}

function onSizeChange(value) {
  const next = Number(value)
  if (!Number.isFinite(next) || next === props.pageSize) return
  emit('update:pageSize', next)
  emit('change-page-size', next)
  if (props.page !== 1) {
    emit('update:page', 1)
    emit('change-page', 1)
  }
}
</script>

<style scoped>
.list-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  padding: 4px 0;
}
.list-pager-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.list-pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated, var(--bg-card));
  color: var(--text-secondary);
  cursor: pointer;
}
.list-pager-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}
.list-pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.list-pager-current {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: #fff;
  background: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
}
.list-pager-size :deep(.app-select-trigger) {
  height: 34px;
  min-height: 34px;
  border-radius: 8px;
}
@media (max-width: 768px) {
  .list-pager {
    gap: 10px;
    margin-top: 12px;
  }
}
</style>
