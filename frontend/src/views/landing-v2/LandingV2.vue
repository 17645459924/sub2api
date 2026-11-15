<template>
  <div class="lv" :data-theme="dark ? 'dark' : 'light'" :class="{ 'motion-off': motionOff, 'hero-in': heroIn }" :lang="isZh ? 'zh-CN' : 'en'">
    <IntroSplash
      v-if="splashAlive"
      :site-name="siteName"
      :logo="logoSrc"
      :tagline="t('landingV2.hero.eyebrow')"
      :skip-label="t('landingV2.splash.skip')"
      :disabled="reduceMotion"
      :target="splashTarget"
      @reveal="onSplashReveal"
      @done="onSplashDone"
    />
    <div ref="sentinelEl" class="header-sentinel" aria-hidden="true"></div>
    <header class="site-header" :class="{ 'menu-open': menuOpen, scrolled }">
      <div class="lv-container header-inner">
        <router-link to="/home" class="brand" :aria-label="siteName">
          <img :src="logoSrc" alt="" width="32" height="32" />
          <span>{{ siteName }}</span>
        </router-link>
        <nav class="nav" :class="{ open: menuOpen }" :aria-label="t('landingV2.nav.label')">
          <a href="#quickstart" @click="menuOpen = false">{{ t('landingV2.nav.start') }}</a>
          <a href="#playground" @click="menuOpen = false">{{ t('landingV2.nav.play') }}</a>
          <a href="#models" @click="menuOpen = false">{{ t('landingV2.nav.models') }}</a>

        </nav>
        <div class="header-actions">
          <button class="icon-btn" type="button" :aria-label="t('landingV2.switchLanguage')" @click="toggleLanguage">
            <span>{{ t('landingV2.languageLabel') }}</span>
          </button>
          <button class="icon-btn" type="button" aria-label="theme" @click="dark = !dark">
            <svg v-if="dark" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          </button>
          <router-link v-if="!isAuthenticated" class="link-btn hide-sm" to="/login">{{ t('landingV2.login') }}</router-link>
          <router-link class="btn btn-primary btn-sm" :to="startPath">{{ isAuthenticated ? t('landingV2.console') : t('landingV2.startShort') }}</router-link>
          <button class="icon-btn menu-btn" type="button" :aria-expanded="menuOpen" aria-label="menu" @click="menuOpen = !menuOpen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
    </header>

    <main>
      <section ref="heroEl" class="hero" aria-labelledby="lv-hero-title">
        <canvas ref="canvasEl" class="hero-canvas" aria-hidden="true"></canvas>
        <div class="lv-container hero-inner">
          <div class="hero-copy">
            <p class="lv-eyebrow hero-eyebrow"><i class="pulse-dot"></i>{{ t('landingV2.hero.eyebrow') }}</p>
            <h1 id="lv-hero-title" class="hero-title">
              <span class="line">{{ t('landingV2.hero.title1') }}</span>
              <span class="line lv-grad">{{ t('landingV2.hero.title2') }}</span>
            </h1>
            <p class="hero-sub">
              <span v-if="siteSubtitle">{{ siteSubtitle }}<br /></span>
              <span class="muted">{{ t('landingV2.hero.sub') }}</span>
            </p>
            <button class="url-chip" :class="{ done: urlCopied }" type="button" :aria-label="t('landingV2.hero.copyUrl')" @click="copyUrl">
              <span class="url-key">BASE_URL</span><span class="url-eq">=</span><span class="url-val">{{ baseUrl }}</span>
              <span class="url-copy">{{ urlCopied ? t('landingV2.quickstart.copied') : t('landingV2.hero.copy') }}</span>
            </button>
            <div class="hero-ctas">
              <router-link class="btn btn-primary btn-lg" :to="startPath">
                <span>{{ isAuthenticated ? t('landingV2.console') : t('landingV2.hero.start') }}</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </router-link>
              <a class="btn btn-ghost btn-lg" href="#quickstart">{{ t('landingV2.hero.how') }}</a>
              <button v-if="introVideoUrl" class="btn btn-ghost btn-lg" type="button" @click="openVideo">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>
                <span>{{ t('landingV2.hero.video') }}</span>
              </button>
            </div>
          </div>
          <div ref="visualEl" class="hero-visual">
            <div class="hero-log" data-gateway-log aria-hidden="true">
              <div class="hero-log-head"><i class="pulse-dot"></i><span>{{ t('landingV2.hero.logHead') }}</span></div>
              <ol>
                <li v-for="item in log" :key="item.id"><span>{{ item.ts }}</span><span>POST {{ item.path }}</span><span class="ok">200</span></li>
              </ol>
            </div>
            <p class="hero-hint" aria-hidden="true">{{ t('landingV2.hero.hint') }}</p>
          </div>
        </div>
        <div class="lv-container">
          <ul class="trust" :aria-label="t('landingV2.trust.label')">
            <li v-for="item in trust" :key="item.key" class="trust-item spot" @pointermove="spot">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg>
              <div>
                <b>{{ t(`landingV2.trust.${item.key}`) }}</b><span>{{ t(`landingV2.trust.${item.key}Desc`) }}</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="introVideoUrl" class="video-strip" aria-labelledby="lv-video-title">
        <div class="lv-container video-strip-inner" data-reveal>
          <div class="video-copy">
            <p class="lv-eyebrow"><i class="pulse-dot"></i>{{ t('landingV2.video.card') }}</p>
            <h2 id="lv-video-title" class="video-title">{{ t('landingV2.video.cardTitle') }}</h2>
            <p class="dim">{{ t('landingV2.video.cardDesc') }}</p>
          </div>
          <button class="video-card" type="button" :aria-label="t('landingV2.video.play')" @click="openVideo">
            <img v-if="introVideoPoster" :src="introVideoPoster" alt="" loading="lazy" />
            <span v-else class="video-art" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></span>
            <span class="video-dur mono">{{ t('landingV2.video.duration') }}</span>
          </button>
        </div>
      </section>

      <section id="quickstart" class="section" aria-labelledby="lv-qs-title">
        <div class="lv-container">
          <div class="sec-head" data-reveal>
            <p class="lv-eyebrow"><span class="num">01 /</span> {{ t('landingV2.quickstart.eyebrow') }}</p>
            <h2 id="lv-qs-title" class="lv-h2">{{ t('landingV2.quickstart.title1') }}<span class="lv-grad">{{ t('landingV2.quickstart.title2') }}</span></h2>
          </div>
          <div class="qs-grid">
            <ol class="qs-steps" data-reveal>
              <li v-for="(s, i) in ['s1', 's2', 's3']" :key="s" class="qs-step spot" @pointermove="spot">
                <span class="qs-n">{{ i + 1 }}</span>
                <div>
                  <h3>{{ t(`landingV2.quickstart.${s}`) }}</h3>
                  <p>{{ t(`landingV2.quickstart.${s}d`) }}</p>
                  <div v-if="s === 's2'" class="tool-pills">
                    <button v-for="p in ['claude', 'codex'] as const" :key="p" type="button" class="pill" :class="{ active: codeTool === p }" @click="codeTool = p">
                      {{ p === 'claude' ? 'Claude Code' : 'Codex' }}
                    </button>
                  </div>
                </div>
              </li>
              <li class="qs-doc">
                <router-link class="btn btn-ghost" :to="docPath">
                  <span>{{ t('landingV2.quickstart.docs') }}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                </router-link>
              </li>
            </ol>
            <QuickStartTerminal v-model:tool="codeTool" data-reveal :api-base="apiBase" :site-name="siteName" :animate="!motionOff" :claude-model="claudeModel" />
          </div>
          <div id="faq" class="faq qs-faq" data-reveal :aria-label="t('landingV2.faq.title')">
            <p class="qs-faq-title">{{ t('landingV2.faq.title') }}</p>
            <details v-for="q in ['1', '2', '3', '4']" :key="q" :open="q === '1'">
              <summary>{{ t(`landingV2.faq.q${q}`) }}</summary>
              <div class="ans"><p>{{ t(`landingV2.faq.a${q}`) }}</p></div>
            </details>
          </div>
        </div>
      </section>

      <PlaygroundSection num="02" :paused="motionOff" />

      <section id="models" class="section" aria-labelledby="lv-models-title">
        <div class="lv-container">
          <div class="sec-head" data-reveal>
            <p class="lv-eyebrow"><span class="num">03 /</span> {{ t('landingV2.models.eyebrow') }}</p>
            <h2 id="lv-models-title" class="lv-h2">{{ t('landingV2.models.title1') }}<span class="lv-grad">{{ t('landingV2.models.title2') }}</span></h2>
          </div>
          <div class="models" data-reveal>
            <article v-for="card in modelCards" :key="card.id" class="model" :style="{ '--accent': card.color }">
              <span class="model-beam" aria-hidden="true"></span>
              <div class="model-id">
                <div class="model-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><g stroke-width="3" v-html="card.icon"></g></svg></div>
                <div>
                  <h3>{{ card.title }}</h3>
                  <p>{{ card.desc }}</p>
                </div>
              </div>
              <dl class="model-meta">
                <div><dt>{{ t('landingV2.models.protocol') }}</dt><dd class="mono">{{ card.protocol }}</dd></div>
                <div><dt>{{ t('landingV2.models.endpoint') }}</dt><dd class="mono">{{ card.endpoint }}</dd></div>
                <div><dt>{{ card.extraLabel }}</dt><dd>{{ card.extra }}</dd></div>
              </dl>
              <div v-if="card.names.length" class="model-list" :aria-label="t('landingV2.models.available')">
                <span v-for="n in card.names.slice(0, 4)" :key="n" class="mono">{{ n }}</span>
                <span v-if="card.names.length > 4" class="dim">{{ t('landingV2.models.more', { n: card.names.length - 4 }) }}</span>
              </div>
            </article>
          </div>
          <p class="fine" data-reveal>{{ t('landingV2.models.fine') }}</p>
        </div>
      </section>

      <section v-if="showPricing" id="pricing" class="section" aria-labelledby="lv-pricing-title">
        <div class="lv-container">
          <div class="sec-head" data-reveal>
            <p class="lv-eyebrow"><span class="num">04 /</span> {{ t('landingV2.pricing.eyebrow') }}</p>
            <h2 id="lv-pricing-title" class="lv-h2">{{ t('landingV2.pricing.title1') }}<span class="lv-grad">{{ t('landingV2.pricing.title2') }}</span></h2>
          </div>
          <div class="plans" :class="{ single: !showSubscription }">
            <article class="plan spot" data-reveal @pointermove="spot">
              <p class="plan-k">{{ t('landingV2.pricing.payg') }}</p>
              <p class="dim">{{ t('landingV2.pricing.paygDesc') }}</p>
              <router-link class="btn btn-ghost" to="/model-pricing">{{ t('landingV2.pricing.seePrices') }}</router-link>
            </article>
            <article v-if="showSubscription" class="plan plan-hl spot" data-reveal @pointermove="spot">
              <p class="plan-k">{{ t('landingV2.pricing.plan') }}</p>
              <p class="dim">{{ t('landingV2.pricing.planDesc') }}</p>
              <router-link class="btn btn-primary" to="/purchase">{{ t('landingV2.pricing.seePlans') }}</router-link>
            </article>
          </div>
        </div>
      </section>

      <section class="closing" aria-label="CTA">
        <div class="closing-beam" aria-hidden="true"></div>
        <div class="lv-container closing-inner" data-reveal>
          <p class="closing-line">{{ t('landingV2.closing.sub') }}</p>
          <button class="url-chip closing-url" :class="{ done: urlCopied }" type="button" :aria-label="t('landingV2.hero.copyUrl')" @click="copyUrl">
            <span class="url-key">BASE_URL</span><span class="url-eq">=</span><span class="url-val">{{ baseUrl }}</span>
            <span class="url-copy">{{ urlCopied ? t('landingV2.quickstart.copied') : t('landingV2.hero.copy') }}</span>
          </button>
          <div class="hero-ctas center">
            <router-link class="btn btn-primary btn-lg" :to="startPath">
              <span>{{ isAuthenticated ? t('landingV2.console') : t('landingV2.hero.start') }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </router-link>
            <router-link class="btn btn-ghost btn-lg" :to="docPath">{{ t('landingV2.quickstart.docs') }}</router-link>
          </div>
        </div>
      </section>
    </main>

    <footer class="site-footer">
      <div class="lv-container footer-inner">
        <router-link class="brand" to="/home"><img :src="logoSrc" alt="" width="24" height="24" /><span>{{ siteName }}</span></router-link>
        <span class="dim">© {{ year }} {{ siteName }} · {{ t('landingV2.footer.tagline') }}</span>
        <nav class="footer-nav" :aria-label="t('landingV2.footer.label')">
          <router-link :to="docPath">{{ t('landingV2.footer.docs') }}</router-link>
          <router-link v-if="isAuthenticated" to="/model-pricing">{{ t('landingV2.footer.prices') }}</router-link>
          <router-link :to="isAuthenticated ? dashboardPath : '/login'">{{ t('landingV2.footer.console') }}</router-link>
          <button class="motion-toggle" type="button" :aria-pressed="userPaused" @click="userPaused = !userPaused">
            {{ userPaused ? t('landingV2.motion.resume') : t('landingV2.motion.pause') }}
          </button>
        </nav>
      </div>
    </footer>

    <dialog v-if="introVideoUrl" ref="videoDialog" class="video-dialog" :aria-label="t('landingV2.video.title')" @close="onVideoClose" @click="onDialogClick">
      <div class="video-box">
        <button class="video-close" type="button" :aria-label="t('landingV2.video.close')" @click="closeVideo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <video v-if="videoOpen" ref="videoEl" :src="introVideoUrl" :poster="introVideoPoster || undefined" controls playsinline autoplay preload="none"></video>
      </div>
    </dialog>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore, useAuthStore } from '@/stores'
import { setLocale } from '@/i18n'
import { sanitizeUrl } from '@/utils/url'
import { FeatureFlags, isFeatureFlagEnabled } from '@/utils/featureFlags'
import { resolveLandingApiBase, LANDING_DOC_PATH } from '@/utils/tlLanding'
import type { LandingCodeTool } from '@/utils/landingCode'
import { getModelPlaza } from '@/api/modelPlaza'
import QuickStartTerminal from './QuickStartTerminal.vue'
import PlaygroundSection from './PlaygroundSection.vue'
import IntroSplash from './IntroSplash.vue'
import { useGatewayCanvas, type GatewayNode } from './useGatewayCanvas'
import './landing-v2.css'

const { t, locale } = useI18n()
const appStore = useAppStore()
const authStore = useAuthStore()

const settings = computed(() => appStore.cachedPublicSettings)
const siteName = computed(() => settings.value?.site_name || appStore.siteName || 'Sub2API')
// 站点副标题由后台配置,通常是中文;英文界面下不展示,避免中英混排
const siteSubtitle = computed(() => (isZh.value ? settings.value?.site_subtitle || '' : ''))
const logoSrc = computed(() => sanitizeUrl(settings.value?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }) || '/logo.svg')
const apiBase = computed(() => resolveLandingApiBase(settings.value?.api_base_url, window.location.origin))
const baseUrl = computed(() => apiBase.value.replace(/\/v1$/, ''))
const docPath = LANDING_DOC_PATH
const isAuthenticated = computed(() => authStore.isAuthenticated)
const dashboardPath = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
const startPath = computed(() =>
  isAuthenticated.value ? dashboardPath.value : settings.value?.registration_enabled === false ? '/login' : '/register',
)
// 价格不对访客公开:付费板块仅登录后显示
const showPricing = computed(() => isAuthenticated.value && isFeatureFlagEnabled(FeatureFlags.payment))
const showSubscription = computed(() => isFeatureFlagEnabled(FeatureFlags.subscription))
const isZh = computed(() => String(locale.value).startsWith('zh'))
const year = new Date().getFullYear()

const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
// 进场动画:每次进入首页都播放;减少动效时直接跳过。
// 页面本身始终可见,只是被进场层盖住;Logo 落位、光圈展开的那一刻(reveal)首屏开始入场。
const splashing = ref(!reduceMotion)
const splashAlive = ref(true)
// 首屏入场编排:没有进场动画时挂载即播放,有则等 reveal
const heroIn = ref(!reduceMotion && !splashing.value)
// 最后一道兜底:进场层自己没能收尾(组件出错、没渲染)时,到点强制卸载它并恢复首屏画布。
// 页面内容从不靠样式隐藏,所以即使走到这里,用户看到的也是完整页面而不是空白
let splashGuard: ReturnType<typeof setTimeout> | undefined
function armSplashGuard() {
  splashGuard = setTimeout(() => {
    // 标签页在后台时进场动画并未开始,等用户回来再计时
    if (document.hidden) return armSplashGuard()
    splashAlive.value = false
    splashing.value = false
  }, 12000)
}
if (splashing.value) armSplashGuard()
function onSplashReveal() {
  if (!splashing.value) return
  splashing.value = false
  heroIn.value = true
  gateway.intro()
}
function onSplashDone() {
  clearTimeout(splashGuard)
  onSplashReveal()
}
/** 进场 Logo 的落位点:首屏画布的中心节点;它不在可视范围时(移动端)由进场层退回到顶栏 Logo */
function splashTarget() {
  return gateway.hubPoint()
}
const userPaused = ref(false)
const motionOff = computed(() => reduceMotion || userPaused.value)
const dark = ref(true)
const menuOpen = ref(false)
const codeTool = ref<LandingCodeTool>('claude')

/* ---------- 介绍视频:地址由环境变量提供,未配置则不显示入口 ---------- */
const introVideoUrl = sanitizeUrl(import.meta.env.VITE_LANDING_INTRO_VIDEO_URL || '', { allowRelative: true })
const introVideoPoster = sanitizeUrl(import.meta.env.VITE_LANDING_INTRO_VIDEO_POSTER || '', { allowRelative: true })
const videoDialog = ref<HTMLDialogElement>()
const videoEl = ref<HTMLVideoElement>()
const videoOpen = ref(false)
function openVideo() {
  videoOpen.value = true
  videoDialog.value?.showModal()
}
function closeVideo() {
  videoDialog.value?.close()
}
function onVideoClose() {
  videoEl.value?.pause()
  videoOpen.value = false
}
function onDialogClick(e: MouseEvent) {
  if (e.target === videoDialog.value) closeVideo()
}

function toggleLanguage() {
  void setLocale(isZh.value ? 'en' : 'zh')
}

/* ---------- 首屏画布:工具 → 网关 → 模型 ---------- */
const heroEl = ref<HTMLElement>()
const canvasEl = ref<HTMLCanvasElement>()
const visualEl = ref<HTMLElement>()
const clients = ref<GatewayNode[]>([
  { id: 'cc', label: 'Claude Code', color: '#79f4bd' },
  { id: 'codex', label: 'Codex', color: '#79f4bd' },
  { id: 'curl', label: 'curl', color: '#79f4bd' },
])
const models = computed<GatewayNode[]>(() => [
  { id: 'claude', label: 'Claude', color: '#ff9a5a', path: '/v1/messages' },
  { id: 'gpt', label: 'GPT · Codex', color: '#39d9e7', path: '/v1/responses' },
  { id: 'image', label: t('landingV2.models.image'), color: '#8b7bff', path: '/v1/images/generations' },
])
const focusId = ref<string | null>(null)
const log = ref<{ id: number; ts: string; path: string }[]>([])
let logId = 0
const gateway = useGatewayCanvas({
  canvas: canvasEl,
  host: heroEl,
  visual: visualEl,
  logo: logoSrc.value,
  hubLabel: siteName,
  clients,
  models,
  // 进场动画盖住页面期间不渲染首屏画布,把帧预算留给进场层
  paused: computed(() => motionOff.value || splashing.value),
  dark,
  focusId,
  onRoute: (_c, m) => {
    const d = new Date()
    const ts = [d.getHours(), d.getMinutes(), d.getSeconds()].map((x) => String(x).padStart(2, '0')).join(':')
    log.value = [{ id: ++logId, ts, path: m.path || '' }, ...log.value].slice(0, 5)
  },
})

const trust = [
  { key: 'direct', icon: 'M3 12h4l3-7 4 14 3-7h4' },
  { key: 'noLimit', icon: 'M12 9v4l2.5 2.5M9 2h6M4 13a8 8 0 1 0 16 0 8 8 0 1 0-16 0' },
  { key: 'native', icon: 'm8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16' },
  { key: 'usage', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
]

/* ---------- 复制地址 ---------- */
const urlCopied = ref(false)
let urlTimer: ReturnType<typeof setTimeout> | undefined
async function copyUrl() {
  try {
    await navigator.clipboard.writeText(baseUrl.value)
    urlCopied.value = true
    if (!motionOff.value) gateway.burst(8)
    clearTimeout(urlTimer)
    urlTimer = setTimeout(() => (urlCopied.value = false), 1600)
  } catch {
    urlCopied.value = false
  }
}

/* ---------- 模型清单:只在模型广场可访问时请求,否则只显示能力卡 ---------- */
const plazaNames = ref<Record<string, string[]>>({})
const canLoadPlaza = computed(
  () => isFeatureFlagEnabled(FeatureFlags.modelPlaza) && (isAuthenticated.value || settings.value?.model_plaza_require_auth !== true),
)
let plazaAbort: AbortController | undefined
async function loadPlaza() {
  plazaAbort?.abort()
  if (!canLoadPlaza.value) {
    plazaNames.value = {}
    return
  }
  plazaAbort = new AbortController()
  try {
    const data = await getModelPlaza({ signal: plazaAbort.signal })
    const out: Record<string, Set<string>> = { claude: new Set(), gpt: new Set(), image: new Set() }
    for (const g of data.groups || []) {
      for (const m of g.models || []) {
        const name = m.name
        if (m.platform === 'anthropic') out.claude.add(name)
        else if (/image|dall-e|imagen/i.test(name)) out.image.add(name)
        else if (m.platform === 'openai') out.gpt.add(name)
      }
    }
    plazaNames.value = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, sortModels([...v])]))
  } catch {
    // 请求失败时保留上一次的清单,避免页面上的模型突然消失;首次失败则保持为空
    if (plazaAbort?.signal.aborted) return
  }
}
watch(canLoadPlaza, loadPlaza)

/** 版本号大的在前(claude-sonnet-5-5 排在 claude-sonnet-5 前),名字相同前缀按字母序。 */
function sortModels(names: string[]): string[] {
  const nums = (s: string) => (s.match(/\d+/g) || []).map(Number)
  return names.sort((a, b) => {
    const [x, y] = [nums(a), nums(b)]
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (y[i] ?? -1) - (x[i] ?? -1)
      if (d) return d
    }
    return a.localeCompare(b)
  })
}

/** Claude Code 配置里的示例默认模型:优先最新的 Sonnet(通用、成本适中),没有再取清单第一个。 */
const claudeModel = computed(() => {
  const list = plazaNames.value.claude || []
  return list.find((n) => /sonnet/i.test(n)) || list[0] || ''
})

// 页面重新可见时刷新一次,保证模型清单跟随后台变化
function onVisible() {
  if (document.visibilityState === 'visible') void loadPlaza()
}

const modelCards = computed(() => [
  {
    id: 'claude', title: 'Claude', color: '#ff9a5a', desc: t('landingV2.models.claudeDesc'),
    protocol: 'Anthropic Messages', endpoint: '/v1/messages', extraLabel: t('landingV2.models.tools'), extra: 'Claude Code',
    icon: '<path d="M24 6v36M6 24h36M11 11l26 26M37 11 11 37"/>', names: plazaNames.value.claude || [],
  },
  {
    id: 'gpt', title: 'GPT · Codex', color: '#39d9e7', desc: t('landingV2.models.gptDesc'),
    protocol: 'OpenAI Responses', endpoint: '/v1/responses', extraLabel: t('landingV2.models.tools'), extra: 'Codex · curl',
    icon: '<circle cx="24" cy="24" r="15"/><path d="M16 20l-4 4 4 4M32 20l4 4-4 4M27 16l-6 16"/>', names: plazaNames.value.gpt || [],
  },
  {
    id: 'image', title: t('landingV2.models.image'), color: '#8b7bff', desc: t('landingV2.models.imageDesc'),
    protocol: 'OpenAI Images', endpoint: '/v1/images/generations', extraLabel: t('landingV2.models.entry'), extra: t('landingV2.models.imageEntry'),
    icon: '<rect x="8" y="10" width="32" height="28" rx="5"/><circle cx="18" cy="20" r="3.5"/><path d="m10 34 10-9 7 6 5-4 8 7"/>', names: plazaNames.value.image || [],
  },
])

/* ---------- 指针光斑 ---------- */
const fine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
function spot(e: PointerEvent) {
  if (!fine) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty('--sx', `${e.clientX - r.left}px`)
  el.style.setProperty('--sy', `${e.clientY - r.top}px`)
  // 卡片朝指针方向倾斜的幅度(-1~1);暂停动效时归零
  const off = motionOff.value || !r.width || !r.height
  el.style.setProperty('--tx', off ? '0' : (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3))
  el.style.setProperty('--ty', off ? '0' : (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3))
}

/* ---------- 顶栏:滚动后加底色 ---------- */
const sentinelEl = ref<HTMLElement>()
const scrolled = ref(false)
let headerObserver: IntersectionObserver | undefined

/* ---------- 滚动入场 ---------- */
let revealObserver: IntersectionObserver | undefined
onMounted(() => {
  if (sentinelEl.value && typeof IntersectionObserver !== 'undefined') {
    headerObserver = new IntersectionObserver(([e]) => (scrolled.value = !e.isIntersecting))
    headerObserver.observe(sentinelEl.value)
  }
  loadPlaza()
  document.addEventListener('visibilitychange', onVisible)
  if (heroIn.value) gateway.intro()
  const els = document.querySelectorAll<HTMLElement>('.lv [data-reveal]')
  if (motionOff.value || typeof IntersectionObserver === 'undefined') {
    els.forEach((el) => el.classList.add('in'))
    return
  }
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('in')
        revealObserver?.unobserve(e.target)
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  els.forEach((el) => revealObserver?.observe(el))
})
watch(motionOff, (off) => {
  if (off) document.querySelectorAll<HTMLElement>('.lv [data-reveal]').forEach((el) => el.classList.add('in'))
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  revealObserver?.disconnect()
  headerObserver?.disconnect()
  plazaAbort?.abort()
  clearTimeout(urlTimer)
  clearTimeout(splashGuard)
})
</script>
