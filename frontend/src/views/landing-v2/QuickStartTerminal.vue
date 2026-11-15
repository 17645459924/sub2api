<template>
  <div ref="root" class="term">
    <div class="term-bar">
      <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <div class="seg" role="tablist" :aria-label="t('landingV2.quickstart.toolLabel')" @keydown="onTabKey">
        <button
          v-for="item in tools"
          :id="`lv-tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="tool === item.id"
          :tabindex="tool === item.id ? 0 : -1"
          @click="emit('update:tool', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="seg seg-os" role="group" :aria-label="t('landingV2.quickstart.osLabel')">
        <button v-for="item in oses" :key="item.id" type="button" :aria-pressed="os === item.id" @click="os = item.id">{{ item.label }}</button>
      </div>
      <button type="button" class="copy-btn" :class="{ done: copyState === 'copied' }" :aria-label="t('landingV2.quickstart.copy')" @click="copy">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>
        <span>{{ copyLabel }}</span>
      </button>
    </div>
    <div class="term-body" tabindex="0"><pre data-testid="lv-code" :aria-label="code"><span v-html="highlighted"></span><span v-if="typing" class="cur"></span></pre></div>
    <div class="term-run" :class="{ on: runStep > 0 }" aria-hidden="true" data-testid="lv-run">
      <p class="run-cmd mono"><span class="pr">$</span> {{ runCmd }}<span v-if="runStep === 1" class="cur"></span></p>
      <ol class="run-pipe">
        <li v-for="(p, i) in pipeKeys" :key="p" :class="{ ok: runStep > 1 || (runStep === 1 && runTick > i) }">
          <i></i><span>{{ t(`landingV2.journey.${p}`) }}</span>
        </li>
      </ol>
      <p class="run-out mono">{{ runOut }}</p>
      <div class="run-usage">
        <span class="chip-demo">{{ t('landingV2.journey.demo') }}</span>
        <span>{{ t('landingV2.journey.usageTitle') }}</span>
        <b class="bar"><i :style="{ '--fill': runStep > 2 ? 0.42 : 0 }"></i></b>
        <b class="bar"><i :style="{ '--fill': runStep > 2 ? 0.82 : 0 }"></i></b>
        <b class="bar"><i :style="{ '--fill': runStep > 2 ? 0.3 : 0 }"></i></b>
      </div>
    </div>
    <div class="term-foot">
      <span class="mono dim">{{ fileLabel }}</span>
      <span class="dim">{{ footNote }}</span>
      <button type="button" class="link-btn small" @click="play">↻ {{ t('landingV2.quickstart.replay') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildLandingCode, claudeSettingsPath, type LandingCodeOS, type LandingCodeTool } from '@/utils/landingCode'

const props = defineProps<{
  tool: LandingCodeTool
  apiBase: string
  siteName: string
  animate: boolean
  /** 写入 Claude Code 配置的默认模型,取自模型广场;没有数据时不写,避免展示不存在的模型 */
  claudeModel?: string
}>()
const emit = defineEmits<{ 'update:tool': [LandingCodeTool] }>()
const { t } = useI18n()

const tools = [
  { id: 'claude' as const, label: 'Claude Code' },
  { id: 'codex' as const, label: 'Codex' },
  { id: 'curl' as const, label: 'curl' },
]
const oses = [
  { id: 'unix' as const, label: 'macOS / Linux' },
  { id: 'win' as const, label: 'Windows' },
]
const os = ref<LandingCodeOS>('unix')
const root = ref<HTMLElement>()
const shown = ref(Number.POSITIVE_INFINITY)
const seen = ref(false)
const copyState = ref<'idle' | 'copied' | 'error'>('idle')
let raf = 0
let copyTimer: ReturnType<typeof setTimeout> | undefined
let io: IntersectionObserver | undefined

const code = computed(() =>
  buildLandingCode({
    tool: props.tool,
    os: os.value,
    apiBase: props.apiBase,
    siteName: props.siteName,
    comment: t('landingV2.quickstart.comment'),
    curlHint: t('landingV2.quickstart.curlHint'),
    claudeFormat: 'settings',
    model: props.claudeModel,
  }),
)
const fileLabel = computed(() => {
  if (props.tool === 'claude') return claudeSettingsPath(os.value)
  if (props.tool === 'codex') return os.value === 'win' ? '%USERPROFILE%\\.codex\\config.toml' : '~/.codex/config.toml'
  return os.value === 'win' ? 'powershell' : 'bash'
})
const footNote = computed(() => (props.tool === 'claude' ? t('landingV2.quickstart.claudeFoot') : t('landingV2.quickstart.foot')))
const typing = computed(() => props.animate && seen.value && shown.value < code.value.length)
const copyLabel = computed(() =>
  copyState.value === 'copied' ? t('landingV2.quickstart.copied') : copyState.value === 'error' ? t('landingV2.quickstart.copyFailed') : t('landingV2.quickstart.copy'),
)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
function hl(line: string) {
  // settings.json:键与字符串分别着色,括号保持原色
  if (props.tool === 'claude') {
    return esc(line).replace(/^(\s*)("[^"]+")(:\s*)("[^"]*")(,?)$/, '$1<span class="p">$2</span>$3<span class="s">$4</span>$5')
      .replace(/^(\s*)("[^"]+")(:\s*)(\{)$/, '$1<span class="p">$2</span>$3$4')
  }
  if (/^\s*#/.test(line)) return `<span class="c">${esc(line)}</span>`
  if (/^\[.*\]$/.test(line)) return `<span class="k">${esc(line)}</span>`
  // 先按引号切分再分别着色,避免后插入的标签属性被字符串规则误匹配
  let out = line
    .split(/("[^"]*"?)/)
    .map((part, i) => {
      if (i % 2) return `<span class="s">${esc(part)}</span>`
      let s = esc(part)
      if (i === 0) {
        s = s.replace(/^(export |\$env:)/, '<span class="k">$1</span>')
        s = s.replace(/^([a-z_]+)( = )/, '<span class="p">$1</span>$2')
      }
      return s
    })
    .join('')
  if (/^(npm|claude|codex|curl)\b/.test(line)) out = '<span class="pr">$ </span>' + out
  return out
}
const highlighted = computed(() => code.value.slice(0, shown.value).split('\n').map(hl).join('\n'))

/* ---------- 配置打完之后,接着发一次请求:命令 → 网关四步 → 流式回复 → 用量入账 ---------- */
const pipeKeys = ['pipe1', 'pipe2', 'pipe3', 'pipe4'] as const
const runStep = ref(0) // 0 未开始 · 1 校验中 · 2 流式回复 · 3 用量入账
const runTick = ref(0)
const runTyped = ref(0)
let runTimers: ReturnType<typeof setTimeout>[] = []
const runCmd = computed(() => {
  const ask = t('landingV2.journey.reqContent')
  if (props.tool === 'claude') return `claude "${ask}"`
  if (props.tool === 'codex') return `codex "${ask}"`
  return `curl … -d '{"input": "${ask}"}'`
})
const runText = computed(() => `${t('landingV2.journey.stream1')}\n${t('landingV2.journey.stream2')}`)
const runOut = computed(() => (runStep.value >= 2 ? runText.value.slice(0, runStep.value > 2 ? undefined : runTyped.value) : ''))

function clearRun() {
  runTimers.forEach(clearTimeout)
  runTimers = []
}
function later(fn: () => void, ms: number) {
  runTimers.push(setTimeout(fn, ms))
}
function resetRun(full = false) {
  clearRun()
  runStep.value = full ? 3 : 0
  runTick.value = full ? 4 : 0
  runTyped.value = 0
}
function playRun() {
  clearRun()
  if (!props.animate) return resetRun(true)
  runStep.value = 1
  runTick.value = 0
  runTyped.value = 0
  for (let i = 1; i <= 4; i++) later(() => (runTick.value = i), i * 380)
  later(() => {
    runStep.value = 2
    const total = runText.value.length
    const tickType = () => {
      runTyped.value = Math.min(total, runTyped.value + 2)
      if (runTyped.value < total) later(tickType, 28)
      else later(() => (runStep.value = 3), 250)
    }
    tickType()
  }, 1900)
}

function play() {
  cancelAnimationFrame(raf)
  resetRun(!props.animate || !seen.value)
  if (!props.animate || !seen.value) {
    shown.value = Number.POSITIVE_INFINITY
    return
  }
  const start = performance.now()
  const total = code.value.length
  const tick = (now: number) => {
    shown.value = Math.min(total, Math.floor(((now - start) / 1000) * 90))
    if (shown.value < total) raf = requestAnimationFrame(tick)
    else playRun()
  }
  shown.value = 0
  raf = requestAnimationFrame(tick)
}

// 复制始终复制完整配置,与打字进度无关
async function copy() {
  try {
    await navigator.clipboard.writeText(code.value)
    copyState.value = 'copied'
  } catch {
    copyState.value = 'error'
  }
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copyState.value = 'idle'), 1600)
}

function onTabKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const i = tools.findIndex((x) => x.id === props.tool)
  const next = tools[(i + (e.key === 'ArrowRight' ? 1 : tools.length - 1)) % tools.length].id
  emit('update:tool', next)
  root.value?.querySelector<HTMLElement>(`#lv-tab-${next}`)?.focus()
}

watch([() => props.tool, os], play)
watch(() => props.animate, (v) => { if (!v) { cancelAnimationFrame(raf); shown.value = Number.POSITIVE_INFINITY; resetRun(true) } })
onMounted(() => {
  if (!props.animate || typeof IntersectionObserver === 'undefined' || !root.value) {
    seen.value = true
    return
  }
  io = new IntersectionObserver(
    (es) => {
      if (es[0].isIntersecting && !seen.value) {
        seen.value = true
        play()
        io?.disconnect()
      }
    },
    { threshold: 0.35 },
  )
  io.observe(root.value)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearRun()
  clearTimeout(copyTimer)
  io?.disconnect()
})

defineExpose({ code })
</script>
