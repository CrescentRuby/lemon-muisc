<template>
  <svg
    class="podcast-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.35" />
    <circle cx="12" cy="12" r="6.15" fill="none" stroke="currentColor" stroke-width="2.2" />
    <circle cx="12" cy="10.1" r="2.05" fill="currentColor" />
    <path
      fill="currentColor"
      d="M8.4 19.05c.5-2.45 1.9-3.75 3.6-3.75s3.1 1.3 3.6 3.75C14.5 20.5 13.35 21.35 12 21.35s-2.5-.85-3.6-2.3z"
    />
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 16 },
})
</script>

<style scoped>
.podcast-icon {
  display: block;
  flex-shrink: 0;
}
</style>
