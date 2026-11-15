<template>
  <section id="playground" class="section" aria-labelledby="lv-play-title">
    <div class="lv-container">
      <div class="sec-head" data-reveal>
        <p class="lv-eyebrow"><span class="num">{{ num }} /</span> {{ t('creativeLanding.playEyebrow') }}</p>
        <h2 id="lv-play-title" class="lv-h2">{{ t('creativeLanding.playTitle1') }}<span class="lv-grad">{{ t('creativeLanding.playTitle2') }}</span></h2>
        <p class="pg-sub">{{ t('creativeLanding.playDescription') }} {{ t('creativeLanding.playDescription2') }}</p>
      </div>

      <div class="pg" data-reveal>
        <div class="pg-bar">
          <div class="pg-tabs" role="tablist" :aria-label="t('creativeLanding.demoLabel')">
            <button
              v-for="tab in tabs"
              :id="`pg-tab-${tab.id}`"
              :key="tab.id"
              type="button"
              role="tab"
              :aria-selected="active === tab.id"
              :aria-controls="`pg-panel-${tab.id}`"
              :tabindex="active === tab.id ? 0 : -1"
              :class="{ on: active === tab.id }"
              @click="select(tab.id)"
              @keydown="onKey($event, tab.id)"
            >{{ tab.title }}</button>
          </div>
          <span class="pg-tag"><i class="pulse-dot"></i>{{ t('creativeLanding.inBrowser') }}</span>
        </div>

        <div :id="`pg-panel-${active}`" :key="active" class="pg-body" role="tabpanel" :aria-labelledby="`pg-tab-${active}`">
          <aside class="pg-brief">
            <span class="pg-n mono">PROMPT / {{ String(tabs.findIndex((x) => x.id === active) + 1).padStart(3, '0') }}</span>
            <h3>{{ brief.title }}</h3>
            <p class="pg-desc">{{ brief.description }}</p>
            <div class="pg-prompt">
              <span class="mono">{{ t('creativeLanding.promptLabel') }}</span>
              <p>{{ brief.prompt }}</p>
            </div>
            <button v-if="active !== 'image'" class="btn btn-primary" type="button" @click="run">
              <span>{{ running ? t('creativeLanding.restartDemo') : t('creativeLanding.runDemo') }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
            </button>
            <p class="pg-note">{{ t('creativeLanding.demoDisclaimer') }}</p>
          </aside>

          <div class="pg-stage">
            <div class="pg-top mono">
              <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span>{{ file }}</span>
              <button v-if="running" type="button" class="pg-stop" :aria-label="t('creativeLanding.stopDemo')" @click="running = false">■</button>
              <span v-else aria-hidden="true">↗</span>
            </div>

            <template v-if="active === 'image'">
              <div class="pg-image">
                <img :key="imageIndex" :src="images[imageIndex].src" :alt="t(`creativeLanding.imageDescription${imageIndex + 1}`)" />
                <div class="pg-cap"><span>{{ t('creativeLanding.imageMeta') }}</span><strong>{{ t(`creativeLanding.imageName${imageIndex + 1}`) }}</strong></div>
              </div>
              <div class="pg-thumbs" role="group" :aria-label="t('creativeLanding.selectImage')">
                <button
                  v-for="(img, i) in images"
                  :key="img.src"
                  type="button"
                  :class="{ on: imageIndex === i }"
                  :aria-pressed="imageIndex === i"
                  :aria-label="t(`creativeLanding.imageName${i + 1}`)"
                  @click="imageIndex = i"
                ><img :src="img.src" alt="" loading="lazy" /></button>
                <span class="mono">{{ String(imageIndex + 1).padStart(2, '0') }} / {{ String(images.length).padStart(2, '0') }}</span>
              </div>
            </template>
            <iframe
              v-else-if="running"
              :key="`${active}-${version}`"
              :src="src"
              :title="brief.title"
              sandbox="allow-scripts allow-downloads"
              class="pg-frame"
              @load="onFrameLoad"
            ></iframe>
            <button v-else class="pg-cover" :class="`cover-${active}`" type="button" :aria-label="t('creativeLanding.runDemo')" @click="run">
              <span class="pg-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
              <strong>{{ active === 'flow' ? t('creativeLanding.flowStart') : t('creativeLanding.clickToRun') }}</strong>
              <span class="pg-hint">{{ hint }}</span>
            </button>

            <div class="pg-bottom mono">
              <span>{{ active === 'image' ? t('creativeLanding.imageSource') : t('creativeLanding.codeSource') }}</span>
              <span>{{ active === 'image' ? t('creativeLanding.imageMeta') : t('creativeLanding.codeMeta') }}</span>
            </div>
          </div>
        </div>
      </div>
      <p class="fine" data-reveal>{{ t('creativeLanding.playFootnote') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SHOWCASE_DEMOS, SHOWCASE_IMAGES } from '@/utils/tlLanding'

type Demo = 'flow' | 'visual' | 'code' | 'image'

const props = defineProps<{ num: string; paused: boolean }>()
const { t, locale } = useI18n()

const ids: Demo[] = ['flow', 'visual', 'code', 'image']
const tabs = computed(() => ids.map((id) => ({ id, title: t(`creativeLanding.tabs.${id}`) })))
const images = SHOWCASE_IMAGES
const files: Record<Demo, string> = {
  flow: 'your_very_own_aurora.html',
  visual: 'a_little_universe.html',
  code: 'one_prompt_one_game.html',
  image: 'imagination.png',
}

const active = ref<Demo>('flow')
const running = ref(false)
const version = ref(0)
const imageIndex = ref(0)

const lang = computed(() => (String(locale.value).startsWith('zh') ? 'zh' : 'en'))
const brief = computed(() => ({
  title: t(`creativeLanding.${active.value}.title`),
  description: t(`creativeLanding.${active.value}.description`),
  prompt: t(`creativeLanding.${active.value}.prompt`),
}))
const file = computed(() => files[active.value])
const src = computed(() =>
  active.value === 'flow'
    ? `/showcase/aurora-canvas.html?lang=${lang.value}`
    : active.value === 'visual'
      ? SHOWCASE_DEMOS.gpt.src
      : SHOWCASE_DEMOS.claude.src,
)
const hint = computed(() =>
  active.value === 'flow'
    ? t('creativeLanding.flowHint')
    : active.value === 'visual'
      ? t('creativeLanding.visualHint')
      : t('creativeLanding.codeHint'),
)

function select(id: Demo) {
  active.value = id
  running.value = false
}
function run() {
  version.value++
  running.value = true
}
function onFrameLoad(e: Event) {
  if (active.value === 'code') (e.target as HTMLIFrameElement).focus()
}
function onKey(e: KeyboardEvent, id: Demo) {
  let i = ids.indexOf(id)
  if (e.key === 'ArrowRight') i = (i + 1) % ids.length
  else if (e.key === 'ArrowLeft') i = (i + ids.length - 1) % ids.length
  else if (e.key === 'Home') i = 0
  else if (e.key === 'End') i = ids.length - 1
  else return
  e.preventDefault()
  select(ids[i])
  document.getElementById(`pg-tab-${ids[i]}`)?.focus()
}

watch(
  () => props.paused,
  (p) => {
    if (p) running.value = false
  },
)
</script>
