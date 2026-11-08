<template>
  <canvas
    ref="canvas"
    class="particle-sculpture"
    :aria-label="label"
    role="img"
    @pointermove="move"
    @pointerleave="pointer.active = false"
    @pointerdown="burst"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ mode?: number; label: string; paused?: boolean }>(),
  { mode: 0, paused: false }
)
const canvas = ref<HTMLCanvasElement>()
const pointer = { x: 0, y: 0, active: false }
let raf = 0
let observer: ResizeObserver | undefined
let intersection: IntersectionObserver | undefined
let motion: MediaQueryList | undefined
let visible = true
let width = 1
let height = 1
let time = 0
let last = 0
let pulse = 0
let morph = 0
let render: (() => void) | undefined
const count = 1200
// A deterministic distribution keeps the sculpture stable across remounts.
const dots = Array.from({ length: count }, (_, i) => {
  const y = 1 - (i / (count - 1)) * 2
  const r = Math.sqrt(1 - y * y)
  const angle = i * Math.PI * (3 - Math.sqrt(5))
  return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, a: angle, i }
})

const projected = Array.from({ length: count }, () => ({ x: 0, y: 0, depth: 0, size: 0, i: 0 }))
let activeCount = count
function move(e: PointerEvent) {
  const bounds = canvas.value!.getBoundingClientRect()
  pointer.x = e.clientX - bounds.left
  pointer.y = e.clientY - bounds.top
  pointer.active = true
}
function burst() {
  pulse = 1
  render?.()
}
function visibility() {
  last = 0
  render?.()
}
function motionChanged() {
  render?.()
}

onMounted(() => {
  const el = canvas.value!
  const ctx = el.getContext('2d', { alpha: true })
  if (!ctx) return
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  motion.addEventListener('change', motionChanged)
  const resize = () => {
    const rect = el.getBoundingClientRect()
    width = rect.width
    height = rect.height
    activeCount = width < 640 ? count / 2 : count
    const dpr = Math.min(window.devicePixelRatio || 1, width < 640 ? 1.25 : 1.5)
    el.width = Math.round(width * dpr)
    el.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    render?.()
  }
  const draw = () => {
    ctx.clearRect(0, 0, width, height)
    const scale = Math.min(width, height) * 0.32
    const angle = time * 0.15
    const ca = Math.cos(angle),
      sa = Math.sin(angle)
    const tilt = -0.23
    const ct = Math.cos(tilt),
      st = Math.sin(tilt)
    pulse *= 0.94
    morph += (props.mode - morph) * 0.045
    // Reuse projected records; depth-based opacity makes per-frame sorting unnecessary.
    const blend = Math.min(morph, 1), blend2 = Math.max(0, morph - 1)
    for (let i = 0; i < activeCount; i++) {
      const p = dots[i * (count / activeCount)]
      const theta = p.a + time * .14
      const ring = 1 + .35 * Math.cos(p.y * Math.PI * 5)
      const x = p.x * (1 - blend) + ring * Math.cos(theta) * blend * (1 - blend2) + p.x * 1.4 * blend2
      const y = p.y * (1 - blend) + .35 * Math.sin(p.y * Math.PI * 5) * blend * (1 - blend2) + (Math.sin(p.x * 5 + time + p.z * 3) * .3 + p.y * .2) * blend2
      const z = p.z * (1 - blend) + ring * Math.sin(theta) * blend * (1 - blend2) + p.z * 1.4 * blend2
      const rx = x * ca - z * sa, rz = x * sa + z * ca
      const ry = y * ct - rz * st, depth = y * st + rz * ct
      const perspective = 3.6 / (3.6 - depth)
      let px = width / 2 + rx * scale * perspective * (1 + pulse * .2)
      let py = height / 2 + ry * scale * perspective * (1 + pulse * .2)
      if (pointer.active) {
        const dx = px - pointer.x, dy = py - pointer.y
        const dist = Math.hypot(dx, dy), force = Math.max(0, 1 - dist / 110) * 26
        px += dx / (dist || 1) * force; py += dy / (dist || 1) * force
      }
      const target = projected[i]
      target.x = px; target.y = py; target.depth = depth; target.i = p.i
      target.size = (.65 + (depth + 1.5) * .44) * Math.min(width / 540, 1.2)
    }
    for (let i = 0; i < activeCount; i++) {
      const p = projected[i]
      const front = (p.depth + 1.5) / 3
      ctx.fillStyle =
        p.i % 11 === 0
          ? `rgba(192,91,242,${0.25 + front * 0.6})`
          : `rgba(94,57,212,${0.13 + front * 0.77})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(0.4, p.size), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const frame = (now: number) => {
    raf = 0
    if (!visible || document.hidden || props.paused) return
    if (!last || now - last >= 30) {
      time += last ? Math.min((now - last) / 1000, 0.05) : 0.033
      last = now
      draw()
    }
    if (!motion?.matches) raf = requestAnimationFrame(frame)
  }
  render = () => {
    if (motion?.matches || props.paused) {
      morph = props.mode
      draw()
    } else if (!raf) raf = requestAnimationFrame(frame)
  }
  observer = new ResizeObserver(resize)
  observer.observe(el)
  intersection = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting
    if (visible) {
      last = 0
      render?.()
    }
  })
  intersection.observe(el)
  document.addEventListener('visibilitychange', visibility)
  resize()
})
watch(
  () => props.mode,
  () => render?.()
)
watch(
  () => props.paused,
  () => {
    last = 0
    render?.()
  }
)
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  intersection?.disconnect()
  motion?.removeEventListener('change', motionChanged)
  document.removeEventListener('visibilitychange', visibility)
})
</script>

<style scoped>
.particle-sculpture {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
