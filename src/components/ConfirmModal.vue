<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-overlay confirm-overlay"
      @click.self="!busy && onCancel()"
      @keydown.esc.prevent="!busy && onCancel()"
    >
      <div class="confirm-modal card" role="dialog" :aria-labelledby="titleId" aria-modal="true">
        <div class="confirm-handle" aria-hidden="true" />
        <div class="confirm-body" :class="{ 'no-cover': !cover }">
          <div v-if="cover" class="confirm-cover-wrap">
            <CoverArt :src="cover" />
          </div>
          <div class="confirm-main">
            <h3 :id="titleId">{{ title }}</h3>
            <p v-if="message" class="confirm-text">{{ message }}</p>
            <p v-if="hint" class="confirm-hint">{{ hint }}</p>
            <label v-if="mode === 'prompt'" class="confirm-input-wrap">
              <span v-if="inputLabel" class="confirm-input-label">{{ inputLabel }}</span>
              <input
                ref="inputEl"
                class="confirm-input"
                type="text"
                :value="inputValue"
                :placeholder="inputPlaceholder"
                :disabled="busy"
                @input="onInput"
                @keydown.enter.prevent="!busy && onConfirm()"
              />
            </label>
          </div>
        </div>
        <div class="confirm-actions" :class="{ 'is-single': mode === 'alert' }">
          <button
            v-if="mode !== 'alert'"
            type="button"
            class="btn-ghost btn-sm confirm-btn-cancel"
            :disabled="busy"
            @click="onCancel()"
          >
            {{ cancelText }}
          </button>
          <button
            type="button"
            class="btn-sm confirm-btn-ok"
            :class="danger ? 'btn-danger' : 'btn-primary'"
            :disabled="busy"
            @click="onConfirm()"
          >
            {{ busy ? busyText : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import CoverArt from './CoverArt.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'confirm' }, // confirm | alert | prompt
  title: { type: String, default: '确认' },
  message: { type: String, default: '' },
  hint: { type: String, default: '' },
  cover: { type: String, default: '' },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  busyText: { type: String, default: '处理中…' },
  inputValue: { type: String, default: '' },
  inputPlaceholder: { type: String, default: '' },
  inputLabel: { type: String, default: '' },
})

const emit = defineEmits(['confirm', 'cancel', 'update:inputValue'])

const titleId = 'confirm-modal-title'
const inputEl = ref(null)

watch(
  () => [props.open, props.mode],
  async ([open, mode]) => {
    if (open && mode === 'prompt') {
      await nextTick()
      inputEl.value?.focus?.()
      inputEl.value?.select?.()
    }
  },
)

function onInput(e) {
  emit('update:inputValue', e?.target?.value ?? '')
}

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  /* 高于页面内弹层（如查重 ~1200）与标签编辑浮层（~11000） */
  z-index: 12000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.confirm-modal {
  width: min(400px, 100%);
  padding: 18px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.confirm-body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 16px;
}
.confirm-cover-wrap {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-input);
}
.confirm-cover-wrap :deep(.cover-art) {
  width: 100%;
  height: 100%;
}
.confirm-main {
  min-width: 0;
  flex: 1;
}
.confirm-modal h3 {
  margin: 0 0 10px;
  font-size: 17px;
  line-height: 1.35;
  color: var(--text);
}
.confirm-text {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}
.confirm-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}
.confirm-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.confirm-input-label {
  font-size: 12px;
  color: var(--text-muted);
}
.confirm-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-input, var(--bg));
  color: var(--text);
  font-size: 14px;
}
.confirm-input:focus {
  outline: none;
  border-color: var(--accent);
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-shrink: 0;
}
.btn-danger {
  background: var(--error, #e5484d);
  color: #fff;
  border: 1px solid transparent;
  border-radius: var(--radius, 8px);
  padding: 6px 14px;
  cursor: pointer;
}
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .confirm-overlay {
    align-items: flex-end;
    justify-content: stretch;
    padding: 0;
  }
  .confirm-handle {
    display: block;
    width: 36px;
    height: 4px;
    margin: 6px auto 12px;
    border-radius: 999px;
    background: var(--border, rgba(127, 127, 127, 0.45));
  }
  .confirm-modal {
    width: 100%;
    max-width: 100%;
    max-height: min(78dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 24px));
    margin: 0;
    padding: 4px 16px calc(14px + env(safe-area-inset-bottom, 0px));
    border-radius: 16px 16px 0 0;
    border: 1px solid var(--border-light);
    border-bottom: none;
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.28);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: confirm-sheet-in 0.24s cubic-bezier(0.22, 0.9, 0.28, 1);
  }
  .confirm-cover-wrap {
    width: 64px;
    height: 64px;
    border-radius: 10px;
  }
  .confirm-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 14px;
    gap: 12px;
  }
  .confirm-body:not(.no-cover) {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .confirm-body.no-cover {
    flex-direction: column;
    align-items: stretch;
    text-align: left;
  }
  .confirm-modal h3 {
    font-size: 18px;
    margin-bottom: 8px;
    line-height: 1.35;
  }
  .confirm-text {
    font-size: 15px;
    line-height: 1.55;
    margin-bottom: 0;
  }
  .confirm-hint {
    margin-top: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--bg-input, color-mix(in srgb, var(--text) 4%, transparent));
    border: 1px solid var(--border-light);
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-muted);
  }
  .confirm-input-wrap {
    margin-top: 12px;
  }
  .confirm-input {
    font-size: 16px;
    min-height: 44px;
    padding: 10px 12px;
    border-radius: 10px;
  }
  .confirm-actions {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 8px;
    width: 100%;
    padding-top: 2px;
  }
  .confirm-actions.is-single {
    justify-content: stretch;
  }
  .confirm-actions.is-single .confirm-btn-ok {
    flex: none;
    width: 100%;
  }
  .confirm-actions .btn-sm {
    flex: none;
    width: 100%;
    min-height: 44px;
    padding: 12px 14px;
    font-size: 16px;
    font-weight: 600;
    justify-content: center;
    border-radius: 12px;
  }
  .confirm-actions .confirm-btn-cancel {
    flex: none;
  }
  .confirm-actions .confirm-btn-ok {
    flex: none;
  }
}

@keyframes confirm-sheet-in {
  from {
    transform: translateY(18px);
    opacity: 0.6;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
