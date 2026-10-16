<template>
  <svg
    class="cast-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.85"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="1.8" y="3.2" width="20.4" height="17.6" rx="2.6" />
    <path d="M6.9 19.15A2.25 2.25 0 0 0 4.65 16.9" />
    <path d="M9.6 19.15A4.95 4.95 0 0 0 4.65 14.2" />
    <path d="M12.45 19.15A7.8 7.8 0 0 0 4.65 11.35" />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 16 },
})
</script>

<style scoped>
.cast-icon {
  display: block;
  flex-shrink: 0;
}
</style>
