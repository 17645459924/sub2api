<template>
  <div
    v-if="active"
    ref="rootEl"
    class="splash"
    :class="{ ignited: stage >= 1, named: stage >= 2, tagged: stage >= 3, pulled: stage >= 4, flying: stage >= 5, landed: stage >= 6, fast }"
    role="presentation"
    @click="skip"
  >
    <div ref="veilEl" class="splash-veil" aria-hidden="true">
      <canvas ref="canvasEl" class="splash-canvas"></canvas>
    </div>
    <div class="splash-center" aria-hidden="true">
      <span ref="logoEl" class="splash-logo"><img :src="logo" alt="" width="136" height="136" /></span>
      <div class="splash-word">
        <p class="splash-name">
          <span v-for="(l, i) in letters" :key="i" :style="{ '--d': `${i * 22}ms`, color: l.color }">{{ l.ch }}</span>
        </p>
        <i class="splash-scan"></i>
        <p class="splash-tag">{{ tagline }}</p>
      </div>
    </div>
    <button class="splash-skip" type="button" @click.stop="skip">{{ skipLabel }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  siteName: string
  logo: string
  tagline: string
  skipLabel: string
  disabled: boolean
  /** Logo 的落位点(视口坐标)。返回 null 时退回到顶栏 Logo */
  target?: () => { x: number; y: number; size: number } | null
}>()
/** reveal:Logo 落位、页面开始露出,首屏此时入场;done:进场层已移除 */
const emit = defineEmits<{ reveal: []; done: [] }>()

/**
 * 时间线(秒)。两个节拍,后一个更强:
 * 穿过隧道、三路请求汇入 → 点火 → 品牌名 → 副标 → 文字收进 Logo 蓄力 → Logo 冲向落位点 → 撞击,光圈展开露出页面
 */
const T = { gather: 0.1, ignite: 1.15, name: 1.2, tag: 1.5, pull: 2.4, fly: 2.55, land: 2.95, end: 3.7 }
/** 每一路请求从屏幕外飞到 Logo 的时长 */
const COMET_DUR = 0.55
/** 兜底:可见状态下超过这个时长仍未结束,强制移除进场层 */
const WATCHDOG_MS = 7000
const BG = '#02050f'
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])
/** Logo 两笔在 24 单位画板里的折线近似(见 public/logo.svg),第二笔是第一笔绕中心旋转 180° */
const STROKE: [number, number][] = [[19.25, 7.65], [16.7, 4.45], [15.67, 3.95], [8.58, 3.95], [7.67, 4.32], [4.15, 7.65], [3.66, 8.84], [4.8, 9.95], [14.35, 15.92]]
const STOPS = [[121, 244, 189], [57, 217, 231], [91, 141, 255]]

const active = ref(false)
const stage = ref(0) // 1 点火 · 2 品牌名 · 3 副标 · 4 收拢 · 5 飞行 · 6 落位
const fast = ref(false) // 已跳过:收束段加速播放
const rootEl = ref<HTMLElement>()
const veilEl = ref<HTMLElement>()
const canvasEl = ref<HTMLCanvasElement>()
const logoEl = ref<HTMLElement>()

const letters = computed(() => {
  const chars = Array.from(props.siteName)
  const n = Math.max(1, chars.length - 1)
  return chars.map((ch, i) => {
    const f = (i / n) * 2, seg = Math.min(1, Math.floor(f)), k = f - seg
    const c = STOPS[seg].map((v, j) => Math.round(v + (STOPS[seg + 1][j] - v) * k))
    return { ch, color: `rgb(${c.join(',')})` }
  })
})

let raf = 0
let guard: ReturnType<typeof setTimeout> | undefined
let ended = false
let revealed = false
let locked = false
let skipAt = 0
let skipNow = () => end()
let detach = () => {}

// 每次进入首页都播放;只有减少动效时才跳过
function shouldPlay() {
  return !props.disabled
}
function unlockScroll() {
  if (!locked) return
  locked = false
  document.documentElement.style.removeProperty('overflow')
}
function reveal() {
  if (revealed) return
  revealed = true
  emit('reveal')
}
/** 任何路径(播完、跳过、画布不可用、异常、超时)都从这里收尾,保证页面一定露出来 */
function end() {
  if (ended) return
  ended = true
  cancelAnimationFrame(raf)
  clearTimeout(guard)
  detach()
  unlockScroll()
  reveal()
  active.value = false
  emit('done')
}
function skip() {
  const now = performance.now()
  if (now - skipAt < 250) return
  skipAt = now
  skipNow()
}

interface Dot { ta: number; tr: number; r0: number; sw: number; d: number; dur: number; ph: number; x: number; y: number; vx: number; vy: number; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number }
interface Star { a: number; r: number; v: number }
interface Pt { x: number; y: number }

function run() {
  const rootNode = rootEl.value, veilNode = veilEl.value, canvasNode = canvasEl.value, logoNode = logoEl.value
  const context = canvasNode?.getContext('2d') ?? null
  if (!rootNode || !veilNode || !canvasNode || !logoNode || !context) return end()
  const root: HTMLElement = rootNode, veil: HTMLElement = veilNode, canvas: HTMLCanvasElement = canvasNode, logoBox: HTMLElement = logoNode
  const ctx: CanvasRenderingContext2D = context

  const mobile = window.innerWidth < 760
  const weak = (navigator.hardwareConcurrency || 8) <= 4
  const density = (mobile ? 0.5 : 1) * (weak ? 0.6 : 1)
  let seed = 20261
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  const outCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
  const inOut = (x: number) => ((x = clamp(x)) < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

  let W = 1, H = 1, L = 100, maxR = 1
  const lc = { x: 0, y: 0 } // Logo 当前中心
  const origin = { x: 0, y: 0 } // 隧道与星流的消失点,始终跟着 Logo

  function measure() {
    const r = veil.getBoundingClientRect()
    W = Math.max(1, r.width); H = Math.max(1, r.height)
    const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    // 全屏画布按总像素数封顶,4K 屏也不会超过约 340 万像素
    const scale = Math.max(0.75, Math.min(dpr, Math.sqrt(3.4e6 / (W * H))))
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale)
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H)
    maxR = Math.hypot(W, H)
  }
  function locate() {
    const r = logoBox.getBoundingClientRect()
    L = r.width || 100
    lc.x = r.left + r.width / 2; lc.y = r.top + r.height / 2
  }
  measure(); locate()
  origin.x = lc.x; origin.y = lc.y

  /* ---------- 预渲染贴图:光晕、放射光、镜头光条。每帧只做 drawImage,不再创建渐变 ---------- */
  function sprite(w: number, h: number, paint: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const g = c.getContext('2d')
    if (g) paint(g, w, h)
    return c
  }
  const radial = (stops: [number, string][]) => (g: CanvasRenderingContext2D, s: number) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    for (const [o, col] of stops) gr.addColorStop(o, col)
    g.fillStyle = gr; g.fillRect(0, 0, s, s)
  }
  const glow = sprite(256, 256, radial([[0, 'rgba(214,255,243,1)'], [0.16, 'rgba(121,244,189,0.62)'], [0.45, 'rgba(57,217,231,0.2)'], [1, 'rgba(56,117,246,0)']]))
  const aura = sprite(128, 128, radial([[0, 'rgba(57,217,231,0.5)'], [0.5, 'rgba(56,117,246,0.2)'], [1, 'rgba(56,117,246,0)']]))
  const haze = sprite(128, 128, radial([[0, 'rgba(96,104,255,0.55)'], [1, 'rgba(96,104,255,0)']]))
  const dot = sprite(32, 32, radial([[0, 'rgba(226,255,247,0.95)'], [0.28, 'rgba(57,217,231,0.42)'], [1, 'rgba(57,217,231,0)']]))
  // 三路请求的颜色取自首屏右侧三个模型:Claude、GPT、图像
  const tints = ['255,154,90', '57,217,231', '139,123,255'].map((c) =>
    sprite(64, 64, radial([[0, 'rgba(255,255,255,1)'], [0.22, `rgba(${c},0.9)`], [1, `rgba(${c},0)`]])),
  )
  const flare = sprite(512, 48, (g, w, h) => {
    const a = g.createLinearGradient(0, 0, w, 0)
    a.addColorStop(0, 'rgba(110,200,255,0)'); a.addColorStop(0.5, 'rgba(228,255,248,1)'); a.addColorStop(1, 'rgba(110,200,255,0)')
    g.fillStyle = a; g.fillRect(0, 0, w, h)
    const b = g.createLinearGradient(0, 0, 0, h)
    b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(0.5, 'rgba(0,0,0,1)'); b.addColorStop(1, 'rgba(0,0,0,0)')
    g.globalCompositeOperation = 'destination-in'
    g.fillStyle = b; g.fillRect(0, 0, w, h)
  })
  const raySize = mobile ? 384 : 640
  const rays = sprite(raySize, raySize, (g, s) => {
    const c = s / 2
    for (let i = 0; i < 68; i++) {
      const a = rnd() * 6.283, w = 0.003 + rnd() * rnd() * 0.022, len = c * (0.5 + rnd() * 0.5)
      const col = i % 3 ? '150,246,226' : '120,170,255'
      const gr = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len)
      gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(0.16, `rgba(${col},${(0.18 + rnd() * 0.6).toFixed(2)})`); gr.addColorStop(1, `rgba(${col},0)`)
      g.fillStyle = gr
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, len, a - w, a + w); g.closePath(); g.fill()
    }
  })

  /* ---------- 粒子:落点取自真实 Logo 的两笔与圆角底板;自定义 Logo 时只汇聚成底板 ---------- */
  const strokes = [STROKE, STROKE.map(([x, y]) => [24 - x, 24 - y] as [number, number])]
  const cum = [0]
  for (let i = 1; i < STROKE.length; i++) cum.push(cum[i - 1] + Math.hypot(STROKE[i][0] - STROKE[i - 1][0], STROKE[i][1] - STROKE[i - 1][1]))
  const along = (pts: [number, number][], f: number): [number, number] => {
    const d = f * cum[cum.length - 1]
    let i = 1
    while (i < cum.length - 1 && cum[i] < d) i++
    const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1])
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]
  }
  const unit = (u: number) => (52 + 17 * u) / 512 - 0.5
  const squircle = (a: number, r: number): [number, number] => {
    const c = Math.cos(a), s = Math.sin(a)
    return [Math.sign(c) * Math.pow(Math.abs(c), 0.4) * r, Math.sign(s) * Math.pow(Math.abs(s), 0.4) * r]
  }
  const stockLogo = /(^|\/)logo\.svg(\?|$)/.test(props.logo)
  const groups: Dot[][] = [[], [], [], [], [], []]
  const COLORS = ['#79f4bd', '#39d9e7', '#6f9bff']
  const N = Math.round(900 * density)
  for (let i = 0; i < N; i++) {
    let ux: number, uy: number
    if (rnd() < (stockLogo ? 0.68 : 0)) {
      const [px, py] = along(strokes[i % 2], rnd())
      ux = unit(px) + (rnd() - 0.5) * 0.07; uy = unit(py) + (rnd() - 0.5) * 0.07
    } else {
      const edge = stockLogo || rnd() < 0.55
      ;[ux, uy] = squircle(rnd() * 6.283, edge ? 0.468 + (rnd() - 0.5) * 0.02 : 0.44 * Math.sqrt(rnd()))
    }
    const h = rnd()
    groups[(h < 0.45 ? 0 : h < 0.8 ? 1 : 2) * 2 + (rnd() < 0.24 ? 1 : 0)].push({
      ta: Math.atan2(uy, ux), tr: Math.hypot(ux, uy), r0: maxR * (0.55 + rnd() * 0.75), sw: 1.5 + rnd() * 2.7,
      d: rnd() * 0.34, dur: 0.46 + rnd() * 0.26, ph: rnd() * 6.283, x: -99, y: -99, vx: 0, vy: 0, life: 0,
    })
  }
  const stars: Star[] = Array.from({ length: Math.round(200 * density) }, () => ({ a: rnd() * 6.283, r: rnd() * maxR * 0.6, v: 0.5 + rnd() }))
  // 隧道:一串与 Logo 底板同形的圆角方框,从消失点迎面掠过
  const gateN = mobile ? 7 : 11
  const gates = Array.from({ length: gateN }, (_, i) => ({ z: (i + 1) / gateN, c: i % 3 }))
  // 三路请求:起点是屏幕外的相对位置,at 是击中 Logo 的时刻;最后一路击中即点火
  const comets = [
    { sx: -0.06, sy: 0.16, at: T.ignite - 0.34, hit: false },
    { sx: 1.06, sy: 0.3, at: T.ignite - 0.17, hit: false },
    { sx: 0.24, sy: 1.08, at: T.ignite, hit: false },
  ]
  const pulses: number[] = []
  const sparks: Spark[] = []

  let clock = 0, last = 0, speed = 1
  let ignited = false, flying = false, landed = false, skipped = false
  const from = { x: 0, y: 0 }, to = { x: 0, y: 0, size: 100 }
  const iris = { x: 0, y: 0, R: 1 }
  let arc = 0, logoScale = 1

  const blit = (img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number) => {
    if (alpha <= 0.004 || size <= 0) return
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
  }
  /** 横向镜头光条 */
  const streak = (x: number, y: number, w: number, h: number, alpha: number) => {
    if (alpha <= 0.004 || w <= 0) return
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(flare, x - w / 2, y - h / 2, w, h)
  }
  const ring = (x: number, y: number, r: number, width: number, alpha: number, color: string) => {
    if (alpha <= 0.004 || r <= 0) return
    ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = width
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke()
  }
  /** 圆角方环:与 Logo 底板、首屏中心节点的脉冲环同形 */
  const gate = (x: number, y: number, half: number, rot: number, width: number, alpha: number, color: string) => {
    if (alpha <= 0.004 || half <= 0) return
    const r = half * 0.5
    ctx.save(); ctx.translate(x, y)
    if (rot) ctx.rotate(rot)
    ctx.globalAlpha = Math.min(1, alpha); ctx.strokeStyle = color; ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(-half + r, -half)
    ctx.arcTo(half, -half, half, half, r); ctx.arcTo(half, half, -half, half, r)
    ctx.arcTo(-half, half, -half, -half, r); ctx.arcTo(-half, -half, half, -half, r)
    ctx.closePath(); ctx.stroke()
    ctx.restore()
  }
  const burst = (x: number, y: number, n: number, power: number) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, s = power * (0.25 + rnd())
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.25 + rnd() * 0.4 })
    }
  }

  /** 粒子在汇聚阶段的位置完全由时间决定:沿螺旋线从屏幕外收拢到 Logo 上 */
  const spiral = (p: Dot, k: number, out: Pt) => {
    const e = 1 - Math.pow(1 - clamp(k), 4)
    const ang = p.ta + (1 - e) * p.sw, rad = p.tr * L + (p.r0 - p.tr * L) * (1 - e)
    out.x = lc.x + Math.cos(ang) * rad; out.y = lc.y + Math.sin(ang) * rad
  }
  /** Logo 飞行轨迹上进度 p 处的位置:一条略微上拱的弧线 */
  const flight = (p: number, out: Pt) => {
    out.x = from.x + (to.x - from.x) * p
    out.y = from.y + (to.y - from.y) * p - Math.sin(p * Math.PI) * arc
  }
  const head: Pt = { x: 0, y: 0 }, tail: Pt = { x: 0, y: 0 }

  function explode() {
    if (skipped) return
    for (const g of groups) for (const p of g) {
      const a = Math.atan2(p.y - lc.y, p.x - lc.x) + (rnd() - 0.5) * 0.9, s = 160 + Math.pow(rnd(), 2.2) * 1500
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = 0.35 + rnd() * 0.75
    }
  }
  function beginFlight() {
    flying = true
    // 放开滚动锁后页面出现滚动条、宽度变化,所以落位点必须在这之后再量
    unlockScroll(); measure(); locate()
    from.x = lc.x; from.y = lc.y
    let tg: { x: number; y: number; size: number } | null = null
    try { tg = props.target?.() ?? null } catch { tg = null }
    if (!tg) {
      const r = document.querySelector<HTMLElement>('.lv .site-header .brand img')?.getBoundingClientRect()
      if (r && r.width) tg = { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width }
    }
    to.x = tg ? tg.x : from.x; to.y = tg ? tg.y : from.y; to.size = tg ? tg.size : L
    arc = Math.min(64, Math.hypot(to.x - from.x, to.y - from.y) * 0.14)
  }
  function land() {
    landed = true
    veil.style.background = 'transparent'
    iris.x = to.x; iris.y = to.y
    iris.R = Math.max(Math.hypot(to.x, to.y), Math.hypot(W - to.x, to.y), Math.hypot(to.x, H - to.y), Math.hypot(W - to.x, H - to.y))
    burst(to.x, to.y, Math.round(64 * density) + 10, 640)
    reveal()
  }

  function tick(now: number) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    clock += dt * speed
    const t = clock

    const st = t >= T.land ? 6 : t >= T.fly ? 5 : t >= T.pull ? 4 : t >= T.tag ? 3 : t >= T.name ? 2 : t >= T.ignite ? 1 : 0
    if (st !== stage.value) stage.value = st
    if (t >= T.ignite && !ignited) { ignited = true; explode() }
    if (t >= T.fly && !flying) beginFlight()
    if (t >= T.land && !landed) land()
    if (t >= T.end) return end()

    let fp = 0 // 飞行进度
    if (flying) {
      fp = inOut((t - T.fly) / (T.land - T.fly))
      flight(fp, lc)
      origin.x = lc.x; origin.y = lc.y
      logoScale = 1 + (to.size / L - 1) * fp
      logoBox.style.transform = `translate3d(${(lc.x - from.x).toFixed(1)}px,${(lc.y - from.y).toFixed(1)}px,0) scale(${logoScale.toFixed(3)})`
      if (fp > 0 && fp < 1) for (let i = 0; i < 6; i++) sparks.push({ x: lc.x, y: lc.y, vx: (rnd() - 0.5) * 300, vy: (rnd() - 0.5) * 300, life: 0.3 + rnd() * 0.5 })
    }

    const k = t - T.ignite // 点火后经过的秒数
    const q = landed ? clamp((t - T.land) / (T.end - T.land)) : 0 // 光圈展开进度

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'
    blit(haze, W * 0.16, H * 0.22, maxR * 0.9, 0.1)
    blit(haze, W * 0.86, H * 0.84, maxR * 0.8, 0.08)

    ctx.save()
    if (k > 0 && k < 0.38) {
      const amp = 10 * Math.pow(1 - k / 0.38, 2)
      ctx.translate((rnd() - 0.5) * 2 * amp, (rnd() - 0.5) * 2 * amp)
    }

    // 星流:点火前越冲越快,点火瞬间骤停成缓慢漂移
    const warp = k < 0 ? 60 + 1700 * Math.pow(t / T.ignite, 3) : 26 + 900 * Math.exp(-k * 9)
    const reach = maxR * 0.62
    ctx.strokeStyle = '#aacdff'
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.85 : 0.4; ctx.lineWidth = pass ? 1.5 : 1
      ctx.beginPath()
      for (const s of stars) {
        if (pass === 0) {
          s.r += warp * s.v * (0.25 + s.r / (maxR * 0.5)) * dt
          if (s.r > reach) { s.r = 8 + rnd() * maxR * 0.08; s.a = rnd() * 6.283 }
        }
        const far = s.r > reach * 0.38
        if (far !== (pass === 1)) continue
        const c = Math.cos(s.a), sn = Math.sin(s.a)
        const r0 = Math.max(0, s.r - Math.max(1.2, warp * s.v * (0.25 + s.r / (maxR * 0.5)) * 0.05))
        ctx.moveTo(origin.x + c * r0, origin.y + sn * r0); ctx.lineTo(origin.x + c * s.r, origin.y + sn * s.r)
      }
      ctx.stroke()
    }

    // 隧道:点火前一框接一框迎面掠过并越来越快,点火时被冲击波一次性推出画面
    const rush = 0.2 + 1.5 * Math.pow(clamp(t / T.ignite), 2.2)
    const gateIn = clamp(t / 0.4)
    for (const g of gates) {
      if (k < 0) { g.z -= rush * dt; if (g.z < 0.05) g.z += 0.95 }
      else g.z -= (4 * g.z + 0.3) * dt
      if (g.z < 0.05) continue
      const near = 1 - g.z
      const a = clamp(near / 0.25) * clamp((g.z - 0.05) / 0.2) * gateIn * 0.5
      const half = (L * 0.58) / g.z, rot = Math.pow(clamp(near), 1.5) * 0.9
      gate(origin.x, origin.y, half, rot, 6 + near * 6, a * 0.18, COLORS[g.c])
      gate(origin.x, origin.y, half, rot, 1 + near * 1.6, a, COLORS[g.c])
    }

    if (k < 0) {
      // 黑场里的一点光 → 粒子到位后光点退去,换成越来越强的光晕蓄能
      const g = clamp((t - T.gather) / (T.ignite - T.gather))
      blit(glow, lc.x, lc.y, L * (0.35 + 0.75 * outCubic(t / 0.35)), outCubic(t / 0.25) * (1 - clamp(g * 2.4)))
      blit(aura, lc.x, lc.y, L * (2 + g * g * 5.5) * (1 + 0.06 * Math.sin(t * 34) * g), 0.25 + 0.75 * g * g)
      groups.forEach((grp, gi) => {
        const bold = (gi & 1) === 1
        ctx.strokeStyle = COLORS[gi >> 1]; ctx.lineWidth = bold ? 2.6 : 1.4; ctx.globalAlpha = bold ? 1 : 0.85
        ctx.beginPath()
        for (const p of grp) {
          const kk = (t - T.gather - p.d) / p.dur
          if (kk <= 0) continue
          spiral(p, kk, head); spiral(p, kk - 0.034 / p.dur, tail)
          if (kk >= 1) { head.x += Math.sin(t * 11 + p.ph) * 0.7; head.y += Math.cos(t * 9 + p.ph) * 0.7; tail.x = head.x + 0.7; tail.y = head.y }
          p.x = head.x; p.y = head.y
          ctx.moveTo(tail.x, tail.y); ctx.lineTo(head.x, head.y)
        }
        ctx.stroke()
        if (!bold) return
        ctx.globalAlpha = 0.5
        for (const p of grp) if (p.x > -90) ctx.drawImage(dot, p.x - 8, p.y - 8, 16, 16)
      })
      // 三路请求沿弧线加速冲进 Logo,击中时在底板上激起一圈方环
      comets.forEach((c, i) => {
        const e = (t - (c.at - COMET_DUR)) / COMET_DUR
        if (e <= 0) return
        if (e >= 1) {
          if (!c.hit) { c.hit = true; pulses.push(t); burst(lc.x, lc.y, Math.round(10 * density) + 4, 260) }
          return
        }
        const x0 = c.sx * W, y0 = c.sy * H, dx = lc.x - x0, dy = lc.y - y0
        const mx = x0 + dx * 0.5 - dy * 0.3, my = y0 + dy * 0.5 + dx * 0.3
        for (let j = 0; j < 14; j++) {
          const ee = e - j * 0.022
          if (ee <= 0) break
          const u = ee * ee, v = 1 - u
          blit(tints[i], v * v * x0 + 2 * v * u * mx + u * u * lc.x, v * v * y0 + 2 * v * u * my + u * u * lc.y, j ? 30 - j * 1.6 : 46, j ? (1 - j / 14) * 0.55 : 1)
        }
      })
      for (const at of pulses) {
        const age = (t - at) / 0.45
        if (age < 1) gate(lc.x, lc.y, L * (0.56 + 0.9 * outCubic(age)), 0, 2, Math.pow(1 - age, 2) * 0.9, '#e6fff7')
      }
    } else {
      // 点火:闪白、爆开的光晕、镜头光条、放射光、冲击波,汇聚的粒子同时炸成火花
      const dim = landed ? Math.max(0, 1 - q * 1.6) : 1
      if (k < 0.3) { ctx.globalAlpha = 0.17 * Math.pow(1 - k / 0.3, 2); ctx.fillStyle = '#c8fff0'; ctx.fillRect(-20, -20, W + 40, H + 40) }
      blit(glow, lc.x, lc.y, L * (4 + 12 * outCubic(k / 0.45)), Math.exp(-k * 3.4))
      blit(glow, lc.x, lc.y, L * (3.4 + 0.25 * Math.sin(t * 3)) * logoScale, 0.42 * dim)
      streak(lc.x, lc.y, W * (0.3 + 1.5 * outCubic(k / 0.35)), 8 + 44 * Math.exp(-k * 7), Math.exp(-k * 4))
      // 放射光一直留到落位:飞行时跟着 Logo 走,不让画面空下来
      const rayA = clamp(k / 0.1) * (0.2 + 0.8 * Math.exp(-k * 1.9)) * dim
      if (rayA > 0.004) {
        const size = maxR * (0.5 + 0.9 * outCubic(k / 0.7)) * (1 - 0.4 * fp)
        ctx.save(); ctx.translate(origin.x, origin.y)
        ctx.rotate(0.4 + k * 0.1); ctx.globalAlpha = rayA * 0.9; ctx.drawImage(rays, -size / 2, -size / 2, size, size)
        ctx.rotate(1.7 - k * 0.32); ctx.globalAlpha = rayA * 0.5; ctx.drawImage(rays, -size * 0.4, -size * 0.4, size * 0.8, size * 0.8)
        ctx.restore()
      }
      for (let j = 0; j < 3; j++) {
        const kk = (k - j * 0.09) / 0.85
        if (kk <= 0 || kk >= 1) continue
        const r = L * 0.6 + outCubic(kk) * maxR * 0.55, a = Math.pow(1 - kk, 2)
        ring(origin.x, origin.y, r, 12 * (1 - kk) + 2, a * 0.22, COLORS[j % 2])
        ring(origin.x, origin.y, r, 1.6, a * 0.9, j ? COLORS[j % 2] : '#e6fff7')
      }
      // 蓄力:文字收进 Logo 的同时,一圈光向内收紧
      if (t >= T.pull && !flying) {
        const ch = clamp((t - T.pull) / (T.fly - T.pull))
        blit(aura, lc.x, lc.y, L * (6.5 - 3.5 * ch), ch * 0.9)
        ring(lc.x, lc.y, L * (2.4 - 1.7 * ch), 2, ch * 0.85, '#e6fff7')
      }
      // 飞行:Logo 身后拖一条光尾
      if (flying && !landed) {
        for (let j = 1; j < 12; j++) {
          const pj = inOut((t - j * 0.013 - T.fly) / (T.land - T.fly))
          if (pj <= 0) break
          flight(pj, tail)
          blit(glow, tail.x, tail.y, L * logoScale * (1.7 - j * 0.1), (1 - j / 12) * 0.5)
        }
      }
      const fade = 1 - k / 1.15
      if (fade > 0) {
        const drag = Math.pow(0.94, dt * 60)
        groups.forEach((grp, gi) => {
          ctx.strokeStyle = COLORS[gi >> 1]; ctx.lineWidth = gi & 1 ? 2.6 : 1.4; ctx.globalAlpha = fade
          ctx.beginPath()
          for (const p of grp) {
            if (p.life <= 0) continue
            p.life -= dt
            p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= drag; p.vy *= drag
            ctx.moveTo(p.x - p.vx * 0.05 - 0.7, p.y - p.vy * 0.05); ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        })
      }
    }

    ctx.restore()

    if (landed) {
      // 光圈:从落位点向外展开,把画布挖成透明,圈内露出页面(每帧只建这一个渐变)
      const feather = 30 + 110 * q, r = (1 - Math.pow(1 - q, 2.4)) * (iris.R + feather + 40)
      const hole = ctx.createRadialGradient(iris.x, iris.y, Math.max(0, r - feather), iris.x, iris.y, Math.max(1, r))
      hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.globalCompositeOperation = 'destination-out'
      ctx.globalAlpha = 1
      ctx.fillStyle = hole
      ctx.beginPath(); ctx.arc(iris.x, iris.y, Math.max(1, r), 0, 6.283); ctx.fill()
      ctx.globalCompositeOperation = 'lighter'
      const edge = r - feather * 0.45, a = 1 - q
      ring(iris.x, iris.y, edge, 22, a * 0.16, COLORS[1])
      ring(iris.x, iris.y, edge, 6, a * 0.5, COLORS[0])
      ring(iris.x, iris.y, edge, 1.6, a * 0.95, '#e6fff7')
      // 撞击:全片最强的一拍。放射光、光条、方环都画在光圈之后,直接压在刚露出的页面上
      const im = t - T.land
      if (im < 0.7) {
        const f = im / 0.7, size = maxR * (0.3 + outCubic(f))
        ctx.save(); ctx.translate(iris.x, iris.y); ctx.rotate(1.1 + im * 0.5)
        ctx.globalAlpha = Math.pow(1 - f, 2) * 0.75
        ctx.drawImage(rays, -size / 2, -size / 2, size, size)
        ctx.restore()
      }
      streak(iris.x, iris.y, W * (0.25 + 1.3 * outCubic(im / 0.3)), 6 + 34 * Math.exp(-im * 8), Math.exp(-im * 5.5))
      blit(glow, iris.x, iris.y, to.size * (3 + 10 * outCubic(im / 0.4)), Math.exp(-im * 5))
      for (let j = 0; j < 3; j++) {
        const kk = (im - j * 0.07) / 0.6
        if (kk <= 0 || kk >= 1) continue
        gate(iris.x, iris.y, to.size / 2 + outCubic(kk) * maxR * 0.2, 0, 2, Math.pow(1 - kk, 2) * 0.85, COLORS[j])
      }
    }

    // 火花:画在光圈之后,落位时能压在刚露出的页面上
    if (sparks.length) {
      const drag = Math.pow(0.92, dt * 60)
      ctx.strokeStyle = '#9ff7d6'; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.9
      ctx.beginPath()
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt
        if (s.life <= 0) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); continue }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= drag; s.vy *= drag
        ctx.moveTo(s.x - s.vx * 0.04 - 0.7, s.y - s.vy * 0.04); ctx.lineTo(s.x, s.y)
      }
      ctx.stroke()
    }
  }

  const frame = (now: number) => {
    raf = 0
    if (ended) return
    try {
      tick(now)
    } catch {
      return end()
    }
    if (!ended) raf = requestAnimationFrame(frame)
  }
  const arm = () => {
    clearTimeout(guard)
    guard = setTimeout(end, WATCHDOG_MS)
  }
  const onVisibility = () => {
    cancelAnimationFrame(raf); raf = 0
    clearTimeout(guard)
    if (document.hidden || ended) return
    last = 0
    arm()
    raf = requestAnimationFrame(frame)
  }
  const onResize = () => {
    if (flying) return
    measure(); locate()
    origin.x = lc.x; origin.y = lc.y
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skip() }
    else if (SCROLL_KEYS.has(e.key)) e.preventDefault()
  }
  const block = (e: Event) => e.preventDefault()

  // 第一次跳过:直接快进到"Logo 冲向落位点"的收束段;收束中再点一次则立即结束。
  // 渲染循环没在跑(页面被判定为不可见)时用户还能点到,说明状态不可信,直接收尾,不让人卡在黑场
  skipNow = () => {
    if (flying || !raf) return end()
    skipped = true
    fast.value = true
    for (const g of groups) for (const p of g) p.life = 0
    for (const g of gates) g.z = 0
    clock = T.fly
    speed = 1.7
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  root.addEventListener('wheel', block, { passive: false })
  root.addEventListener('touchmove', block, { passive: false })
  detach = () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    root.removeEventListener('wheel', block)
    root.removeEventListener('touchmove', block)
  }
  onVisibility()
}

onMounted(async () => {
  if (!shouldPlay()) return end()
  active.value = true
  document.documentElement.style.setProperty('overflow', 'hidden')
  locked = true
  await nextTick()
  if (ended) return
  try {
    run()
  } catch {
    end()
  }
})
onBeforeUnmount(() => {
  ended = true
  cancelAnimationFrame(raf)
  clearTimeout(guard)
  detach()
  unlockScroll()
})
</script>
