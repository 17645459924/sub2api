<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'
const frame = ref<HTMLIFrameElement>()
const auth = useAuthStore()
const router = useRouter()
async function onMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'sub2api:logout') {
    await auth.logout()
    await router.push('/login')
  }
}
onMounted(() => window.addEventListener('message', onMessage))
onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>

<template>
  <AppLayout>
    <iframe ref="frame" class="keeper-frame" src="/keeper/index.html?embed=cpamc" title="用量中心" />
  </AppLayout>
</template>

<style scoped>
.keeper-frame { display: block; width: 100%; height: calc(100dvh - 100px); min-height: 640px; border: 0; border-radius: 16px; background: var(--bg-primary, transparent); }
@media (max-width: 640px) { .keeper-frame { height: calc(100dvh - 80px); min-height: 480px; border-radius: 8px; } }
</style>
