<template>
  <div
    ref="root"
    class="liberty"
    :lang="isZh ? 'zh-CN' : 'en'"
    :class="{ 'motion-paused': paused }"
  >
    <div
      class="reading-progress"
      :style="{ transform: `scaleX(${scrollProgress})` }"
      aria-hidden="true"
    ></div>
    <header class="site-header">
      <div class="header-inner shell">
        <router-link to="/home" class="wordmark" :aria-label="siteName">
          <img v-if="siteLogo" :src="siteLogo" :alt="siteName" class="brand-logo" />
          <svg v-else viewBox="0 0 32 32" aria-hidden="true">
            <path
              d="M6 4h9L9 20H0L6 4Zm17 8h9l-6 16h-9l6-16ZM17 4h9L15 28H6L17 4Z"
              fill="currentColor"
            />
          </svg>
          <span>{{ siteName }}<span class="brand-dot" aria-hidden="true">.</span></span>
        </router-link>
        <nav class="desktop-nav" :aria-label="c.navigation">
          <a href="#playground">{{ c.playground }}</a>
          <a href="#possibilities">{{ c.possibilities }}</a>
          <a href="#connect">{{ c.developers }}</a>
          <router-link v-if="showModelPlazaEntry" to="/model-plaza">{{ c.modelPlaza }}</router-link>
        </nav>
        <div class="header-actions">
          <button
            class="language-button"
            type="button"
            @click="toggleLanguage"
            :aria-label="c.switchLanguage"
          >
            {{ c.languageLabel }}<span aria-hidden="true">↗</span>
          </button>
          <router-link
            :to="isAuthenticated ? dashboardPath : '/login'"
            class="nav-console"
            >{{ isAuthenticated ? c.console : c.login }}
            <span aria-hidden="true">↗</span></router-link
          >
        </div>
      </div>
    </header>

    <main>
      <section
        class="universe globe-universe"
        :class="{ paused }"
        aria-labelledby="hero-title"
        @pointermove="onHeroMove"
        @pointerleave="onHeroLeave"
      >
        <div class="universe-stars" aria-hidden="true"></div>
        <div class="universe-stage shell">
          <HeroGlobe :paused="paused" />
          <span
            v-for="ring in universeRings"
            :key="ring.id"
            class="universe-ring"
            :class="`ring-${ring.id}`"
            aria-hidden="true"
          ></span>
          <div class="universe-core">
            <a href="#playground" class="announcement"
              ><span class="status-dot"></span>{{ c.announcement
              }}<span aria-hidden="true">↗</span></a
            >
            <h1 id="hero-title">
              {{ c.title1 }}<br /><span class="hero-accent"
                >{{ c.title2
                }}<svg
                  viewBox="0 0 360 17"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M3 12Q170 -4 357 8M25 16Q175 3 331 13" /></svg
              ></span>
            </h1>
            <p class="hero-description">
              <span>{{ c.description1 }}</span>
              <span>{{ c.description2 }}</span>
            </p>
            <div class="hero-actions">
              <router-link :to="startPath" class="button button-dark"
                >{{ c.start }} <span aria-hidden="true">↗</span></router-link
              >
              <a href="#playground" class="button button-text"
                ><svg class="hero-play-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m10 8 6 4-6 4V8Z" />
                </svg>{{ c.tryDemo }}</a
              >
            </div>
            <ul class="universe-points">
              <li><span class="point-dot" aria-hidden="true"></span>{{ c.pointDirect }}</li>
              <li>
                <svg class="point-check" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m3.5 8 3 3 6-6" />
                </svg>{{ c.pointNoLimit }}
              </li>
            </ul>
          </div>
          <template v-for="ring in universeRings" :key="`items-${ring.id}`">
            <div
              v-for="item in ring.items"
              :key="item.id"
              class="uni-chip"
              :class="[`ring-${ring.id}`, { supported: item.supported }]"
              :style="{ '--x-delay': item.xDelay, '--y-delay': item.yDelay, '--i': item.idx }"
              aria-hidden="true"
            >
              <div class="uni-x">
                <div class="uni-y">
                  <div class="uni-badge uni-depth">
                    <span class="uni-icon" :style="{ '--tone': item.tone }"
                      ><PlatformIcon :platform="item.platform as GroupPlatform" size="lg"
                    /></span>
                    <span class="uni-name">{{ item.label }}</span>
                    <span v-if="item.supported" class="uni-tip"
                      ><b>{{ item.label }}</b
                      >{{ c.pointDirect }} · {{ c.pointNoLimit }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
            <div
              v-for="dot in ring.dots"
              :key="dot.id"
              class="uni-chip uni-comet"
              :class="`ring-${ring.id}`"
              :style="{ '--x-delay': dot.xDelay, '--y-delay': dot.yDelay, '--k': dot.k }"
              aria-hidden="true"
            >
              <div class="uni-x">
                <div class="uni-y"><i class="comet-dot"></i></div>
              </div>
            </div>
          </template>
        </div>
        <ol class="universe-timeline" :aria-label="isZh ? 'AI 发展时间线' : 'AI timeline'">
          <li
            v-for="n in timeline"
            :key="n.year"
            :style="{ '--dx': n.dx, '--drop': n.drop }"
          >
            <i aria-hidden="true"></i>
            <b>{{ n.year }}</b>
            <span>{{ n.text }}</span>
            <em v-if="n.note">{{ n.note }}</em>
          </li>
        </ol>
        <p class="sr-only">{{ c.universeSr }}</p>
      </section>

      <section id="playground" class="playground-section shell section-space">
        <div class="section-heading" data-reveal>
          <div>
            <p class="eyebrow">
              <span class="section-number">01 /</span> {{ c.playEyebrow }}
            </p>
            <h2>
              {{ c.playTitle1
              }}<span class="serif-word">{{ c.playTitle2 }}</span
              ><span class="violet-dot">.</span>
            </h2>
          </div>
          <p class="section-description">
            {{ c.playDescription }}<br />{{ c.playDescription2 }}
          </p>
        </div>
        <div class="studio" data-reveal>
          <div class="studio-toolbar">
            <div class="studio-tabs" role="tablist" :aria-label="c.demoLabel">
              <button
                v-for="tab in tabs"
                :id="`tab-${tab.id}`"
                :key="tab.id"
                type="button"
                role="tab"
                :aria-selected="activeDemo === tab.id"
                :aria-controls="`panel-${tab.id}`"
                :tabindex="activeDemo === tab.id ? 0 : -1"
                :class="{ selected: activeDemo === tab.id }"
                @click="selectDemo(tab.id)"
                @keydown="navigateTabs($event, tab.id)"
              >
                <span aria-hidden="true">{{ tab.icon }}</span
                >{{ tab.title }}
              </button>
            </div>
            <span class="studio-tag"
              ><span class="live-dot"></span>{{ c.inBrowser }}</span
            >
          </div>
          <div
            :id="`panel-${activeDemo}`"
            class="studio-body"
            role="tabpanel"
            :aria-labelledby="`tab-${activeDemo}`"
          >
            <aside class="studio-brief">
              <div class="brief-topline">
                <span class="small-label"
                  >PROMPT /
                  {{
                    String(
                      tabs.findIndex((tab) => tab.id === activeDemo) + 1
                    ).padStart(3, '0')
                  }}</span
                ><span class="brief-star" aria-hidden="true">✳</span>
              </div>
              <h3>{{ currentDemo.title }}</h3>
              <p class="brief-description">{{ currentDemo.description }}</p>
              <div class="prompt-card">
                <span class="small-label">{{ c.promptLabel }}</span>
                <p>{{ currentDemo.prompt }}</p>
                <span class="prompt-cursor" aria-hidden="true"></span>
              </div>
              <div class="demo-meta">
                <span>{{
                  activeDemo === 'flow' ? c.conceptLabel : c.createdWith
                }}</span
                ><strong>{{ currentDemo.model }}</strong>
              </div>
              <button
                class="button button-violet demo-run"
                type="button"
                @click="runDemo"
              >
                {{ demoRunning ? c.restartDemo : c.runDemo
                }}<span aria-hidden="true">↗</span>
              </button>
              <p class="demo-disclaimer">{{ c.demoDisclaimer }}</p>
            </aside>
            <div class="studio-preview" :class="`preview-${activeDemo}`">
              <div class="preview-topline">
                <span><i></i><i></i><i></i></span
                ><span>{{ currentDemo.file }}</span
                ><button
                  v-if="demoRunning"
                  type="button"
                  class="preview-stop"
                  @click="demoRunning = false"
                  :aria-label="c.stopDemo"
                >
                  ■</button
                ><span v-else>↗</span>
              </div>
              <template v-if="activeDemo === 'image'">
                <div class="image-preview">
                  <img :src="selectedImage.src" :alt="c.imageDescriptions[imageIndex]" />
                  <div class="image-overlay">
                    <span>{{ c.imageMeta }}</span
                    ><strong>{{ c.imageNames[imageIndex] }}</strong>
                  </div>
                </div>
                <div
                  class="image-picker"
                  role="group"
                  :aria-label="c.selectImage"
                >
                  <button
                    v-for="(image, i) in images"
                    :key="image.src"
                    type="button"
                    :class="{ active: imageIndex === i }"
                    :aria-pressed="imageIndex === i"
                    :aria-label="c.imageNames[i]"
                    @click="imageIndex = i"
                  >
                    <img :src="image.src" :alt="c.imageNames[i]" /></button
                  ><span
                    >{{ String(imageIndex + 1).padStart(2, '0') }} / 04</span
                  >
                </div>
              </template>
              <iframe
                v-else-if="demoRunning"
                :key="`${activeDemo}-${demoVersion}`"
                :src="currentDemo.src"
                :title="currentDemo.title"
                sandbox="allow-scripts allow-downloads"
                class="demo-iframe"
                @load="focusGame"
              ></iframe>
              <button
                v-else
                class="demo-cover"
                type="button"
                @click="runDemo"
                :aria-label="c.runDemo"
              >
                <div
                  v-if="activeDemo === 'flow'"
                  class="aurora-cover"
                  aria-hidden="true"
                >
                  <i></i><i></i><i></i>
                </div>
                <div
                  v-else-if="activeDemo === 'visual'"
                  class="nebula-cover"
                  aria-hidden="true"
                >
                  <div v-for="i in 7" :key="i" :style="{ '--ring': i }"></div>
                  <span>✦</span>
                </div>
                <div v-else class="snake-cover" aria-hidden="true">
                  <span
                    v-for="i in 9"
                    :key="i"
                    :style="{ '--segment': i }"
                  ></span
                  ><i></i>
                </div>
                <span class="cover-play">▷</span
                ><strong>{{
                  activeDemo === 'flow' ? c.flowStart : c.clickToRun
                }}</strong
                ><span class="cover-caption">{{
                  activeDemo === 'flow'
                    ? c.flowHint
                    : activeDemo === 'visual'
                      ? c.visualHint
                      : c.codeHint
                }}</span>
              </button>
              <div class="preview-bottomline">
                <span>{{
                  activeDemo === 'image' ? c.imageSource : c.codeSource
                }}</span
                ><span
                  >{{ activeDemo === 'image' ? c.imageMeta : c.codeMeta }}
                  <span aria-hidden="true">↗</span></span
                >
              </div>
            </div>
          </div>
        </div>
        <div class="playground-footnote">
          <span>✧ {{ c.playFootnote }}</span
          ><button type="button" @click="paused = !paused">
            {{ paused ? c.resumeMotion : c.pauseMotion }}
            <span aria-hidden="true">{{ paused ? '▷' : 'Ⅱ' }}</span>
          </button>
        </div>
      </section>

      <section
        id="possibilities"
        class="possibilities-section shell section-space"
      >
        <div class="section-heading" data-reveal>
          <div>
            <p class="eyebrow">
              <span class="section-number">02 /</span> {{ c.possEyebrow }}
            </p>
            <h2>
              {{ c.possTitle1 }}<br />{{ c.possTitle2
              }}<span class="violet-dot">↗</span>
            </h2>
          </div>
          <p class="section-description">{{ c.possDescription }}</p>
        </div>
        <div class="creation-grid">
          <article class="creation-card creation-city" data-reveal>
            <img
              src="/showcase/city.jpg"
              :alt="c.imageNames[0]"
              loading="lazy"
            />
            <div class="creation-overlay">
              <span class="creation-tag">01 — IMAGINE</span>
              <h3>{{ c.imageNames[0] }}</h3>
              <p>
                {{ c.imageMeta }}
              </p>
            </div>
            <button
              type="button"
              class="card-expand"
              :aria-label="c.viewImage"
              @click="openImage(0)"
            >
              ↗
            </button>
          </article>
          <article class="creation-card creation-product" data-reveal>
            <img
              src="/showcase/product.jpg"
              :alt="c.imageNames[1]"
              loading="lazy"
            />
            <div class="creation-overlay">
              <span class="creation-tag">02 — DESIGN</span>
              <h3>{{ c.imageNames[1] }}</h3>
              <p>
                {{ c.imageMeta }}
              </p>
            </div>
            <button
              type="button"
              class="card-expand"
              :aria-label="c.viewImage"
              @click="openImage(1)"
            >
              ↗
            </button>
          </article>
          <article class="creation-card creation-ink" data-reveal>
            <img
              src="/showcase/ink.jpg"
              :alt="c.imageNames[2]"
              loading="lazy"
            />
            <div class="creation-overlay">
              <span class="creation-tag">03 — REIMAGINE</span>
              <h3>{{ c.imageNames[2] }}</h3>
              <p>
                {{ c.imageMeta }}
              </p>
            </div>
            <button
              type="button"
              class="card-expand"
              :aria-label="c.viewImage"
              @click="openImage(2)"
            >
              ↗
            </button>
          </article>
        </div>
        <p class="gallery-note">{{ c.galleryNote }}</p>
      </section>

      <section id="connect" class="connect-section section-space">
        <div class="shell" data-reveal>
          <div class="connect-heading">
          <div class="connect-copy">
            <p class="eyebrow">
              <span class="section-number">03 /</span> {{ c.connectEyebrow }}
            </p>
            <h2>
              {{ c.connectTitle1 }}<span>{{ c.connectTitle2 }}</span>
            </h2>
          </div>
          <div class="connect-intro">
            <p>{{ c.connectDescription }}</p>
            <div class="connect-points">
              <span>✓ {{ c.connectPoint1 }}</span
              ><span>✓ {{ c.connectPoint2 }}</span
              ><span v-if="showPurchase">✓ {{ c.connectPoint3 }}</span>
            </div>
          </div>
          </div>
          <div class="connect-grid">
          <div class="connect-start">
            <p class="connect-label">{{ t('creativeLanding.quickstart') }}</p>
            <ol class="connect-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>{{ t('creativeLanding.stepKey') }}</h3>
                  <p>{{ t('creativeLanding.stepKeyNote') }}</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>{{ t('creativeLanding.stepTool') }}</h3>
                  <p>{{ t('creativeLanding.stepToolNote') }}</p>
                  <div class="connect-tools">
                    <span>Claude Code</span><span>Codex</span>
                  </div>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>{{ t('creativeLanding.stepRequest') }}</h3>
                  <p>{{ t('creativeLanding.stepRequestNote') }}</p>
                </div>
              </li>
            </ol>
            <router-link :to="docPath" class="button connect-doc-link"
              >{{ c.readDocs }} <span aria-hidden="true">↗</span></router-link
            >
          </div>
          <div class="code-window">
            <div class="code-window-header">
              <div class="code-tabs" role="group" :aria-label="t('creativeLanding.codeToolSwitch')">
                <button
                  v-for="tool in codeTools"
                  :key="tool.id"
                  type="button"
                  :class="{ active: codeTool === tool.id }"
                  :aria-pressed="codeTool === tool.id"
                  @click="codeTool = tool.id"
                >
                  <span aria-hidden="true">{{ tool.icon }}</span> {{ tool.label }}
                </button>
              </div>
              <button type="button" @click="copyCode" :aria-label="c.copyCode">
                {{
                  copyState === 'copied'
                    ? '✓ ' + c.copied
                    : copyState === 'error'
                      ? c.copyFailed
                      : '⧉ ' + c.copy
                }}
              </button>
            </div>
            <pre><code>{{ code }}</code></pre>
            <div class="code-window-footer">
              <span class="live-dot"></span>{{ c.codeFooter
              }}<span>{{ activeCodeTool.label }}</span>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section class="closing-section shell" data-reveal>
        <p class="eyebrow">{{ c.closingEyebrow }}</p>
        <h2>
          {{ c.closingTitle
          }}<span class="closing-star" aria-hidden="true">✳</span>
        </h2>
        <div class="closing-bottom">
          <p>{{ c.closingDescription }}</p>
          <router-link :to="startPath" class="button button-violet"
            >{{ c.start }}<span aria-hidden="true">↗</span></router-link
          >
        </div>
        <div class="closing-watermark" aria-hidden="true">{{ siteName }}</div>
      </section>
    </main>

    <footer class="site-footer shell">
      <router-link to="/home" class="footer-brand"
        >{{ siteName }}</router-link
      ><span class="copyright"
        >© {{ year }} {{ siteName }}. {{ c.footerTagline }}</span
      >
      <div>
        <router-link v-if="showPurchase" to="/purchase">{{ c.pricing }}</router-link
        ><router-link :to="docPath">{{ c.readDocs }}</router-link
        ><router-link :to="isAuthenticated ? dashboardPath : '/login'"
          >{{ c.console }} ↗</router-link
        >
      </div>
    </footer>
    <dialog
      ref="imageDialog"
      class="image-dialog"
      :aria-label="c.viewImage"
      @click="closeImageOnBackdrop"
    >
      <button
        type="button"
        class="dialog-close"
        @click="imageDialog?.close()"
        :aria-label="c.close"
      >
        ×</button
      ><img
        :src="images[lightboxIndex].src"
        :alt="c.imageNames[lightboxIndex]"
      />
      <div>
        <span>{{ c.imageNames[lightboxIndex] }}</span
        ><span>{{ c.imageMeta }}</span>
      </div>
      <p>{{ c.imageDescriptions[lightboxIndex] }}</p>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import { setLocale } from '@/i18n'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import {
  SHOWCASE_IMAGES,
  SHOWCASE_DEMOS,
  resolveLandingApiBase,
  LANDING_DOC_PATH,
} from '@/utils/tlLanding'
import type { GroupPlatform } from '@/types'
import PlatformIcon from '@/components/common/PlatformIcon.vue'
import HeroGlobe from '@/components/common/HeroGlobe.vue'

const { locale, t } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()
const siteName = computed(
  () =>
    appStore.cachedPublicSettings?.site_name ||
    appStore.siteName ||
    'Sub2API'
)
const docPath = LANDING_DOC_PATH
const apiBase = computed(() => resolveLandingApiBase(appStore.cachedPublicSettings?.api_base_url, window.location.origin))
const siteLogo = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }))
const showModelPlazaEntry = computed(() => isFeatureFlagEnabled(FeatureFlags.modelPlaza) && (authStore.isAuthenticated || appStore.cachedPublicSettings?.model_plaza_require_auth !== true))
const showPurchase = computed(() => isFeatureFlagEnabled(FeatureFlags.payment))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const dashboardPath = computed(() =>
  authStore.isAdmin ? '/admin/dashboard' : '/dashboard'
)
const startPath = computed(() =>
  isAuthenticated.value
    ? dashboardPath.value
    : appStore.cachedPublicSettings?.registration_enabled === false
      ? '/login'
      : '/register'
)
const isZh = computed(() => String(locale.value).startsWith('zh'))
const year = new Date().getFullYear()
const images = SHOWCASE_IMAGES

const root = ref<HTMLElement>()
const paused = ref(false)
const scrollProgress = ref(0)
const imageIndex = ref(0)
const selectedImage = computed(() => images[imageIndex.value])
type Demo = 'flow' | 'visual' | 'code' | 'image'
const activeDemo = ref<Demo>('flow')
const demoRunning = ref(false)
const demoVersion = ref(0)
const imageDialog = ref<HTMLDialogElement>()
const lightboxIndex = ref(0)
const copyState = ref<'idle' | 'copied' | 'error'>('idle')
let copyTimer: ReturnType<typeof setTimeout> | undefined
let revealObserver: IntersectionObserver | undefined
function focusGame(event: Event) {
  if (activeDemo.value === 'code') (event.target as HTMLIFrameElement).focus()
}

const c = computed(() => ({
    navigation: t('creativeLanding.navigation'),
    playground: t('creativeLanding.playground'),
    possibilities: t('creativeLanding.possibilities'),
    developers: t('creativeLanding.developers'),
    switchLanguage: t('creativeLanding.switchLanguage'),
    login: t('creativeLanding.login'),
    console: t('creativeLanding.console'),
    announcement: t('creativeLanding.announcement'),
    title1: t('creativeLanding.title1'),
    title2: t('creativeLanding.title2'),
    description1: t('creativeLanding.description1'),
    description2: t('creativeLanding.description2'),
    start: t('creativeLanding.start'),
    tryDemo: t('creativeLanding.tryDemo'),
    heroNote: t('creativeLanding.heroNote'),
    responseLabel: t('creativeLanding.responseLabel'),
    responseText: t('creativeLanding.responseText'),
    sculptureLabel: t('creativeLanding.sculptureLabel'),
    shapeLabel: t('creativeLanding.shapeLabel'),
    shapes: [
      t('creativeLanding.shape1'),
      t('creativeLanding.shape2'),
      t('creativeLanding.shape3')
    ],
    interactive: t('creativeLanding.interactive'),
    compatibility: t('creativeLanding.compatibility'),
    poweredBy: t('creativeLanding.poweredBy'),
    playTitle1: t('creativeLanding.playTitle1'),
    playTitle2: t('creativeLanding.playTitle2'),
    playDescription: t('creativeLanding.playDescription'),
    playDescription2: t('creativeLanding.playDescription2'),
    demoLabel: t('creativeLanding.demoLabel'),
    inBrowser: t('creativeLanding.inBrowser'),
    promptLabel: t('creativeLanding.promptLabel'),
    createdWith: t('creativeLanding.createdWith'),
    runDemo: t('creativeLanding.runDemo'),
    restartDemo: t('creativeLanding.restartDemo'),
    stopDemo: t('creativeLanding.stopDemo'),
    demoDisclaimer: t('creativeLanding.demoDisclaimer'),
    clickToRun: t('creativeLanding.clickToRun'),
    visualHint: t('creativeLanding.visualHint'),
    codeHint: t('creativeLanding.codeHint'),
    imageSource: t('creativeLanding.imageSource'),
    codeSource: t('creativeLanding.codeSource'),
    selectImage: t('creativeLanding.selectImage'),
    imageNames: [
      t('creativeLanding.imageName1'),
      t('creativeLanding.imageName2'),
      t('creativeLanding.imageName3'),
      t('creativeLanding.imageName4')
    ],
    flowStart: t('creativeLanding.flowStart'),
    flowHint: t('creativeLanding.flowHint'),
    flow: {
      title: t('creativeLanding.flow.title'),
      description: t('creativeLanding.flow.description'),
      prompt: t('creativeLanding.flow.prompt')
    },
    playFootnote: t('creativeLanding.playFootnote'),
    pauseMotion: t('creativeLanding.pauseMotion'),
    resumeMotion: t('creativeLanding.resumeMotion'),
    possTitle1: t('creativeLanding.possTitle1'),
    possTitle2: t('creativeLanding.possTitle2'),
    possDescription: t('creativeLanding.possDescription'),
    viewImage: t('creativeLanding.viewImage'),
    galleryNote: t('creativeLanding.galleryNote'),
    connectTitle1: t('creativeLanding.connectTitle1'),
    connectTitle2: t('creativeLanding.connectTitle2'),
    connectDescription: t('creativeLanding.connectDescription'),
    connectPoint1: t('creativeLanding.connectPoint1'),
    connectPoint2: t('creativeLanding.connectPoint2'),
    connectPoint3: t('creativeLanding.connectPoint3'),
    readDocs: t('creativeLanding.readDocs'),
    copyCode: t('creativeLanding.copyCode'),
    orbitImage: t('creativeLanding.orbitImage'),
    universeEyebrow: t('creativeLanding.universeEyebrow'),
    universeTitle: t('creativeLanding.universeTitle'),
    universeDesc: t('creativeLanding.universeDesc'),
    universeOn: t('creativeLanding.universeOn'),

    universeSr: t('creativeLanding.universeSr'),
    pointDirect: t('creativeLanding.pointDirect'),
    pointNoLimit: t('creativeLanding.pointNoLimit'),
    curlHint: t('creativeLanding.curlHint'),
    copied: t('creativeLanding.copied'),
    copy: t('creativeLanding.copy'),
    copyFailed: t('creativeLanding.copyFailed'),
    codeComment: t('creativeLanding.codeComment'),
    codeFooter: t('creativeLanding.codeFooter'),
    closingTitle: t('creativeLanding.closingTitle'),
    closingDescription: t('creativeLanding.closingDescription'),
    footerTagline: t('creativeLanding.footerTagline'),
    pricing: t('creativeLanding.pricing'),
    close: t('creativeLanding.close'),
    visual: {
      title: t('creativeLanding.visual.title'),
      description: t('creativeLanding.visual.description'),
      prompt: t('creativeLanding.visual.prompt')
    },
    code: {
      title: t('creativeLanding.code.title'),
      description: t('creativeLanding.code.description'),
      prompt: t('creativeLanding.code.prompt')
    },
    image: {
      title: t('creativeLanding.image.title'),
      description: t('creativeLanding.image.description'),
      prompt: t('creativeLanding.image.prompt')
    },
    codeMeta: t('creativeLanding.codeMeta'),
    imageMeta: t('creativeLanding.imageMeta'),
    languageLabel: t('creativeLanding.languageLabel'),
    modelPlaza: t('creativeLanding.modelPlaza'),
    tabs: {
      flow: t('creativeLanding.tabs.flow'),
      visual: t('creativeLanding.tabs.visual'),
      code: t('creativeLanding.tabs.code'),
      image: t('creativeLanding.tabs.image')
    },
    artCaption: t('creativeLanding.artCaption'),
    playEyebrow: t('creativeLanding.playEyebrow'),
    possEyebrow: t('creativeLanding.possEyebrow'),
    connectEyebrow: t('creativeLanding.connectEyebrow'),
    closingEyebrow: t('creativeLanding.closingEyebrow'),
    conceptLabel: t('creativeLanding.conceptLabel'),
    imageDescriptions: [
      t('creativeLanding.imageDescription1'),
      t('creativeLanding.imageDescription2'),
      t('creativeLanding.imageDescription3'),
      t('creativeLanding.imageDescription4')
    ]
  }))
const tabs = computed(() => [
  {
    id: 'flow' as const,
    title: c.value.tabs.flow,
    icon: '〰',
  },
  {
    id: 'visual' as const,
    title: c.value.tabs.visual,
    icon: '✧',
  },
  {
    id: 'code' as const,
    title: c.value.tabs.code,
    icon: '⌘',
  },
  {
    id: 'image' as const,
    title: c.value.tabs.image,
    icon: '▧',
  },
])
const currentDemo = computed(() => ({
  ...c.value[activeDemo.value],
  model:
    activeDemo.value === 'flow'
      ? siteName.value + ' Lab'
      : activeDemo.value === 'visual'
        ? c.value.codeMeta
        : activeDemo.value === 'code'
          ? c.value.codeMeta
          : c.value.imageMeta,
  src:
    activeDemo.value === 'flow'
      ? `/showcase/aurora-canvas.html?lang=${isZh.value ? 'zh' : 'en'}`
      : activeDemo.value === 'visual'
        ? SHOWCASE_DEMOS.gpt.src
        : SHOWCASE_DEMOS.claude.src,
  file:
    activeDemo.value === 'flow'
      ? 'your_very_own_aurora.html'
      : activeDemo.value === 'visual'
        ? 'a_little_universe.html'
        : activeDemo.value === 'code'
          ? 'one_prompt_one_game.html'
          : 'imagination.png',
}))
function toggleLanguage() {
  setLocale(isZh.value ? 'en' : 'zh')
}
function selectDemo(id: Demo) {
  activeDemo.value = id
  demoRunning.value = false
}
function runDemo() {
  demoVersion.value++
  demoRunning.value = true
}
function navigateTabs(event: KeyboardEvent, id: Demo) {
  const ids: Demo[] = tabs.value.map((tab) => tab.id)
  let index = ids.indexOf(id)
  if (event.key === 'ArrowRight') index = (index + 1) % ids.length
  else if (event.key === 'ArrowLeft')
    index = (index + ids.length - 1) % ids.length
  else if (event.key === 'Home') index = 0
  else if (event.key === 'End') index = ids.length - 1
  else return
  event.preventDefault()
  selectDemo(ids[index])
  document.getElementById(`tab-${ids[index]}`)?.focus()
}
function openImage(index: number) {
  lightboxIndex.value = index
  imageDialog.value?.showModal()
}
function closeImageOnBackdrop(event: MouseEvent) {
  if (event.target !== imageDialog.value) return
  const rect = imageDialog.value.getBoundingClientRect()
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    imageDialog.value.close()
}
const timeline = computed(() => {
  const zh = isZh.value
  const rows: [string, string, string, string, string][] = [
    ['2017', 'Transformer 架构提出', 'Transformer architecture', '', ''],
    ['2018', 'GPT-1 与 BERT 发布', 'GPT-1 and BERT released', '', ''],
    ['2020', 'GPT-3 发布', 'GPT-3 released', '', ''],
    ['2022', 'ChatGPT 发布', 'ChatGPT launched', '', ''],
    ['2023', 'GPT-4 与 Claude 发布', 'GPT-4 and Claude released', '', ''],
    ['2024', 'Claude 3 系列发布', 'Claude 3 family released', 'Opus / Sonnet / Haiku 三档模型同期推出', 'Opus, Sonnet and Haiku tiers launched together'],
    ['2025', 'DeepSeek-R1 开源', 'DeepSeek-R1 open-sourced', '推理模型走向开源', 'Reasoning models go open-source'],
    ['2026', 'Claude Sonnet 4.6 发布', 'Claude Sonnet 4.6 released', '主流模型保持月度级迭代', 'Leading models keep iterating monthly'],
  ]
  return rows.map(([year, a, b, na, nb], i) => {
    const dx = (i - 3.5) * 12
    return { year, text: zh ? a : b, note: zh ? na : nb, dx, drop: Math.round((i - 3.5) * (i - 3.5) * 2.6) }
  })
})
const universeRings = computed(() => {
  const mk = (id: string, platform: string, label: string, tone: string, supported: boolean) => ({ id, platform, label, tone, supported })
  const defs = [
    { id: 'inner', full: 20, dir: 1, items: [] as ReturnType<typeof mk>[] },
    {
      id: 'outer',
      full: 36,
      dir: -1,
      items: [
        mk('opus', 'anthropic', 'Claude Opus', '#ff8a4c', true),
        mk('gemini', 'gemini', 'Gemini', '#4d8dff', false),
        mk('astra', 'openai', 'Codex Astra', '#2fe3a8', true),
        mk('deepseek', 'deepseek', 'DeepSeek', '#5b6bff', false),
        mk('sonnet', 'anthropic', 'Claude Sonnet', '#ffa13d', true),
        mk('kimi', 'kimi', 'Kimi', '#38d4ff', false),
        mk('sol', 'openai', 'Codex Sol', '#4aa8ff', true),
        mk('zhipu', 'zhipu', 'GLM', '#1fd1c0', false),
        mk('fabble', 'anthropic', 'Claude Fabble', '#ffd34d', true),
        mk('grok', 'grok', 'Grok', '#f2f4f8', false),
        mk('gpt-image', 'openai', c.value.orbitImage, '#ff6ec7', true),
        mk('minimax', 'minimax', 'MiniMax', '#ff5470', false),
      ],
    },
  ]
  const norm = (v: number, full: number) => ((v % full) + full) % full
  const comets: Record<string, number[]> = { inner: [0], outer: [0, 0.5] }
  let idx = 0
  return defs.map((ring) => ({
    id: ring.id,
    items: ring.items.map((item, i) => {
      const shift = (i * ring.full) / ring.items.length
      return {
        ...item,
        idx: idx++,
        xDelay: `${-shift}s`,
        yDelay: `${-norm(shift + (ring.dir * ring.full) / 4, ring.full)}s`,
      }
    }),
    dots: (comets[ring.id] || []).flatMap((frac, ci) =>
      Array.from({ length: 10 }, (_, k) => {
        const shift = norm(frac * ring.full + ring.full * 0.07 - k * 0.14, ring.full)
        return {
          id: `${ring.id}-c${ci}-${k}`,
          k,
          xDelay: `${-shift}s`,
          yDelay: `${-norm(shift + (ring.dir * ring.full) / 4, ring.full)}s`,
        }
      }),
    ),
  }))
})
function onHeroMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width
  const y = (e.clientY - r.top) / r.height
  el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
  el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
  el.style.setProperty('--px', ((x - 0.5) * 2).toFixed(3))
  el.style.setProperty('--py', ((y - 0.5) * 2).toFixed(3))
}
function onHeroLeave(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  ;['--mx', '--my', '--px', '--py'].forEach((k) => el.style.removeProperty(k))
}
type CodeTool = 'curl' | 'claude' | 'codex'
const codeTool = ref<CodeTool>('curl')
const codeTools = [
  { id: 'curl' as const, label: 'curl', icon: '$' },
  { id: 'claude' as const, label: 'Claude Code', icon: '✳' },
  { id: 'codex' as const, label: 'Codex', icon: '⌘' },
]
const activeCodeTool = computed(() => codeTools.find((tool) => tool.id === codeTool.value)!)
const code = computed(() => {
  const root = apiBase.value.replace(/\/v1$/, '')
  if (codeTool.value === 'curl')
    return [
      '# ' + c.value.codeComment,
      `curl ${apiBase.value}/responses \\`,
      '  -H "Authorization: Bearer YOUR_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{"model": "YOUR_ENABLED_MODEL", "input": "Hello, possibility."}\'',
      '',
      '# ' + c.value.curlHint,
    ].join('\n')
  if (codeTool.value === 'claude')
    return [
      '# ' + c.value.codeComment,
      'npm install -g @anthropic-ai/claude-code',
      '',
      `export ANTHROPIC_BASE_URL=${JSON.stringify(root)}`,
      'export ANTHROPIC_AUTH_TOKEN="YOUR_API_KEY"',
      'export ANTHROPIC_MODEL="YOUR_ENABLED_MODEL"',
      '',
      'claude',
    ].join('\n')
  return [
    '# ~/.codex/config.toml',
    'model_provider = "custom_gateway"',
    'model = "YOUR_ENABLED_MODEL"',
    '',
    '[model_providers.custom_gateway]',
    `name = ${JSON.stringify(siteName.value)}`,
    `base_url = ${JSON.stringify(apiBase.value)}`,
    'env_key = "CUSTOM_API_KEY"',
    'wire_api = "responses"',
    '',
    '# export CUSTOM_API_KEY="YOUR_API_KEY"',
    '# codex',
  ].join('\n')
})
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'error'
  }
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copyState.value = 'idle'
  }, 2500)
}
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  scrollProgress.value =
    scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
}
watch(paused, async (value) => {
  await nextTick()
  // Keep revealed content visible while decorative animations are paused.
  root.value
    ?.querySelectorAll<HTMLElement>('[data-reveal]')
    .forEach((el) => el.classList.add('revealed'))
  if (value) demoRunning.value = false
})
onMounted(() => {
  const elements = root.value?.querySelectorAll('[data-reveal]') || []
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    elements.forEach((el) => el.classList.add('revealed'))
  else {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            revealObserver?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 }
    )
    elements.forEach((el) => revealObserver?.observe(el))
  }
  window.addEventListener('scroll', updateProgress, { passive: true })
  updateProgress()
})
onBeforeUnmount(() => {
  revealObserver?.disconnect()
  clearTimeout(copyTimer)
  window.removeEventListener('scroll', updateProgress)
})
</script>

<style scoped src="./token-liberty-landing.css"></style>
