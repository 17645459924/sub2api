<template>
  <div>
    <!-- 铃铛按钮 -->
    <button
      @click="openModal"
      class="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 hover:scale-105 dark:text-gray-400 dark:hover:bg-dark-800"
      :class="{ 'text-primary-600 dark:text-primary-400': unreadCount > 0 }"
      :aria-label="t('announcements.title')"
    >
      <Icon name="bell" size="md" />
      <span
        v-if="unreadCount > 0"
        class="absolute right-1 top-1 flex h-2 w-2"
      >
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
        <span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
      </span>
    </button>

    <!-- 公告列表 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="isModalOpen"
          class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[10vh] backdrop-blur-sm"
          @click="closeModal"
        >
          <div
            class="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10"
            @click.stop
          >
            <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-dark-700">
              <div class="flex min-w-0 items-baseline gap-2">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t('announcements.title') }}
                </h2>
                <span v-if="unreadCount > 0" class="text-xs text-gray-500 dark:text-gray-400">
                  <span class="font-medium text-primary-600 dark:text-primary-400">{{ unreadCount }}</span>
                  {{ t('announcements.unread') }}
                </span>
              </div>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="unreadCount > 0"
                  @click="markAllAsRead"
                  :disabled="loading"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50 dark:text-primary-400 dark:hover:bg-primary-500/10"
                >
                  {{ t('announcements.markAllRead') }}
                </button>
                <button
                  @click="closeModal"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-700 dark:hover:text-gray-300"
                  :aria-label="t('common.close')"
                >
                  <Icon name="x" size="sm" />
                </button>
              </div>
            </div>

            <div class="max-h-[60vh] overflow-y-auto">
              <div v-if="loading" class="flex items-center justify-center py-16">
                <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600 dark:border-dark-600 dark:border-t-primary-400"></div>
              </div>

              <ul v-else-if="announcements.length > 0" class="divide-y divide-gray-100 dark:divide-dark-700">
                <li
                  v-for="item in announcements"
                  :key="item.id"
                  class="group relative flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-dark-700/30"
                  @click="openDetail(item)"
                >
                  <span
                    class="h-2 w-2 flex-shrink-0 rounded-full"
                    :class="item.read_at ? 'bg-transparent' : 'bg-primary-500'"
                  ></span>
                  <div class="min-w-0 flex-1">
                    <h3
                      class="truncate text-sm"
                      :class="item.read_at ? 'font-normal text-gray-600 dark:text-gray-400' : 'font-medium text-gray-900 dark:text-white'"
                    >
                      {{ item.title }}
                    </h3>
                    <time class="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                      {{ formatRelativeTime(item.created_at) }}
                    </time>
                  </div>
                  <Icon
                    name="chevronRight"
                    size="sm"
                    class="flex-shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 dark:text-gray-600"
                  />
                </li>
              </ul>

              <div v-else class="flex flex-col items-center justify-center py-14">
                <div class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-dark-700">
                  <Icon name="inbox" size="lg" class="text-gray-400 dark:text-gray-500" />
                </div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('announcements.empty') }}</p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('announcements.emptyDescription') }}</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 公告详情 Modal -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="detailModalOpen && selectedAnnouncement"
          class="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh] backdrop-blur-sm"
          @click="closeDetail"
        >
          <div
            class="w-full max-w-[680px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-dark-800 dark:ring-white/10"
            @click.stop
          >
            <div class="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
              <div class="min-w-0">
                <h2 class="text-lg font-semibold leading-snug text-gray-900 dark:text-white">
                  {{ selectedAnnouncement.title }}
                </h2>
                <time class="mt-1 block text-xs text-gray-400 dark:text-gray-500">
                  {{ formatRelativeWithDateTime(selectedAnnouncement.created_at) }}
                </time>
              </div>
              <button
                @click="closeDetail"
                class="-mr-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-700 dark:hover:text-gray-300"
                :aria-label="t('common.close')"
              >
                <Icon name="x" size="sm" />
              </button>
            </div>

            <div class="max-h-[60vh] overflow-y-auto px-6 pb-6 pt-2">
              <div
                class="markdown-body max-w-none"
                v-html="renderMarkdown(selectedAnnouncement.content)"
              ></div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-3.5 dark:border-dark-700 dark:bg-dark-900/30">
              <button
                @click="closeDetail"
                class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-dark-600 dark:bg-dark-700 dark:text-gray-300 dark:hover:bg-dark-600"
              >
                {{ t('common.close') }}
              </button>
              <button
                v-if="!selectedAnnouncement.read_at"
                @click="markAsReadAndClose(selectedAnnouncement.id)"
                class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                {{ t('announcements.markRead') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useAppStore } from '@/stores/app'
import { useAnnouncementStore } from '@/stores/announcements'
import { formatRelativeTime, formatRelativeWithDateTime } from '@/utils/format'
import type { UserAnnouncement } from '@/types'
import Icon from '@/components/icons/Icon.vue'
import '@/styles/announcement-markdown.css'

const { t } = useI18n()
const appStore = useAppStore()
const announcementStore = useAnnouncementStore()

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

// Use store state (storeToRefs for reactivity)
const { announcements, loading } = storeToRefs(announcementStore)
const unreadCount = computed(() => announcementStore.unreadCount)

// Local modal state
const isModalOpen = ref(false)
const detailModalOpen = ref(false)
const selectedAnnouncement = ref<UserAnnouncement | null>(null)

// Methods
function renderMarkdown(content: string): string {
  if (!content) return ''
  const html = marked.parse(content) as string
  return DOMPurify.sanitize(html)
}

function openModal() {
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

function openDetail(announcement: UserAnnouncement) {
  selectedAnnouncement.value = announcement
  detailModalOpen.value = true
  if (!announcement.read_at) {
    markAsRead(announcement.id)
  }
}

function closeDetail() {
  detailModalOpen.value = false
  selectedAnnouncement.value = null
}

async function markAsRead(id: number) {
  try {
    const marked = await announcementStore.markAsRead(id)
    if (!marked) appStore.showError(t('common.unknownError'))
    return marked
  } catch (err: any) {
    appStore.showError(err?.message || t('common.unknownError'))
    return false
  }
}

async function markAsReadAndClose(id: number) {
  if (!await markAsRead(id)) return
  appStore.showSuccess(t('announcements.markedAsRead'))
  closeDetail()
}

async function markAllAsRead() {
  try {
    await announcementStore.markAllAsRead()
    appStore.showSuccess(t('announcements.allMarkedAsRead'))
  } catch (err: any) {
    appStore.showError(err?.message || t('common.unknownError'))
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (detailModalOpen.value) {
      closeDetail()
    } else if (isModalOpen.value) {
      closeModal()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})

watch(
  [isModalOpen, detailModalOpen, () => announcementStore.currentPopup],
  ([modal, detail, popup]) => {
    document.body.style.overflow = (modal || detail || popup) ? 'hidden' : ''
  }
)
</script>

<style scoped>
/* Modal Animations */
.modal-fade-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from > div {
  transform: scale(0.94) translateY(-12px);
  opacity: 0;
}

.modal-fade-leave-to > div {
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

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #94a3b8, #64748b);
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #6b7280, #4b5563);
}
</style>
