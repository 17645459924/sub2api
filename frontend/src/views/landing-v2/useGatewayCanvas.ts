import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'

export interface GatewayNode {
  id: string
  label: string
  color: string
  path?: string
}

export interface GatewayCanvasOptions {
  canvas: Ref<HTMLCanvasElement | undefined>
  host: Ref<HTMLElement | undefined>
  visual: Ref<HTMLElement | undefined>
  logo: string
  hubLabel: Ref<string>
  clients: Ref<GatewayNode[]>
  models: Ref<GatewayNode[]>
  paused: Ref<boolean>
  dark: Ref<boolean>
  /** 悬停或点击的模型 id;非空时只点亮它对应的路由 */
  focusId?: Ref<string | null>
  /** 每完成一次"到达模型"回调一次,用于日志展示 */
  onRoute?: (client: GatewayNode, model: GatewayNode) => void
}

interface Pos { x: number; y: number }
interface Packet { c: number; m: number; t: number; dir: 1 | -1; sp: number; hubbed: boolean }
interface ShellPoint { x: number; y: number; z: number; tw: number }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; rgb: string }

/** 客户端 → 模型的可路由关系:Claude Code 只走 Claude,Codex 只走 GPT,curl 都可以。 */
const ROUTES: Record<string, string[]> = { cc: ['claude'], codex: ['gpt'], curl: ['claude', 'gpt', 'image'] }

/**
 * 首屏网关网络:Canvas 2D,零依赖。
 * 球面点阵为刚体旋转,邻接边预计算;不可见、标签页隐藏、暂停或减少动效时停止渲染并保留一帧静态画面。
 */
export function useGatewayCanvas(o: GatewayCanvasOptions) {
  let ctx: CanvasRenderingContext2D | null = null
  let W = 0, H = 0, DPR = 1, mobile = false
  let raf = 0, last = 0, clock = 0, visible = true
  let spawnIn = 0.3
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, tx: 0, ty: 0, inside: false }
  const hub = { x: 0, y: 0, size: 60, pulse: 0, rings: [] as { r: number; a: number }[] }
  const shell = { pts: [] as ShellPoint[], pairs: [] as number[], R: 200, proj: [] as (Pos & { z: number; s: number; tw: number })[] }
  const flash = new Map<string, number>()
  const base = new Map<string, Pos>()
  let dust: { x: number; y: number; vx: number; vy: number; r: number; tw: number }[] = []
  let packets: Packet[] = []
  let sparks: Spark[] = []
  // 入场进度 0→1:球面从中心节点撑开,工具与模型标签依次从中心飞到各自位置
  let boot = 1, bootBurst = true
  const order = new Map<string, number>()
  const glows = new Map<string, HTMLCanvasElement | null>()
  const logoImg = new Image()
  logoImg.src = o.logo
  const reduceMq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  let io: IntersectionObserver | undefined
  let ro: ResizeObserver | undefined

  const pal = () =>
    o.dark.value
      ? { dot: '120,190,255', link: '80,150,255', mint: '121,244,189', chip: 'rgba(8,16,40,0.82)', chipLine: 'rgba(138,160,200,0.28)', text: '#eaf1ff', sub: '#8aa0c8', route: '57,217,231', light: false }
      : { dot: '30,90,200', link: '37,99,235', mint: '15,159,110', chip: 'rgba(255,255,255,0.92)', chipLine: 'rgba(30,55,110,0.18)', text: '#0a1531', sub: '#45577c', route: '37,99,235', light: true }
  let P = pal()

  const running = () => !o.paused.value && visible && !(reduceMq?.matches ?? false)
  const focus = () => o.focusId?.value ?? null
  const modelLit = (i: number) => !focus() || o.models.value[i]?.id === focus()
  const clientLit = (ci: number) => {
    const f = focus()
    if (!f) return true
    return (ROUTES[o.clients.value[ci]?.id] || []).includes(f)
  }

  function rel(el: HTMLElement) {
    const a = el.getBoundingClientRect(), b = o.host.value!.getBoundingClientRect()
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }
  }

  function layout() {
    const host = o.host.value, canvas = o.canvas.value
    if (!host || !canvas) return
    const r = host.getBoundingClientRect()
    W = Math.max(1, r.width); H = Math.max(1, r.height)
    mobile = W < 760
    DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR)
    ctx = canvas.getContext('2d')
    ctx?.setTransform(DPR, 0, 0, DPR, 0, 0)

    const v = o.visual.value ? rel(o.visual.value) : { x: W * 0.5, y: 0, w: W * 0.5, h: H }
    const logEl = o.visual.value?.querySelector<HTMLElement>('[data-gateway-log]')
    const logH = logEl ? logEl.getBoundingClientRect().height : 0
    const h = Math.max(220, v.h - (mobile ? logH + 18 : logH * 0.55))
    hub.size = mobile ? 50 : 62
    hub.x = v.x + v.w * 0.5; hub.y = v.y + h * (mobile ? 0.5 : 0.47)
    const spread = mobile ? [0.18, 0.5, 0.82] : [0.2, 0.47, 0.74]
    const cx = v.x + v.w * (mobile ? 0.13 : 0.1), mx = v.x + v.w * (mobile ? 0.87 : 0.9)
    o.clients.value.forEach((c, i) => { base.set('c:' + c.id, { x: cx, y: v.y + h * spread[i % 3] }); order.set('c:' + c.id, i * 2) })
    o.models.value.forEach((m, i) => { base.set('m:' + m.id, { x: mx, y: v.y + h * spread[i % 3] }); order.set('m:' + m.id, i * 2 + 1) })

    shell.R = Math.min(v.w * 0.5, h * 0.5) * 0.92
    const n = mobile ? 64 : 120
    const g = Math.PI * (3 - Math.sqrt(5))
    seed = 7
    shell.pts = Array.from({ length: n }, (_, i) => {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = g * i
      return { x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, tw: rnd() * 6.28 }
    })
    shell.pairs = []
    const lim = mobile ? 0.5 : 0.36
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const p = shell.pts[a], q = shell.pts[b]
      if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < lim) shell.pairs.push(a, b)
    }
    const dn = mobile ? 26 : 56
    if (dust.length !== dn) dust = Array.from({ length: dn }, () => ({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 8, vy: (rnd() - 0.5) * 8, r: rnd() * 1.3 + 0.4, tw: rnd() * 6.28 }))
    if (!running()) draw()
  }

  const font = (size: number) => `600 ${size}px Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei UI", sans-serif`
  const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  const backOut = (x: number) => { const y = x - 1; return 1 + 2.4 * y * y * y + 1.4 * y * y }
  const nodeK = (key: string) => (boot >= 1 ? 1 : clamp01((boot - 0.12 - (order.get(key) || 0) * 0.05) / 0.55))
  function nodePos(key: string): Pos {
    const b = base.get(key) || { x: 0, y: 0 }
    const k = nodeK(key), e = k >= 1 ? 1 : backOut(k)
    return { x: hub.x + (b.x - hub.x) * e + mouse.nx * (mobile ? 0 : 10), y: hub.y + (b.y - hub.y) * e + mouse.ny * (mobile ? 0 : 8) }
  }
  /** 预渲染的光晕贴图,按颜色缓存;每帧只做 drawImage,不再创建渐变 */
  function glowOf(rgb: string) {
    let s = glows.get(rgb)
    if (s === undefined) {
      s = null
      const cv = document.createElement('canvas')
      cv.width = cv.height = 64
      const g = cv.getContext('2d')
      if (g) {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
        gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(1, `rgba(${rgb},0)`)
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
        s = cv
      }
      glows.set(rgb, s)
    }
    return s
  }
  function glowAt(rgb: string, x: number, y: number, r: number, alpha: number) {
    const s = glowOf(rgb)
    if (!ctx || !s || alpha <= 0) return
    ctx.globalAlpha = Math.min(1, alpha)
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2)
    ctx.globalAlpha = 1
  }
  const hubPos = (): Pos => ({ x: hub.x + mouse.nx * 4, y: hub.y + mouse.ny * 3 })
  function chipW(label: string) {
    if (!ctx) return 60
    ctx.font = font(mobile ? 11.5 : 12.5)
    return ctx.measureText(label).width + (mobile ? 20 : 26)
  }
  function anchor(node: GatewayNode, side: 'client' | 'model') {
    const p = nodePos((side === 'client' ? 'c:' : 'm:') + node.id), w = chipW(node.label)
    const x = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, p.x))
    return { x: side === 'client' ? x + w / 2 : x - w / 2, y: p.y, cx: x, w }
  }
  function bez(a: Pos, b: Pos, t: number): Pos {
    const dx = (b.x - a.x) * 0.55, u = 1 - t
    return {
      x: u * u * u * a.x + 3 * u * u * t * (a.x + dx) + 3 * u * t * t * (b.x - dx) + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * b.y,
    }
  }
  const hubEdge = (side: 'left' | 'right'): Pos => { const h = hubPos(), s = hub.size / 2; return { x: h.x + (side === 'left' ? -s : s), y: h.y } }
  function routePoint(pk: Packet, t: number) {
    const c = anchor(o.clients.value[pk.c], 'client'), m = anchor(o.models.value[pk.m], 'model')
    const hl = hubEdge('left'), hr = hubEdge('right')
    if (pk.dir === 1) return t < 1 ? bez(c, hl, t) : bez(hr, m, t - 1)
    return t < 1 ? bez(m, hr, t) : bez(hl, c, t - 1)
  }

  function spawn(delay = 0) {
    const clients = o.clients.value, models = o.models.value
    if (!clients.length || !models.length) return
    const f = focus()
    const ci = Math.floor(rnd() * clients.length)
    const allowed = ROUTES[clients[ci].id] || models.map((m) => m.id)
    const choices = models.map((m, i) => (allowed.includes(m.id) && (!f || m.id === f) ? i : -1)).filter((i) => i >= 0)
    if (!choices.length) return
    const mi = choices[Math.floor(rnd() * choices.length)]
    packets.push({ c: ci, m: mi, t: -delay, dir: 1, sp: 0.85 + rnd() * 0.35, hubbed: false })
  }
  function burst(n = 10) {
    for (let i = 0; i < n; i++) spawn(i * 0.07)
    hub.rings.push({ r: 0, a: 1 })
    hub.rings.push({ r: -18, a: 0.8 })
  }
  function emit(p: Pos, rgb: string, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, s = 30 + rnd() * 90
      sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + rnd() * 0.5, rgb })
    }
  }

  function step(dt: number) {
    clock += dt
    if (boot < 1) {
      boot = Math.min(1, boot + dt / 1.3)
      if (!bootBurst && boot > 0.4) {
        bootBurst = true
        // 第一批请求直接从中心节点发往各个模型,日志能尽快有内容
        o.models.value.forEach((m, mi) => {
          const ci = o.clients.value.findIndex((c) => (ROUTES[c.id] || []).includes(m.id))
          if (ci >= 0) packets.push({ c: ci, m: mi, t: 1 - mi * 0.1, dir: 1, sp: 1, hubbed: true })
        })
        burst(mobile ? 5 : 8)
      }
    }
    mouse.nx += (mouse.tx - mouse.nx) * Math.min(1, dt * 4)
    mouse.ny += (mouse.ty - mouse.ny) * Math.min(1, dt * 4)
    spawnIn -= dt
    if (spawnIn <= 0) { spawn(); spawnIn = (focus() ? 0.16 : 0.28) + rnd() * 0.5 }
    for (let i = packets.length - 1; i >= 0; i--) {
      const pk = packets[i]
      pk.t += dt * pk.sp
      if (pk.t >= 1 && !pk.hubbed) { pk.hubbed = true; hub.pulse = 1; emit(hubPos(), P.mint, 5) }
      if (pk.t >= 2) {
        if (pk.dir === 1) {
          const m = o.models.value[pk.m], c = o.clients.value[pk.c]
          flash.set('m:' + m.id, 1)
          emit(anchor(m, 'model'), hexRgb(m.color), 10)
          o.onRoute?.(c, m)
          packets[i] = { c: pk.c, m: pk.m, t: 0, dir: -1, sp: pk.sp * 1.1, hubbed: false }
        } else {
          flash.set('c:' + o.clients.value[pk.c].id, 1)
          packets.splice(i, 1)
        }
      }
    }
    hub.pulse = Math.max(0, hub.pulse - dt * 2.5)
    if (hub.pulse > 0.95 && hub.rings.length < 6 && rnd() < 0.5) hub.rings.push({ r: 0, a: 0.8 })
    hub.rings.forEach((r) => { r.r += dt * 90; r.a -= dt * 0.9 })
    hub.rings = hub.rings.filter((r) => r.a > 0)
    flash.forEach((v, k) => flash.set(k, Math.max(0, v - dt * 1.8)))
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94; s.life -= dt
      if (s.life <= 0) sparks.splice(i, 1)
    }
    for (const d of dust) {
      d.x += d.vx * dt; d.y += d.vy * dt
      if (mouse.inside) {
        const dx = mouse.x - d.x, dy = mouse.y - d.y, dd = Math.hypot(dx, dy)
        if (dd < 180 && dd > 1) { d.x += (dx / dd) * dt * 14; d.y += (dy / dd) * dt * 14 }
      }
      if (d.x < -10) d.x = W + 10
      if (d.x > W + 10) d.x = -10
      if (d.y < -10) d.y = H + 10
      if (d.y > H + 10) d.y = -10
    }
  }

  function rr(x: number, y: number, w: number, h: number, r: number) {
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  }
  function hexRgb(hex: string) { const n = parseInt(hex.slice(1), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }

  function draw() {
    if (!ctx) return
    const c = ctx
    c.clearRect(0, 0, W, H)
    // 尘埃
    for (const d of dust) {
      const tw = 0.5 + 0.5 * Math.sin(clock * 1.3 + d.tw)
      c.fillStyle = `rgba(${P.dot},${(0.12 + tw * 0.3).toFixed(3)})`
      c.beginPath(); c.arc(d.x, d.y, d.r, 0, 6.283); c.fill()
      if (mouse.inside) {
        const dd = Math.hypot(mouse.x - d.x, mouse.y - d.y)
        if (dd < 160) {
          c.strokeStyle = `rgba(${P.mint},${((1 - dd / 160) * 0.35).toFixed(3)})`
          c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(mouse.x, mouse.y); c.stroke()
        }
      }
    }
    // 球面点阵
    const booting = boot < 1
    const shellA = booting ? clamp01(boot * 3) : 1
    const h = hubPos(), R = shell.R * (booting ? backOut(clamp01(boot / 0.75)) : 1)
    const yaw = clock * 0.07 + mouse.nx * 0.45 + (booting ? (1 - boot) * (1 - boot) * 2.2 : 0), pitch = 0.32 + mouse.ny * 0.3
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), f = 3.2
    shell.pts.forEach((p, i) => {
      const x = p.x * cy - p.z * sy
      let z = p.x * sy + p.z * cy
      const y = p.y * cp - z * sp
      z = p.y * sp + z * cp
      const s = f / (f + z)
      shell.proj[i] = { x: h.x + x * R * s, y: h.y + y * R * s, z, s, tw: p.tw }
    })
    c.lineWidth = 1
    for (let k = 0; k < shell.pairs.length; k += 2) {
      const a = shell.proj[shell.pairs[k]], b = shell.proj[shell.pairs[k + 1]]
      const depth = 1 - (a.z + b.z + 2) / 4
      c.strokeStyle = `rgba(${P.link},${((0.05 + depth * 0.26) * (P.light ? 0.9 : 1) * shellA).toFixed(3)})`
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke()
    }
    for (const q of shell.proj) {
      const dep = 1 - (q.z + 1) / 2, tw = 0.65 + 0.35 * Math.sin(clock * 1.6 + q.tw)
      c.fillStyle = `rgba(${dep > 0.55 ? P.mint : P.dot},${((0.2 + dep * 0.75) * tw * shellA).toFixed(3)})`
      c.beginPath(); c.arc(q.x, q.y, 0.7 + dep * 2 * q.s, 0, 6.283); c.fill()
    }
    // 路由线(悬停某个模型时,只留它对应的一条亮线,其余压暗)
    const hl = hubEdge('left'), hr = hubEdge('right')
    const stroke = (a: Pos, b: Pos, lit: boolean, rgb: string, k: number) => {
      const dx = (b.x - a.x) * 0.55
      c.beginPath(); c.moveTo(a.x, a.y); c.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y)
      c.strokeStyle = `rgba(${rgb},${((lit ? (focus() ? 0.85 : 0.4) : 0.07) * k).toFixed(3)})`; c.stroke()
    }
    c.lineWidth = 1.3; c.setLineDash([3, 7]); c.lineDashOffset = -clock * 26
    o.clients.value.forEach((n, i) => stroke(anchor(n, 'client'), hl, clientLit(i), P.route, nodeK('c:' + n.id)))
    o.models.value.forEach((n, i) => stroke(hr, anchor(n, 'model'), modelLit(i), hexRgb(n.color), nodeK('m:' + n.id)))
    c.setLineDash([])
    // 数据包
    c.globalCompositeOperation = P.light ? 'source-over' : 'lighter'
    for (const pk of packets) {
      if (pk.t < 0) continue
      const col = pk.dir === 1 ? hexRgb(o.models.value[pk.m].color) : P.mint
      for (let k = 11; k >= 0; k--) {
        const tt = pk.t - k * 0.02
        if (tt < 0) continue
        const p = routePoint(pk, tt)
        c.fillStyle = `rgba(${col},${((1 - k / 12) * (k === 0 ? 1 : 0.5)).toFixed(3)})`
        c.beginPath(); c.arc(p.x, p.y, k === 0 ? 3.4 : 2.8 - k * 0.2, 0, 6.283); c.fill()
      }
      const head = routePoint(pk, pk.t)
      glowAt(col, head.x, head.y, 20, 0.7)
    }
    // 到达时的火花
    for (const s of sparks) {
      c.fillStyle = `rgba(${s.rgb},${Math.max(0, Math.min(1, s.life * 1.6)).toFixed(3)})`
      c.beginPath(); c.arc(s.x, s.y, 1.6, 0, 6.283); c.fill()
    }
    c.globalCompositeOperation = 'source-over'
    // 节点标签
    const chip = (n: GatewayNode, side: 'client' | 'model', color: string, lit: boolean) => {
      const a = anchor(n, side), ch = mobile ? 26 : 30, x = a.cx - a.w / 2, y = a.y - ch / 2
      const key = (side === 'client' ? 'c:' : 'm:') + n.id
      const fl = flash.get(key) || 0
      const alpha = (lit ? 1 : 0.35) * clamp01(nodeK(key) * 2.5)
      if (alpha <= 0) return
      c.save()
      c.globalAlpha = alpha
      if (fl > 0) { c.shadowColor = color; c.shadowBlur = 26 * fl }
      rr(x, y, a.w, ch, ch / 2); c.fillStyle = P.chip; c.fill()
      c.lineWidth = 1; c.strokeStyle = fl > 0.05 || (focus() === n.id) ? color : P.chipLine; c.stroke()
      c.restore()
      c.save(); c.globalAlpha = alpha
      c.fillStyle = color; c.beginPath(); c.arc(x + (mobile ? 10 : 13), a.y, 3, 0, 6.283); c.fill()
      c.fillStyle = P.text; c.font = font(mobile ? 11.5 : 12.5); c.textBaseline = 'middle'; c.textAlign = 'left'
      c.fillText(n.label, x + (mobile ? 16 : 21), a.y + 0.5)
      c.restore()
    }
    o.clients.value.forEach((n, i) => chip(n, 'client', '#79f4bd', clientLit(i)))
    o.models.value.forEach((n, i) => chip(n, 'model', n.color, modelLit(i)))
    // 中心节点
    const s = hub.size
    for (const r of hub.rings) {
      if (r.r < 0) continue
      c.strokeStyle = `rgba(${P.mint},${(r.a * 0.6).toFixed(3)})`; c.lineWidth = 1.5
      rr(h.x - s / 2 - r.r, h.y - s / 2 - r.r, s + r.r * 2, s + r.r * 2, 16 + r.r * 0.6); c.stroke()
    }
    glowAt('57,217,231', h.x, h.y, s * 2.4, 0.34 + hub.pulse * 0.3)
    c.save(); c.translate(h.x, h.y); c.rotate(clock * 0.6)
    c.strokeStyle = `rgba(${P.mint},0.55)`; c.lineWidth = 1.5
    c.beginPath(); c.arc(0, 0, s * 0.92, 0, Math.PI * 0.5); c.stroke()
    c.strokeStyle = 'rgba(56,117,246,0.55)'; c.beginPath(); c.arc(0, 0, s * 0.92, Math.PI, Math.PI * 1.4); c.stroke()
    c.restore()
    const sc = 1 + hub.pulse * 0.05
    if (logoImg.complete && logoImg.naturalWidth) c.drawImage(logoImg, h.x - (s * sc) / 2, h.y - (s * sc) / 2, s * sc, s * sc)
    else { rr(h.x - s / 2, h.y - s / 2, s, s, 14); c.fillStyle = '#0a1a39'; c.fill() }
    c.fillStyle = P.sub; c.font = font(mobile ? 10.5 : 11.5); c.textAlign = 'center'; c.textBaseline = 'top'
    c.globalAlpha = booting ? clamp01((boot - 0.45) * 3) : 1
    c.fillText(o.hubLabel.value.toUpperCase(), h.x, h.y + s / 2 + 12)
    c.globalAlpha = 1
    c.textAlign = 'left'
  }

  function frame(now: number) {
    raf = 0
    if (!running()) return
    const dt = Math.min(0.05, (now - (last || now)) / 1000)
    last = now
    step(dt); draw()
    raf = requestAnimationFrame(frame)
  }
  function seedStatic() {
    const n = Math.min(o.models.value.length, 3)
    packets = n ? [
      { c: 0, m: 0, t: 0.55, dir: 1, sp: 1, hubbed: true },
      { c: Math.min(1, o.clients.value.length - 1), m: Math.min(1, n - 1), t: 1.45, dir: 1, sp: 1, hubbed: true },
      { c: Math.min(2, o.clients.value.length - 1), m: n - 1, t: 0.8, dir: -1, sp: 1, hubbed: false },
    ] : []
    clock = 3
  }
  function sync() {
    if (running()) { if (!raf) { last = 0; raf = requestAnimationFrame(frame) } }
    else { if (raf) cancelAnimationFrame(raf); raf = 0; boot = 1; bootBurst = true; if (!packets.length) seedStatic(); draw() }
  }
  /** 播放一次入场:网络从中心节点展开。减少动效时不播放。 */
  function intro() {
    if (!ctx || !running()) return
    boot = 0; bootBurst = false
    packets = []; sparks = []
    spawnIn = 0.7
    hub.pulse = 1
    hub.rings = [{ r: 0, a: 1 }, { r: -22, a: 0.9 }, { r: -46, a: 0.8 }]
    // 接住进场动画的撞击:中心节点先溅出一圈火花,网络再从这里撑开
    emit(hubPos(), P.mint, mobile ? 14 : 28)
    draw()
  }
  /** 中心节点在视口里的位置;不在可视范围内时返回 null(进场动画据此决定 Logo 落到哪里) */
  function hubPoint() {
    const host = o.host.value
    if (!host || !ctx) return null
    // 调用方刚放开滚动锁,页面宽度可能变了:先同步重排一次,保证位置是最新的
    layout()
    const r = host.getBoundingClientRect()
    const x = r.left + hub.x, y = r.top + hub.y
    if (x < hub.size || x > window.innerWidth - hub.size || y < 96 || y > window.innerHeight - 96) return null
    return { x, y, size: hub.size }
  }

  const onMove = (e: PointerEvent) => {
    const r = o.host.value!.getBoundingClientRect()
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = e.pointerType === 'mouse'
    mouse.tx = (mouse.x / W - 0.5) * 2; mouse.ty = (mouse.y / H - 0.5) * 2
    // 悬停到右侧某个模型标签上:点亮它的路由
    if (o.focusId && mouse.inside) {
      let hit: string | null = null
      for (const m of o.models.value) {
        const a = anchor(m, 'model')
        if (Math.abs(mouse.x - a.cx) < a.w / 2 + 6 && Math.abs(mouse.y - a.y) < 20) { hit = m.id; break }
      }
      if (o.focusId.value !== hit) o.focusId.value = hit
    }
  }
  const onLeave = () => { mouse.inside = false; mouse.tx = 0; mouse.ty = 0; if (o.focusId) o.focusId.value = null }
  const onClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a,button,input,code')) return
    burst(12)
    if (!running()) { step(0.6); draw() }
  }
  const onVisibility = () => { visible = !document.hidden; sync() }

  onMounted(() => {
    const host = o.host.value
    if (!host || !o.canvas.value?.getContext) return
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('click', onClick)
    document.addEventListener('visibilitychange', onVisibility)
    reduceMq?.addEventListener?.('change', sync)
    logoImg.onload = () => { if (!running()) draw() }
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(layout); ro.observe(host) }
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; sync() })
      io.observe(host)
    }
    layout()
    if (reduceMq?.matches) seedStatic()
    else if (boot >= 1) { for (let i = 0; i < 4; i++) spawn(i * 0.25); burst(6) }
    sync()
  })
  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf)
    const host = o.host.value
    host?.removeEventListener('pointermove', onMove)
    host?.removeEventListener('pointerleave', onLeave)
    host?.removeEventListener('click', onClick)
    document.removeEventListener('visibilitychange', onVisibility)
    reduceMq?.removeEventListener?.('change', sync)
    ro?.disconnect(); io?.disconnect()
  })
  watch(o.paused, sync)
  watch(o.dark, () => { P = pal(); draw() })
  watch([o.clients, o.models, o.hubLabel], () => { layout(); draw() }, { deep: true })

  return { burst, intro, hubPoint }
}
