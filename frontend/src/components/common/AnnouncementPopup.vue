<template>
  <Teleport to="body">
    <Transition name="popup-fade">
      <div
        v-if="displayedAnnouncement"
        class="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh] backdrop-blur-sm"
      >
        <div
          class="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10"
          @click.stop
        >
          <div class="px-6 pb-3 pt-5">
            <div class="mb-2 flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <Icon name="bell" size="xs" />
                {{ t('announcements.title') }}
              </span>
            </div>
            <h2 class="text-lg font-semibold leading-snug text-gray-900 dark:text-white">
              {{ displayedAnnouncement.title }}
            </h2>
            <time class="mt-1 block text-xs text-gray-400 dark:text-gray-500">
              {{ formatRelativeWithDateTime(displayedAnnouncement.created_at) }}
            </time>
          </div>

          <div class="max-h-[55vh] overflow-y-auto px-6 pb-6 pt-2">
            <div
              class="markdown-body max-w-none"
              v-html="renderedContent"
            ></div>
          </div>

          <div class="flex items-center justify-end border-t border-gray-100 bg-gray-50/60 px-6 py-3.5 dark:border-dark-700 dark:bg-dark-900/30">
            <button
              @click="handleDismiss"
              data-testid="announcement-popup-dismiss"
              class="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              {{ preview ? t('common.close') : t('announcements.markRead') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Icon from '@/components/icons/Icon.vue'
import { useAnnouncementStore } from '@/stores/announcements'
import { formatRelativeWithDateTime } from '@/utils/format'
import type { Announcement, UserAnnouncement } from '@/types'
import '@/styles/announcement-markdown.css'

type PreviewAnnouncement = Pick<Announcement | UserAnnouncement, 'title' | 'content' | 'created_at'>

const props = withDefaults(defineProps<{
  announcement?: PreviewAnnouncement | null
  preview?: boolean
}>(), {
  announcement: null,
  preview: false,
})

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const announcementStore = useAnnouncementStore()
const displayedAnnouncement = computed(() => (
  props.preview ? props.announcement : announcementStore.currentPopup
))

marked.setOptions({
  breaks: true,
  gfm: true,
})

const renderedContent = computed(() => {
  const content = displayedAnnouncement.value?.content
  if (!content) return ''
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
})

function handleDismiss() {
  if (props.preview) {
    emit('close')
    return
  }
  announcementStore.dismissPopup()
}

// Manage body overflow — only set, never unset (bell component handles restore)
watch(
  displayedAnnouncement,
  (popup) => {
    if (popup) {
      document.body.style.overflow = 'hidden'
    } else if (props.preview) {
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (props.preview) {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.popup-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.popup-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.popup-fade-enter-from,
.popup-fade-leave-to {
  opacity: 0;
}

.popup-fade-enter-from > div {
  transform: scale(0.94) translateY(-12px);
  opacity: 0;
}

.popup-fade-leave-to > div {
  transform: scale(0.96) translateY(-8px);
  opacity: 0;
}

/* Scrollbar Styling */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #cbd5e1, #94a3b8);
  border-radius: 4px;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #4b5563, #374151);
}
</style>
