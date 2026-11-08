import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick, reactive } from 'vue'
import Landing from '../TokenLibertyLanding.vue'
import Guide from '../public/IntegrationGuideView.vue'
import en from '@/i18n/locales/en/landing'
import zh from '@/i18n/locales/zh/landing'

const { app, auth } = vi.hoisted(() => ({
  app: { cachedPublicSettings: {} as Record<string, unknown>, siteName: 'Fallback', siteLogo: '', docUrl: '' },
  auth: { isAuthenticated: false, isAdmin: false },
}))
vi.mock('@/stores', () => ({ useAppStore: () => app, useAuthStore: () => auth }))
vi.mock('@/stores/app', () => ({ useAppStore: () => app }))

const wrappers: Array<{ unmount: () => void }> = []
function render(component: typeof Landing | typeof Guide, locale = 'en') {
  const i18n = createI18n({ legacy: false, locale, messages: { en, zh } })
  const wrapper = mount(component, { global: {
    plugins: [i18n], stubs: { RouterLink: RouterLinkStub, ParticleSculpture: true },
  } })
  wrappers.push(wrapper)
  return { wrapper, i18n }
}
beforeEach(() => {
  app.cachedPublicSettings = reactive({ site_name: 'Example Studio', payment_enabled: false, model_plaza_enabled: false })
  auth.isAuthenticated = false
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.unstubAllGlobals() })

it('keeps rendered and copied code in sync as deployment settings change', async () => {
  app.cachedPublicSettings.api_base_url = 'https://api.example/prefix/v1/'
  const { wrapper } = render(Landing)
  const [curl, claude, codex] = wrapper.findAll('.code-tabs button')
  expect(curl.attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('pre').text()).toContain('curl https://api.example/prefix/v1/responses')
  expect(wrapper.get('pre').text()).toContain('Authorization: Bearer YOUR_API_KEY')
  await wrapper.get('[aria-label="Copy example code"]').trigger('click')
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(wrapper.get('pre').text())
  await claude.trigger('click')
  expect(claude.attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('pre').text()).toContain('ANTHROPIC_BASE_URL="https://api.example/prefix"')
  expect(wrapper.get('pre').text()).not.toContain('/v1')
  await wrapper.get('[aria-label="Copy example code"]').trigger('click')
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(wrapper.get('pre').text())
  await codex.trigger('click')
  expect(codex.attributes('aria-pressed')).toBe('true')
  expect(wrapper.get('pre').text()).toContain('base_url = "https://api.example/prefix/v1"')
  expect(wrapper.get('pre').text()).toContain('name = "Example Studio"')
  expect(wrapper.get('pre').text()).toContain('wire_api = "responses"')
  expect(wrapper.get('.code-window-footer').text()).toContain('Codex')
  await wrapper.get('[aria-label="Copy example code"]').trigger('click')
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(wrapper.get('pre').text())
  app.cachedPublicSettings.api_base_url = 'https://changed.example'
  await nextTick()
  expect(wrapper.get('pre').text()).toContain('https://changed.example/v1')
  await claude.trigger('click')
  expect(wrapper.get('pre').text()).toContain('ANTHROPIC_BASE_URL="https://changed.example"')
})

it('shows only Claude Code and Codex in the landing quickstart', () => {
  const { wrapper } = render(Landing)
  expect(wrapper.get('.connect-tools').text()).toBe('Claude CodeCodex')
  expect(wrapper.text()).not.toMatch(/Python SDK|from openai import/)
})

it('always routes documentation links to the built-in guide, ignoring the legacy doc_url', async () => {
  app.cachedPublicSettings.doc_url = 'https://tokenliberty.site/tools/setup/'
  const { wrapper } = render(Landing)
  const docLinks = () => wrapper.findAllComponents(RouterLinkStub).filter(link => link.props('to') === '/docs/quickstart')
  expect(docLinks()).toHaveLength(2)
  expect(wrapper.find('a[href="https://tokenliberty.site/tools/setup/"]').exists()).toBe(false)
  app.cachedPublicSettings.doc_url = ''
  await nextTick()
  expect(docLinks()).toHaveLength(2)
})

it('respects logo, payment and authenticated model plaza visibility', async () => {
  app.cachedPublicSettings.site_logo = 'https://assets.example/logo.svg'
  app.cachedPublicSettings.model_plaza_enabled = true
  app.cachedPublicSettings.model_plaza_require_auth = true
  const { wrapper } = render(Landing)
  expect(wrapper.get('.brand-logo').attributes('src')).toBe('https://assets.example/logo.svg')
  const destinations = () => wrapper.findAllComponents(RouterLinkStub).map(link => link.props('to'))
  expect(destinations()).not.toContain('/purchase')
  expect(destinations()).not.toContain('/model-plaza')
  app.cachedPublicSettings.model_plaza_require_auth = false
  app.cachedPublicSettings.payment_enabled = true
  await nextTick()
  expect(destinations()).toContain('/model-plaza')
  expect(destinations()).toContain('/purchase')
  expect(wrapper.get('.closing-watermark').text()).toBe('Example Studio')
})

it('switches landing text and clearly describes unverified preset examples', async () => {
  const { wrapper, i18n } = render(Landing)
  expect(wrapper.text()).toContain('unverified')
  expect(wrapper.text()).not.toMatch(/gpt-image-2|gpt-6.1-sol|2026-11-07/)
  i18n.global.locale.value = 'zh'
  await nextTick()
  expect(wrapper.get('h1').text()).toContain('让灵感')
})

it('localizes the guide and derives its endpoint and provider label from site settings', async () => {
  app.cachedPublicSettings.api_base_url = 'https://api.example/proxy/v1'
  const { wrapper, i18n } = render(Guide)
  expect(wrapper.get('h1').text()).toContain('Integration guide.')
  await wrapper.get('#tool-codex').trigger('click')
  expect(wrapper.text()).toContain('https://api.example/proxy/v1')
  expect(wrapper.text()).toContain('name = "Example Studio"')
  expect(wrapper.text()).toContain('env_key = "CUSTOM_API_KEY"')
  expect(wrapper.text()).not.toContain('TOKENLIBERTY_API_KEY')
  app.cachedPublicSettings.api_base_url = 'https://changed.example/v1'
  await nextTick()
  expect(wrapper.text()).toContain('https://changed.example/v1')
  i18n.global.locale.value = 'zh'
  await nextTick()
  expect(wrapper.get('h1').text()).toContain('接入指南')
})

it('explains the CC-Switch import as an alternative to manual setup', async () => {
  const { wrapper, i18n } = render(Guide)
  const [manual, ccs] = wrapper.findAll('.method-switch button')
  expect(manual.attributes('aria-pressed')).toBe('true')
  expect(wrapper.find('.configurator').exists()).toBe(true)
  expect(wrapper.find('.ccs-guide').exists()).toBe(false)
  await ccs.trigger('click')
  expect(wrapper.find('.configurator').exists()).toBe(false)
  expect(wrapper.findAll('.ccs-steps li')).toHaveLength(4)
  expect(wrapper.findAll('.ccs-table code').map(row => row.text())).toEqual([
    'Anthropic (default)', 'OpenAI', 'Gemini', 'Grok', 'Antigravity',
  ])
  expect(wrapper.text()).toContain('ccswitch://')
  expect(wrapper.text()).toContain('every 30 minutes')
  expect(wrapper.findAllComponents(RouterLinkStub).some(link => link.props('to') === '/keys')).toBe(true)
  i18n.global.locale.value = 'zh'
  await nextTick()
  expect(wrapper.text()).toContain('导入到 CCS')
  await wrapper.get('.ccs-to-manual').trigger('click')
  expect(wrapper.find('.ccs-guide').exists()).toBe(false)
  expect(wrapper.find('.configurator').exists()).toBe(true)
  expect(wrapper.findAll('.method-switch button')[0].attributes('aria-pressed')).toBe('true')
})

it('offers only Claude Code and Codex with separate Windows, macOS and Linux options', async () => {
  const { wrapper } = render(Guide)
  expect(wrapper.findAll('[role="tab"]').map(tab => tab.attributes('id'))).toEqual(['tool-claude', 'tool-codex'])
  expect(wrapper.text()).not.toMatch(/Python SDK|OpenCode|HTTP request/)
  const systems = wrapper.findAll('.os-switch button')
  expect(systems.map(button => button.text())).toEqual(['Windows', 'macOS', 'Linux'])
  await systems[1].trigger('click')
  expect(wrapper.text()).toContain('Terminal · zsh')
  expect(wrapper.text()).toContain('export ANTHROPIC_BASE_URL=')
  await systems[2].trigger('click')
  expect(wrapper.text()).toContain('Terminal · bash')
  await systems[0].trigger('click')
  expect(wrapper.text()).toContain('$env:ANTHROPIC_BASE_URL')
})
