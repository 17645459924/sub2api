<template>
  <div class="integration-guide">
    <header class="guide-header">
      <router-link to="/home" class="guide-brand"
        ><span class="brand-mark">↗</span>{{ siteName
        }}<span class="docs-label">/ {{ t('integrationGuide.docsLabel') }}</span></router-link
      >
      <div>
        <router-link to="/home">{{ t('integrationGuide.backToHome') }}</router-link
        ><router-link :to="dashboardPath" class="console-link"
          >{{ t('integrationGuide.openConsole') }}</router-link
        >
      </div>
    </header>
    <div class="guide-layout">
      <aside class="guide-sidebar">
        <p>{{ t('integrationGuide.gettingStarted') }}</p>
        <a href="#overview">{{ t('integrationGuide.overview') }}<span>01</span></a
        ><a href="#prepare">{{ t('integrationGuide.prepareAnApiKey') }}<span>02</span></a
        ><a href="#configure">{{ t('integrationGuide.configureYourTools') }}<span>03</span></a
        ><a href="#verify">{{ t('integrationGuide.verifyAndTroubleshoot') }}<span>04</span></a
        ><a href="#questions">{{ t('integrationGuide.commonQuestions') }}<span>05</span></a>
        <div class="sidebar-note">
          <span>{{ t('integrationGuide.oneGatewayTwoEcosystems') }}</span><strong>Anthropic / Claude</strong
          ><strong>OpenAI / GPT · Codex</strong>
          <p>{{ t('integrationGuide.chooseAConnectionThatMatchesThe') }}</p>
        </div>
      </aside>
      <main>
        <section id="overview" class="guide-hero">
          <p class="guide-eyebrow">{{ t('integrationGuide.firstRequestEyebrow') }}</p>
          <h1>{{ t('integrationGuide.leaveTheSetupHere') }}<br /><span>{{ t('integrationGuide.takeYourIdeasToTheNext') }}</span></h1>
          <p class="guide-lead">{{ t('integrationGuide.chooseAToolCopyTheConfiguration') }}<br />{{ t('integrationGuide.understandTheEndpointAndAuthenticationDifferences') }}</p>
          <div class="guide-hero-actions">
            <a href="#configure" class="guide-primary-link">{{ t('integrationGuide.configureYourTools') }} <span aria-hidden="true">↗</span></a>
            <a href="#prepare">{{ t('integrationGuide.prepareAnApiKey') }} <span aria-hidden="true">→</span></a>
          </div>
          <div class="guide-chips">
            <span>{{ t('integrationGuide.nativeSdkCompatibility') }}</span><span>Windows / macOS / Linux</span
            ><span>{{ t('integrationGuide.keepYourApiKeyPrivate') }}</span>
          </div>
        </section>
        <section id="prepare" class="guide-section">
          <div class="section-kicker">01 / {{ t('integrationGuide.beforeYouStartEyebrow') }}</div>
          <h2>{{ t('integrationGuide.startWithTheseThreeThings') }}</h2>
          <div class="prepare-grid">
            <article>
              <span>01</span>
              <h3>{{ t('integrationGuide.anActiveAccount') }}</h3>
              <p>{{ t('integrationGuide.signInAndCheckYourBalance') }}</p>
              <router-link :to="dashboardPath">{{ t('integrationGuide.openConsole18') }}</router-link>
            </article>
            <article>
              <span>02</span>
              <h3>{{ t('integrationGuide.aKeyForTheRightGroup') }}</h3>
              <p>{{ t('integrationGuide.createAKeyOnTheApi') }}</p>
              <router-link to="/keys">{{ t('integrationGuide.manageApiKeys') }}</router-link>
            </article>
            <article>
              <span>03</span>
              <h3>{{ t('integrationGuide.anEnabledModel') }}</h3>
              <p>{{ t('integrationGuide.copyTheFullModelIdSupported') }}</p>
              <span class="prepare-footnote">{{ t('integrationGuide.theseExamplesDoNotAssumeModel') }}</span>
            </article>
          </div>
        </section>
        <section id="configure" class="guide-section">
          <div class="section-kicker">02 / {{ t('integrationGuide.connectEyebrow') }}</div>
          <h2>{{ t('integrationGuide.chooseYourToolConnectYourIdeas') }}</h2>
          <p class="section-intro">{{ t('integrationGuide.codexIsAnOpenaiCodingTool') }}</p>
          <div class="method-switch" role="group" :aria-label="t('integrationGuide.methodTitle')">
            <button
              v-for="option in methodOptions"
              :key="option.id"
              type="button"
              :class="{ active: method === option.id }"
              :aria-pressed="method === option.id"
              @click="method = option.id"
            >
              <strong>{{ option.label }}</strong>
              <small>{{ option.hint }}</small>
            </button>
          </div>
          <div v-if="method === 'ccs'" class="ccs-guide">
            <p class="section-intro">{{ t('integrationGuide.ccsIntro') }}</p>
            <h3>{{ t('integrationGuide.ccsStepsTitle') }}</h3>
            <ol class="ccs-steps">
              <li v-for="(step, i) in ccsSteps" :key="step.title">
                <span>{{ String(i + 1).padStart(2, '0') }}</span>
                <div>
                  <h4>{{ step.title }}</h4>
                  <p>{{ step.body }}</p>
                </div>
              </li>
            </ol>
            <h3>{{ t('integrationGuide.ccsPlatformTitle') }}</h3>
            <div class="error-table ccs-table">
              <div>
                <span>{{ t('integrationGuide.ccsPlatformColumn') }}</span
                ><span>{{ t('integrationGuide.ccsTargetColumn') }}</span>
              </div>
              <div v-for="row in ccsPlatforms" :key="row.platform">
                <code>{{ row.platform }}</code>
                <p>{{ row.target }}</p>
              </div>
            </div>
            <div class="endpoint-note ccs-note">
              <span>{{ t('integrationGuide.ccsImportedTitle') }}</span>
              <strong>{{ t('integrationGuide.ccsImportedBody') }}</strong>
            </div>
            <div class="endpoint-note ccs-note">
              <span>{{ t('integrationGuide.ccsSecurityNote') }}</span>
            </div>
            <h3>{{ t('integrationGuide.ccsTroubleTitle') }}</h3>
            <p class="section-intro">{{ t('integrationGuide.ccsTroubleBody') }}</p>
            <div class="guide-hero-actions">
              <router-link to="/keys" class="guide-primary-link"
                >{{ t('integrationGuide.ccsOpenKeys') }} <span aria-hidden="true">↗</span></router-link
              >
              <a href="#configure" class="ccs-to-manual" @click.prevent="method = 'manual'">{{ t('integrationGuide.ccsSwitchToManual') }} <span aria-hidden="true">→</span></a>
            </div>
          </div>
          <div v-else class="configurator">
            <div class="tool-tabs" role="tablist" :aria-label="t('integrationGuide.integrationTool')">
              <button
                v-for="tool in tools"
                :id="`tool-${tool.id}`"
                :key="tool.id"
                type="button"
                role="tab"
                :aria-selected="selectedTool === tool.id"
                aria-controls="tool-panel"
                :tabindex="selectedTool === tool.id ? 0 : -1"
                :class="{ active: selectedTool === tool.id }"
                @click="selectedTool = tool.id"
                @keydown="changeTool($event, tool.id)"
              >
                <span>{{ tool.icon }}</span
                >{{ tool.label }}<small>{{ tool.provider }}</small>
              </button>
            </div>
            <div
              id="tool-panel"
              role="tabpanel"
              :aria-labelledby="`tool-${selectedTool}`"
              class="config-content"
            >
              <div class="config-heading">
                <div>
                  <h3>{{ t('integrationGuide.toolSetup', { tool: activeTool.label }) }}</h3>
                  <p>{{ activeTool.description }}</p>
                </div>
                <div class="os-switch" role="group" :aria-label="t('integrationGuide.operatingSystem')">
                  <button
                    v-for="option in osOptions"
                    :key="option.id"
                    type="button"
                    :class="{ active: os === option.id }"
                    :aria-pressed="os === option.id"
                    @click="os = option.id"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>
              <div class="config-fields">
                <label
                  >{{ t('integrationGuide.serviceUrl') }}<span>{{ t('integrationGuide.replaceWithTheDedicatedUrlProvided') }}</span
                  ><input
                    id="guide-service-url"
                    v-model="serviceUrl"
                    type="url"
                    spellcheck="false"
                    autocomplete="off"
                    :placeholder="configuredRoot"
                    :aria-invalid="!validUrl"
                  /><small v-if="!validUrl" class="field-error"
                    >{{ t('integrationGuide.enterAnHttpSUrlWithout') }}</small
                  ></label
                ><label
                  >{{ t('integrationGuide.modelId') }}<span>{{ t('integrationGuide.useTheFullModelNameEnabled') }}</span
                  ><input
                    id="guide-model"
                    v-model="model"
                    spellcheck="false"
                    autocomplete="off"
                    placeholder="YOUR_ENABLED_MODEL"
                    :aria-invalid="!validModel"
                  /><small v-if="!validModel" class="field-error"
                    >{{ t('integrationGuide.useLettersNumbersDotsHyphensUnderscores') }}</small
                  ></label
                >
              </div>
              <div class="endpoint-note">
                <span>{{
                  selectedTool === 'claude'
                    ? 'ANTHROPIC_BASE_URL'
                    : 'OPENAI / CODEX BASE URL'
                }}</span
                ><code>{{ validUrl ? endpoint : t('integrationGuide.enterAValidEndpointFirst') }}</code
                ><strong>{{
                  selectedTool === 'claude'
                    ? t('integrationGuide.claudeUsesTheServiceRootUrl')
                    : t('integrationGuide.openaiEndpointsEndInV1Avoid')
                }}</strong>
              </div>
              <p class="session-note">{{ t('integrationGuide.environmentVariablesApplyToThisTerminal') }}<code>YOUR_API_KEY</code>{{ t('integrationGuide.withYourKeyAndSetYour') }}</p>
              <div
                v-for="(block, i) in codeBlocks"
                :key="block.title"
                class="guide-code-block"
              >
                <div class="code-step">
                  <span>{{ String(i + 1).padStart(2, '0') }}</span>
                  <h4>{{ block.title }}</h4>
                </div>
                <p v-if="block.note" class="block-note">{{ block.note }}</p>
                <div class="code-shell">
                  <div class="code-toolbar">
                    <span>{{ block.filename }}</span
                    ><button
                      type="button"
                      :disabled="!canCopy"
                      @click="copyBlock(block.code, i)"
                    >
                      {{ copiedIndex === i ? t('integrationGuide.copied') : t('integrationGuide.copy') }}
                    </button>
                  </div>
                  <pre><code>{{ block.code }}</code></pre>
                </div>
              </div>
              <p class="copy-feedback" role="status" aria-live="polite">
                {{ copyFeedback }}
              </p>
            </div>
          </div>
        </section>
        <section id="verify" class="guide-section">
          <div class="section-kicker">03 / {{ t('integrationGuide.responseEyebrow') }}</div>
          <h2>{{ t('integrationGuide.aResponseMeansYouAreConnected') }}</h2>
          <p class="section-intro">{{ t('integrationGuide.runTheExampleInYourOwn') }}</p>
          <div class="verify-success">
            <span>↳</span>
            <div>
              <strong>{{ t('integrationGuide.aTextResponseOrAnInteractive') }}</strong>
              <p>{{ t('integrationGuide.yourEndpointKeyModelAndGroup') }}</p>
            </div>
          </div>
          <div class="error-table">
            <div><span>{{ t('integrationGuide.symptom') }}</span><span>{{ t('integrationGuide.whatToCheckFirst') }}</span></div>
            <div>
              <code>401 / Unauthorized</code>
              <p>{{ t('integrationGuide.checkThatTheKeyIsComplete') }}</p>
            </div>
            <div>
              <code>{{ t('integrationGuide.403QuotaOrPermissionIssue') }}</code>
              <p>{{ t('integrationGuide.checkYourModelGroupBalanceSubscription') }}</p>
            </div>
            <div>
              <code>404 / Model not found</code>
              <p>{{ t('integrationGuide.checkTheModelIdOpenaiUrls') }}</p>
            </div>
            <div>
              <code>429 / Rate limited</code>
              <p>{{ t('integrationGuide.reduceConcurrencyAndRetryLaterCheck') }}</p>
            </div>
            <div>
              <code>{{ t('integrationGuide.timeoutTlsError') }}</code>
              <p>{{ t('integrationGuide.checkNetworkAccessProxySettingsAnd') }}</p>
            </div>
          </div>
        </section>
        <section id="questions" class="guide-section">
          <div class="section-kicker">04 / {{ t('integrationGuide.questionsEyebrow') }}</div>
          <h2>{{ t('integrationGuide.aFewMoreQuestions') }}</h2>
          <details>
            <summary>{{ t('integrationGuide.areGptAndCodexSeparateProviders') }}</summary>
            <p>{{ t('integrationGuide.noCodexIsAnOpenaiCoding') }}</p>
          </details>
          <details>
            <summary>{{ t('integrationGuide.canClaudeAndOpenaiShareAn') }}</summary>
            <p>{{ t('integrationGuide.itDependsOnYourKeyS') }}</p>
          </details>
          <details>
            <summary>{{ t('integrationGuide.whereDoesTheCodexConfigurationFile') }}</summary>
            <p>{{ t('integrationGuide.useCodexConfigTomlInYour') }}</p>
          </details>
          <details>
            <summary>{{ t('integrationGuide.whyDidMyConfigurationDisappearIn') }}</summary>
            <p>{{ t('integrationGuide.theseEnvironmentVariablesApplyOnlyTo') }}</p>
          </details>
          <details>
            <summary>{{ t('integrationGuide.canThisPageTestMyReal') }}</summary>
            <p>{{ t('integrationGuide.thisPageNeitherCollectsKeysNor') }}</p>
          </details>
          <div class="official-sources">
            <span>{{ t('integrationGuide.references') }}</span
            ><a
              href="https://developers.openai.com/codex/config-reference/"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t('integrationGuide.codexConfigurationReference') }}</a
            ><a
              href="https://developers.openai.com/codex/auth/"
              target="_blank"
              rel="noopener noreferrer"
              >{{ t('integrationGuide.codexAuthentication') }}</a
            >
          </div>
        </section>
        <footer class="guide-footer">
          <span>{{ t('integrationGuide.setupCompleteYourIdeasComeNext') }}</span
          ><router-link to="/home">{{ t('integrationGuide.backToThePlayground') }}</router-link>
        </footer>
      </main>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAppStore, useAuthStore } from '@/stores'
import { useI18n } from 'vue-i18n'
import { resolveLandingApiBase } from '@/utils/tlLanding'
const { t } = useI18n()
const app = useAppStore(),
  auth = useAuthStore()
const siteName = computed(
  () => app.cachedPublicSettings?.site_name || app.siteName || 'Sub2API'
)
const dashboardPath = computed(() =>
  auth.isAuthenticated
    ? auth.isAdmin
      ? '/admin/dashboard'
      : '/dashboard'
    : '/login'
)
type Tool = 'claude' | 'codex'
type OS = 'windows' | 'macos' | 'linux'
const tools = computed(() => [
  {
    id: 'claude' as const,
    label: 'Claude Code',
    provider: 'Anthropic',
    icon: '✳',
    description: t('integrationGuide.connectTheClaudeCodingToolIn'),
  },
  {
    id: 'codex' as const,
    label: 'Codex CLI',
    provider: 'OpenAI',
    icon: '⌘',
    description: t('integrationGuide.connectCodexInYourTerminalThrough'),
  },
])
const osOptions: Array<{ id: OS; label: string }> = [
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
  { id: 'linux', label: 'Linux' },
]
function detectOs(): OS {
  const platform = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (/Mac/i.test(platform)) return 'macos'
  if (/Linux|X11/i.test(platform) && !/Android/i.test(platform)) return 'linux'
  return 'windows'
}
type Method = 'manual' | 'ccs'
const method = ref<Method>('manual')
const methodOptions = computed(() => [
  {
    id: 'manual' as const,
    label: t('integrationGuide.methodManual'),
    hint: t('integrationGuide.methodManualHint'),
  },
  {
    id: 'ccs' as const,
    label: t('integrationGuide.methodCcs'),
    hint: t('integrationGuide.methodCcsHint'),
  },
])
const ccsSteps = computed(() =>
  [1, 2, 3, 4].map((n) => ({
    title: t(`integrationGuide.ccsStep${n}Title`),
    body: t(`integrationGuide.ccsStep${n}Body`),
  }))
)
const ccsPlatforms = computed(() => [
  { platform: t('integrationGuide.ccsPlatformAnthropic'), target: t('integrationGuide.ccsTargetClaude') },
  { platform: t('integrationGuide.ccsPlatformOpenai'), target: t('integrationGuide.ccsTargetCodex') },
  { platform: t('integrationGuide.ccsPlatformGemini'), target: t('integrationGuide.ccsTargetGemini') },
  { platform: t('integrationGuide.ccsPlatformGrok'), target: t('integrationGuide.ccsTargetGrok') },
  { platform: t('integrationGuide.ccsPlatformAntigravity'), target: t('integrationGuide.ccsTargetAntigravity') },
])
const selectedTool = ref<Tool>('claude'),
  os = ref<OS>(detectOs())
const activeTool = computed(
  () => tools.value.find((tool) => tool.id === selectedTool.value)!
)
const configuredRoot = computed(() => resolveLandingApiBase(app.cachedPublicSettings?.api_base_url, window.location.origin).replace(/\/v1$/, ''))
const serviceUrlOverride = ref<string | null>(null)
const serviceUrl = computed({ get: () => serviceUrlOverride.value ?? configuredRoot.value, set: (value: string) => { serviceUrlOverride.value = value } }),
  model = ref('')
const rootUrl = computed(() => {
  try {
    const url = new URL(serviceUrl.value.trim())
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return ''
    return url.href.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '')
  } catch {
    return ''
  }
})
const validUrl = computed(() => !!rootUrl.value)
const validModel = computed(
  () => !model.value.trim() || /^[a-zA-Z0-9._:/-]+$/.test(model.value.trim())
)
const modelId = computed(() =>
  validModel.value && model.value.trim()
    ? model.value.trim()
    : 'YOUR_ENABLED_MODEL'
)
const endpoint = computed(
  () => rootUrl.value + (selectedTool.value === 'claude' ? '' : '/v1')
)
const canCopy = computed(() => validUrl.value && validModel.value)
const psQuote = (text: string) => "'" + text.replace(/'/g, "''") + "'"
const shQuote = (text: string) => "'" + text.replace(/'/g, "'\"'\"'") + "'"
const codeBlocks = computed(() => {
  const windows = os.value === 'windows',
    quote = windows ? psQuote : shQuote
  const env = (key: string, value: string) =>
    windows ? `$env:${key} = ${quote(value)}` : `export ${key}=${quote(value)}`
  const shell = windows
    ? 'PowerShell'
    : os.value === 'macos'
      ? 'Terminal · zsh'
      : 'Terminal · bash'
  if (selectedTool.value === 'claude')
    return [
      {
        title: t('integrationGuide.installClaudeCode'),
        filename: shell,
        code: 'npm install -g @anthropic-ai/claude-code',
      },
      {
        title: t('integrationGuide.setConnectionVariablesInThisTerminal'),
        filename: shell,
        code: [
          env('ANTHROPIC_BASE_URL', rootUrl.value),
          env('ANTHROPIC_AUTH_TOKEN', 'YOUR_API_KEY'),
          env('ANTHROPIC_MODEL', modelId.value),
        ].join('\n'),
      },
      {
        title: t('integrationGuide.startClaudeCode'),
        filename: shell,
        code: 'claude',
        note: t('integrationGuide.startFromTheSameTerminalWhere'),
      },
    ]
  return [
    {
      title: t('integrationGuide.installCodexCli'),
      filename: shell,
      code: 'npm install -g @openai/codex',
    },
    {
      title: t('integrationGuide.setYourKeyAndPrepareThe'),
      filename: shell,
      code:
        env('CUSTOM_API_KEY', 'YOUR_API_KEY') +
        '\n' +
        (windows
          ? 'New-Item -ItemType Directory -Force "$env:USERPROFILE/.codex" | Out-Null'
          : 'mkdir -p "$HOME/.codex"'),
    },
    {
      title: t('integrationGuide.mergeIntoYourUserConfigurationFile'),
      filename: windows
        ? '%USERPROFILE%\\.codex\\config.toml'
        : '~/.codex/config.toml',
      note: t('integrationGuide.keepExistingSettingsDefineEachTop'),
      code: `model_provider = "custom_gateway"\nmodel = ${JSON.stringify(modelId.value)}\n\n[model_providers.custom_gateway]\nname = ${JSON.stringify(siteName.value)}\nbase_url = ${JSON.stringify(rootUrl.value + '/v1')}\nenv_key = "CUSTOM_API_KEY"\nwire_api = "responses"`,
    },
    {
      title: t('integrationGuide.startInTheSameTerminal'),
      filename: shell,
      code: 'codex',
      note: t('integrationGuide.thisCustomProviderAuthenticatesUsingAn'),
    },
  ]
})
const copiedIndex = ref(-1),
  copyFeedback = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
async function copyBlock(code: string, index: number) {
  if (!canCopy.value) return
  try {
    await navigator.clipboard.writeText(code)
    copiedIndex.value = index
    copyFeedback.value = t('integrationGuide.copiedReplaceYourApiKeyAnd')
  } catch {
    copyFeedback.value = t('integrationGuide.couldNotCopySelectAndCopy')
  }
  clearTimeout(timer)
  timer = setTimeout(() => {
    copiedIndex.value = -1
    copyFeedback.value = ''
  }, 3500)
}
function changeTool(e: KeyboardEvent, id: Tool) {
  let index = tools.value.findIndex((t) => t.id === id)
  if (e.key === 'ArrowRight') index = (index + 1) % tools.value.length
  else if (e.key === 'ArrowLeft')
    index = (index + tools.value.length - 1) % tools.value.length
  else if (e.key === 'Home') index = 0
  else if (e.key === 'End') index = tools.value.length - 1
  else return
  e.preventDefault()
  selectedTool.value = tools.value[index].id
  document.getElementById(`tool-${selectedTool.value}`)?.focus()
}
onBeforeUnmount(() => clearTimeout(timer))
</script>
<style scoped src="./integration-guide.css"></style>
