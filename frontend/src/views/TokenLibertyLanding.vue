<template>
  <div class="tl" :class="{ 'tl--reduce': reduceMotion }">
    <canvas ref="bgCanvas" class="tl-bg" aria-hidden="true"></canvas>
    <div class="tl-glow" aria-hidden="true"></div>

    <header class="tl-nav">
      <router-link to="/home" class="tl-brand">
        <img :src="siteLogo || '/logo.svg'" alt="" />
        <span>{{ siteName }}</span>
      </router-link>
      <nav class="tl-nav-links">
        <a href="#showcase">{{ c.navShowcase }}</a>
        <a href="#camps">{{ c.navModels }}</a>
        <a href="#pricing">{{ c.navPricing }}</a>
        <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ c.navDocs }}</a>
      </nav>
      <div class="tl-nav-right">
        <LocaleSwitcher />
        <router-link v-if="isAuthenticated" :to="dashboardPath" class="tl-btn tl-btn--solid">{{ c.console }}</router-link>
        <template v-else>
          <router-link to="/login" class="tl-btn tl-btn--ghost">{{ c.login }}</router-link>
          <router-link to="/register" class="tl-btn tl-btn--solid">{{ c.register }}</router-link>
        </template>
      </div>
    </header>

    <section class="tl-hero">
      <p class="tl-eyebrow">{{ c.eyebrow }}</p>
      <h1 class="tl-title">
        <span class="tl-grad">{{ c.title1 }}</span><br />{{ c.title2 }}
      </h1>
      <p class="tl-sub">{{ c.sub }}</p>
      <div class="tl-cta">
        <router-link :to="isAuthenticated ? dashboardPath : '/register'" class="tl-btn tl-btn--solid tl-btn--lg">
          {{ isAuthenticated ? c.console : c.start }}
        </router-link>
        <a href="#showcase" class="tl-btn tl-btn--ghost tl-btn--lg">{{ c.seeWork }}</a>
      </div>

      <div class="tl-term" role="img" :aria-label="c.termAria">
        <div class="tl-term-bar"><i></i><i></i><i></i><span>~ / tokenliberty</span></div>
        <pre><code>{{ typed }}<b class="tl-caret"></b></code></pre>
      </div>
    </section>

    <section class="tl-stats" data-reveal>
      <div v-for="s in c.stats" :key="s.k" class="tl-stat">
        <strong>{{ s.v }}</strong><span>{{ s.k }}</span>
      </div>
    </section>

    <section id="showcase" class="tl-sec">
      <div data-reveal>
        <p class="tl-eyebrow">{{ c.showEyebrow }}</p>
        <h2>{{ c.showTitle }}</h2>
        <p class="tl-lead">{{ c.showLead }}</p>
      </div>

      <div class="tl-demos">
        <article v-for="d in demos" :key="d.key" class="tl-demo" data-reveal>
          <div class="tl-demo-head">
            <span class="tl-chip" :class="`tl-chip--${d.key}`">{{ d.model }}</span>
            <span class="tl-date">{{ c.generatedAt }} {{ d.date }}</span>
          </div>
          <div class="tl-frame">
            <iframe
              v-if="playing[d.key]"
              :src="d.src"
              sandbox="allow-scripts"
              loading="lazy"
              :title="d.title"
            ></iframe>
            <button v-else type="button" class="tl-play" @click="playing[d.key] = true">
              <span class="tl-play-ico">&#9654;</span>
              <span>{{ d.cta }}</span>
            </button>
          </div>
          <p class="tl-cap">{{ d.caption }}</p>
        </article>
      </div>

      <div class="tl-gallery">
        <figure
          v-for="(img, i) in images"
          :key="img.src"
          class="tl-shot"
          data-reveal
          :style="{ '--d': `${i * 80}ms` }"
          @pointermove="tilt($event)"
          @pointerleave="untilt($event)"
        >
          <img :src="img.src" :alt="img.prompt" loading="lazy" />
          <figcaption>
            <span class="tl-chip tl-chip--gpt">{{ img.model }}</span>
            <em>{{ img.date }}</em>
            <p>{{ img.prompt }}</p>
          </figcaption>
        </figure>
      </div>
      <p class="tl-note">{{ c.honest }}</p>
    </section>

    <section id="camps" class="tl-sec">
      <div data-reveal>
        <p class="tl-eyebrow">{{ c.campEyebrow }}</p>
        <h2>{{ c.campTitle }}</h2>
      </div>
      <div class="tl-camps">
        <article class="tl-camp tl-camp--claude" data-reveal @pointermove="tilt($event)" @pointerleave="untilt($event)">
          <h3>Claude</h3>
          <p>{{ c.claudeDesc }}</p>
          <ul><li v-for="m in c.claudeList" :key="m">{{ m }}</li></ul>
        </article>
        <article class="tl-camp tl-camp--gpt" data-reveal @pointermove="tilt($event)" @pointerleave="untilt($event)">
          <h3>Codex / GPT</h3>
          <p>{{ c.gptDesc }}</p>
          <ul><li v-for="m in c.gptList" :key="m">{{ m }}</li></ul>
        </article>
      </div>
    </section>

    <section id="pricing" class="tl-sec">
      <div data-reveal>
        <p class="tl-eyebrow">{{ c.priceEyebrow }}</p>
        <h2>{{ c.priceTitle }}</h2>
      </div>
      <div class="tl-plans">
        <article v-for="p in c.plans" :key="p.name" class="tl-plan" data-reveal>
          <h3>{{ p.name }}</h3>
          <div class="tl-price"><small>¥</small>{{ p.price }}<span>/ {{ p.unit }}</span></div>
          <ul><li v-for="f in p.feats" :key="f">{{ f }}</li></ul>
        </article>
      </div>
      <div class="tl-cta tl-cta--center" data-reveal>
        <router-link :to="isAuthenticated ? '/purchase' : '/register'" class="tl-btn tl-btn--solid tl-btn--lg">
          {{ isAuthenticated ? c.buy : c.start }}
        </router-link>
      </div>
    </section>

    <footer class="tl-foot">
      <span>&copy; {{ year }} {{ siteName }}</span>
      <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer">{{ c.navDocs }}</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import { sanitizeUrl } from '@/utils/url'
import { SHOWCASE_DEMOS, SHOWCASE_IMAGES, nextTypedLength } from '@/utils/tlLanding'

const { locale } = useI18n()
const authStore = useAuthStore()
const appStore = useAppStore()

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'TokenLiberty')
const siteLogo = computed(() =>
  sanitizeUrl(appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '', { allowRelative: true, allowDataUrl: true }),
)
const docUrl = computed(() => sanitizeUrl(appStore.cachedPublicSettings?.doc_url || appStore.docUrl || ''))
const isAuthenticated = computed(() => authStore.isAuthenticated)
const dashboardPath = computed(() => (authStore.isAdmin ? '/admin/dashboard' : '/dashboard'))
const year = new Date().getFullYear()

const isZh = computed(() => String(locale.value).startsWith('zh'))

const ZH = {
  navShowcase: '真实案例', navModels: '模型', navPricing: '价格', navDocs: '教程',
  login: '登录', register: '注册', console: '进入控制台', start: '免费开始', seeWork: '看看它能做什么',
  eyebrow: 'CLAUDE · CODEX · GPT-IMAGE',
  title1: '一个 Key,', title2: '接入最强的 AI。',
  sub: 'Claude、Codex / GPT、图像模型统一接入。兼容原生 SDK,改一行 Base URL 就能用。',
  termAria: '终端演示:用 curl 调用接口',
  stats: [
    { v: '3+', k: '模型家族' }, { v: '1 行', k: '改 Base URL 即可接入' }, { v: '¥39 起', k: '周卡' }, { v: '实时', k: '用量与扣费透明' },
  ],
  showEyebrow: 'REAL OUTPUT', showTitle: '不是效果图,是本站刚生成的',
  showLead: '下面每一项都由本站接口真实调用生成,标注了模型与生成日期。游戏和星云可以直接玩。',
  generatedAt: '生成于', playBtn: '点击运行',
  claudeTitle: 'Claude 写的霓虹贪吃蛇', claudeCap: 'Claude 一次生成约 150 行代码,方向键或滑动控制。',
  gptTitle: 'GPT 写的交互星云', gptCap: 'GPT 一次生成 1200 粒子星云,鼠标排斥、点击产生冲击波。',
  honest: '图片由 gpt-image-2 生成并压缩展示;代码案例为模型原始输出,未做手工修改。',
  campEyebrow: 'MODELS', campTitle: '两个阵营,按需选择',
  claudeDesc: '长上下文、代码与写作表现稳定,适合日常开发和 Agent。',
  gptDesc: 'Codex 与 GPT 系列,适合代码补全、批量任务与图像生成。',
  claudeList: ['兼容 Claude Code', '周卡 / 月卡 / 按量', '倍率按量计费'],
  gptList: ['兼容 Codex CLI', '图像生成', '低倍率按量'],
  priceEyebrow: 'PRICING', priceTitle: '用多少付多少,或包月更划算',
  buy: '去购买',
  plans: [
    { name: 'Claude 周卡', price: '39', unit: '7 天', feats: ['每日 $25 额度', '每周 $55 额度', '适合尝鲜与短期项目'] },
    { name: 'Claude 月卡', price: '239', unit: '30 天', feats: ['每日 $30 额度', '每周 $100 额度', '每月 $380 额度'] },
    { name: '按量付费', price: '0', unit: '起步无门槛', feats: ['Claude ×0.8', 'GPT 低至 ×0.42', '余额随用随扣'] },
  ],
} as const

const EN = {
  navShowcase: 'Showcase', navModels: 'Models', navPricing: 'Pricing', navDocs: 'Docs',
  login: 'Log in', register: 'Sign up', console: 'Console', start: 'Get started free', seeWork: 'See what it can do',
  eyebrow: 'CLAUDE · CODEX · GPT-IMAGE',
  title1: 'One key,', title2: 'the strongest AI.',
  sub: 'Claude, Codex / GPT and image models behind one endpoint. Native SDK compatible: change one Base URL.',
  termAria: 'Terminal demo: calling the API with curl',
  stats: [
    { v: '3+', k: 'Model families' }, { v: '1 line', k: 'Base URL change' }, { v: 'from ¥39', k: 'Weekly pass' }, { v: 'Live', k: 'Transparent usage & billing' },
  ],
  showEyebrow: 'REAL OUTPUT', showTitle: 'Not mockups. Generated here, just now.',
  showLead: 'Every item below was produced through this site with the model and date shown. The game and the nebula are playable.',
  generatedAt: 'Generated', playBtn: 'Click to run',
  claudeTitle: 'Neon snake by Claude', claudeCap: 'About 150 lines in one shot. Arrow keys or swipe.',
  gptTitle: 'Interactive nebula by GPT', gptCap: '1200 particles in one shot. Mouse repels, click sends a shockwave.',
  honest: 'Images by gpt-image-2, compressed for display; code demos are raw model output, unedited.',
  campEyebrow: 'MODELS', campTitle: 'Two camps, pick what fits',
  claudeDesc: 'Long context, steady at code and writing. Great for daily dev and agents.',
  gptDesc: 'Codex and GPT families for completion, batch jobs and image generation.',
  claudeList: ['Claude Code compatible', 'Weekly / monthly / pay-as-you-go', 'Multiplier billing'],
  gptList: ['Codex CLI compatible', 'Image generation', 'Low-multiplier pay-as-you-go'],
  priceEyebrow: 'PRICING', priceTitle: 'Pay for what you use, or subscribe',
  buy: 'Buy now',
  plans: [
    { name: 'Claude Weekly', price: '39', unit: '7 days', feats: ['$25 daily quota', '$55 weekly quota', 'Great for trials'] },
    { name: 'Claude Monthly', price: '239', unit: '30 days', feats: ['$30 daily quota', '$100 weekly quota', '$380 monthly quota'] },
    { name: 'Pay as you go', price: '0', unit: 'no minimum', feats: ['Claude ×0.8', 'GPT from ×0.42', 'Balance deducted per use'] },
  ],
} as const

const c = computed(() => (isZh.value ? ZH : EN))
const images = SHOWCASE_IMAGES

const playing = reactive<Record<'claude' | 'gpt', boolean>>({ claude: false, gpt: false })
const demos = computed(() => [
  { key: 'claude' as const, ...SHOWCASE_DEMOS.claude, title: c.value.claudeTitle, caption: c.value.claudeCap, cta: c.value.playBtn },
  { key: 'gpt' as const, ...SHOWCASE_DEMOS.gpt, title: c.value.gptTitle, caption: c.value.gptCap, cta: c.value.playBtn },
])

const reduceMotion = ref(false)
const bgCanvas = ref<HTMLCanvasElement | null>(null)

const TERM_TEXT = `$ export ANTHROPIC_BASE_URL=https://tokenliberty.site
$ curl $ANTHROPIC_BASE_URL/v1/messages \\
    -H "x-api-key: $KEY" \\
    -d '{"model":"claude-sonnet-5-5","max_tokens":64,
         "messages":[{"role":"user","content":"hello"}]}'
> {"content":[{"text":"Hello! How can I help?"}]}`
const typedLen = ref(0)
const typed = computed(() => TERM_TEXT.slice(0, typedLen.value))

let raf = 0
let typeTimer = 0
let io: IntersectionObserver | null = null
let ro: (() => void) | null = null

function tilt(e: PointerEvent) {
  if (reduceMotion.value) return
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-4px)`
}
function untilt(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).style.transform = ''
}

function startBackground(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const mouse = { x: -9999, y: -9999 }
  let w = 0
  let h = 0
  let dpr = 1
  type P = { x: number; y: number; vx: number; vy: number; hue: number }
  let ps: P[] = []
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = window.innerWidth
    h = window.innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const n = Math.min(160, Math.floor((w * h) / 9000))
    ps = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, hue: 150 + Math.random() * 50,
    }))
  }
  const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY }
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('pointermove', onMove, { passive: true })
  let t = 0
  const frame = () => {
    t += 0.004
    ctx.clearRect(0, 0, w, h)
    for (const p of ps) {
      const a = Math.sin(p.x * 0.004 + t) * Math.cos(p.y * 0.004 - t) * Math.PI * 2
      p.vx += Math.cos(a) * 0.05
      p.vy += Math.sin(a) * 0.05
      const dx = p.x - mouse.x
      const dy = p.y - mouse.y
      const d2 = dx * dx + dy * dy
      if (d2 < 14000) {
        const f = (1 - d2 / 14000) * 1.2
        p.vx += (dx / (Math.sqrt(d2) + 1)) * f
        p.vy += (dy / (Math.sqrt(d2) + 1)) * f
      }
      p.vx *= 0.94
      p.vy *= 0.94
      p.x = (p.x + p.vx + w) % w
      p.y = (p.y + p.vy + h) % h
      ctx.fillStyle = `hsla(${p.hue},90%,65%,0.7)`
      ctx.fillRect(p.x, p.y, 1.8, 1.8)
    }
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x
        const dy = ps[i].y - ps[j].y
        const d2 = dx * dx + dy * dy
        if (d2 < 6400) {
          ctx.strokeStyle = `rgba(80,230,180,${(1 - d2 / 6400) * 0.18})`
          ctx.beginPath()
          ctx.moveTo(ps[i].x, ps[i].y)
          ctx.lineTo(ps[j].x, ps[j].y)
          ctx.stroke()
        }
      }
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)
  ro = () => {
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', onMove)
  }
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const els = Array.from(document.querySelectorAll<HTMLElement>('.tl [data-reveal]'))
  if (reduceMotion.value || typeof IntersectionObserver === 'undefined') {
    els.forEach((el) => el.classList.add('is-in'))
    typedLen.value = TERM_TEXT.length
    return
  }
  if (bgCanvas.value) startBackground(bgCanvas.value)
  io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in')
          io?.unobserve(en.target)
        }
      }
    },
    { threshold: 0.12 },
  )
  els.forEach((el) => io?.observe(el))
  typeTimer = window.setInterval(() => {
    typedLen.value = nextTypedLength(typedLen.value, TERM_TEXT.length)
    if (typedLen.value >= TERM_TEXT.length) window.clearInterval(typeTimer)
  }, 28)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.clearInterval(typeTimer)
  io?.disconnect()
  ro?.()
})
</script>

<style scoped>
.tl { --bg:#080c10; --panel:#10171d; --line:#253038; --ink:#f1f6f5; --muted:#a5b4b0; --mint:#4be3b0; --claude:#f0a070;
  position: relative; min-height: 100vh; background: var(--bg); color: var(--ink); overflow-x: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.tl-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.tl-glow { position: fixed; inset: -20% -10% auto; height: 70vh; z-index: 0; pointer-events: none;
  background: radial-gradient(40% 50% at 30% 30%, rgba(75,227,176,.18), transparent 70%), radial-gradient(35% 45% at 75% 20%, rgba(240,160,112,.14), transparent 70%);
  animation: tl-drift 14s ease-in-out infinite alternate; }
@keyframes tl-drift { to { transform: translate3d(3%, 4%, 0) scale(1.08); } }
.tl > section, .tl > header, .tl > footer { position: relative; z-index: 1; }

.tl-nav { display: flex; align-items: center; gap: 24px; padding: 16px clamp(16px, 4vw, 48px); position: sticky; top: 0; z-index: 5;
  backdrop-filter: blur(14px); background: rgba(8,12,16,.65); border-bottom: 1px solid rgba(37,48,56,.6); }
.tl-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--ink); text-decoration: none; }
.tl-brand img { width: 28px; height: 28px; border-radius: 8px; object-fit: contain; }
.tl-nav-links { display: flex; gap: 22px; margin-left: 12px; flex: 1; }
.tl-nav-links a { color: var(--muted); text-decoration: none; font-size: 14px; transition: color .2s; }
.tl-nav-links a:hover { color: var(--ink); }
.tl-nav-right { display: flex; align-items: center; gap: 10px; }

.tl-btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 600;
  text-decoration: none; transition: transform .2s, box-shadow .2s, background .2s; border: 1px solid transparent; cursor: pointer; }
.tl-btn--solid { background: linear-gradient(135deg, #4be3b0, #2fb7d6); color: #04120d; box-shadow: 0 0 0 rgba(75,227,176,0); }
.tl-btn--solid:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(75,227,176,.35); }
.tl-btn--ghost { color: var(--ink); border-color: var(--line); background: rgba(16,23,29,.6); }
.tl-btn--ghost:hover { border-color: var(--mint); }
.tl-btn--lg { padding: 13px 26px; font-size: 16px; }

.tl-hero { text-align: center; padding: clamp(56px, 10vh, 120px) 20px 40px; max-width: 980px; margin: 0 auto; }
.tl-eyebrow { color: var(--mint); letter-spacing: .22em; font-size: 12px; font-weight: 700; margin-bottom: 14px; }
.tl-title { font-size: clamp(40px, 7.5vw, 84px); line-height: 1.08; font-weight: 800; letter-spacing: -.02em; }
.tl-grad { background: linear-gradient(100deg, #4be3b0, #2fb7d6 40%, #f0a070 85%); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: tl-shine 6s linear infinite; }
@keyframes tl-shine { to { background-position: -200% 0; } }
.tl-sub { color: var(--muted); font-size: clamp(15px, 2vw, 19px); max-width: 640px; margin: 22px auto 0; line-height: 1.7; }
.tl-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 30px; }
.tl-cta--center { margin-top: 36px; }

.tl-term { margin: 48px auto 0; max-width: 720px; text-align: left; border: 1px solid var(--line); border-radius: 14px; background: rgba(10,15,19,.85);
  box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(75,227,176,.08); overflow: hidden; }
.tl-term-bar { display: flex; align-items: center; gap: 7px; padding: 10px 14px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.tl-term-bar i { width: 10px; height: 10px; border-radius: 50%; background: #3a4650; }
.tl-term-bar i:nth-child(1) { background: #ff6b6b; } .tl-term-bar i:nth-child(2) { background: #ffd166; } .tl-term-bar i:nth-child(3) { background: #4be3b0; }
.tl-term-bar span { margin-left: 8px; }
.tl-term pre { margin: 0; padding: 18px; min-height: 170px; font: 13px/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #bff3de; white-space: pre-wrap; word-break: break-all; }
.tl-caret { display: inline-block; width: 8px; height: 15px; background: var(--mint); margin-left: 2px; vertical-align: -2px; animation: tl-blink 1s steps(1) infinite; }
@keyframes tl-blink { 50% { opacity: 0; } }

.tl-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; max-width: 980px; margin: 40px auto; background: var(--line); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.tl-stat { background: var(--panel); padding: 22px 12px; text-align: center; }
.tl-stat strong { display: block; font-size: 26px; color: var(--mint); }
.tl-stat span { color: var(--muted); font-size: 13px; }

.tl-sec { max-width: 1120px; margin: 0 auto; padding: 70px 20px; }
.tl-sec h2 { font-size: clamp(28px, 4.4vw, 46px); font-weight: 800; letter-spacing: -.01em; }
.tl-lead { color: var(--muted); margin-top: 12px; max-width: 640px; line-height: 1.7; }

.tl-demos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; margin-top: 36px; }
.tl-demo { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); padding: 14px; }
.tl-demo-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 6px; }
.tl-date { color: var(--muted); font-size: 12px; }
.tl-frame { position: relative; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: #05080b; }
.tl-frame iframe { width: 100%; height: 100%; border: 0; display: block; }
.tl-play { position: absolute; inset: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--ink);
  background: radial-gradient(circle at 50% 50%, rgba(75,227,176,.15), transparent 60%); border: 0; cursor: pointer; font-size: 15px; }
.tl-play-ico { width: 58px; height: 58px; border-radius: 50%; display: grid; place-items: center; background: rgba(75,227,176,.18); border: 1px solid var(--mint); color: var(--mint);
  animation: tl-pulse 2s ease-out infinite; }
@keyframes tl-pulse { 0% { box-shadow: 0 0 0 0 rgba(75,227,176,.45); } 100% { box-shadow: 0 0 0 22px rgba(75,227,176,0); } }
.tl-cap { color: var(--muted); font-size: 13px; margin-top: 10px; }
.tl-chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font: 600 12px ui-monospace, Menlo, Consolas, monospace; border: 1px solid; }
.tl-chip--claude { color: var(--claude); border-color: rgba(240,160,112,.5); background: rgba(240,160,112,.08); }
.tl-chip--gpt { color: var(--mint); border-color: rgba(75,227,176,.5); background: rgba(75,227,176,.08); }

.tl-gallery { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 22px; }
.tl-shot { position: relative; margin: 0; border-radius: 14px; overflow: hidden; border: 1px solid var(--line); aspect-ratio: 3 / 4; transition: transform .25s ease, box-shadow .25s; }
.tl-shot:hover { box-shadow: 0 24px 60px rgba(0,0,0,.55); }
.tl-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tl-shot figcaption { position: absolute; inset: auto 0 0 0; padding: 36px 12px 12px; background: linear-gradient(transparent, rgba(4,8,10,.92)); font-size: 12px; }
.tl-shot figcaption em { color: var(--muted); font-style: normal; margin-left: 8px; }
.tl-shot figcaption p { margin-top: 6px; color: #d4e3df; }
.tl-note { color: var(--muted); font-size: 12px; margin-top: 16px; }

.tl-camps { display: grid; grid-template-columns: repeat(2, 1fr); gap: 22px; margin-top: 30px; }
.tl-camp { padding: 28px; border-radius: 18px; border: 1px solid var(--line); background: var(--panel); transition: transform .25s ease; }
.tl-camp h3 { font-size: 28px; font-weight: 800; }
.tl-camp--claude h3 { color: var(--claude); } .tl-camp--gpt h3 { color: var(--mint); }
.tl-camp--claude { box-shadow: inset 0 0 80px rgba(240,160,112,.06); } .tl-camp--gpt { box-shadow: inset 0 0 80px rgba(75,227,176,.06); }
.tl-camp p { color: var(--muted); margin: 10px 0 16px; line-height: 1.7; }
.tl-camp ul, .tl-plan ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.tl-camp li::before, .tl-plan li::before { content: '✓'; color: var(--mint); margin-right: 8px; }

.tl-plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 30px; }
.tl-plan { padding: 26px; border-radius: 18px; border: 1px solid var(--line); background: var(--panel); transition: transform .25s, border-color .25s; }
.tl-plan:hover { transform: translateY(-6px); border-color: var(--mint); }
.tl-plan h3 { font-size: 18px; color: var(--muted); }
.tl-price { font-size: 52px; font-weight: 800; margin: 10px 0 18px; }
.tl-price small { font-size: 22px; margin-right: 2px; color: var(--mint); }
.tl-price span { font-size: 14px; font-weight: 500; color: var(--muted); margin-left: 6px; }

.tl-foot { display: flex; justify-content: space-between; padding: 30px clamp(16px, 4vw, 48px); border-top: 1px solid var(--line); color: var(--muted); font-size: 13px; }
.tl-foot a { color: var(--muted); }

[data-reveal] { opacity: 0; transform: translateY(28px); transition: opacity .7s ease var(--d, 0ms), transform .7s ease var(--d, 0ms); }
[data-reveal].is-in { opacity: 1; transform: none; }
.tl--reduce [data-reveal] { opacity: 1; transform: none; transition: none; }
.tl--reduce .tl-glow, .tl--reduce .tl-grad, .tl--reduce .tl-play-ico, .tl--reduce .tl-caret { animation: none; }

@media (max-width: 860px) {
  .tl-nav-links { display: none; }
  .tl-nav { justify-content: space-between; }
  .tl-stats { grid-template-columns: repeat(2, 1fr); margin: 30px 16px; }
  .tl-demos, .tl-camps, .tl-plans { grid-template-columns: 1fr; }
  .tl-gallery { grid-template-columns: repeat(2, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { opacity: 1; transform: none; transition: none; }
}
</style>
