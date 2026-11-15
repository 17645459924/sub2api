import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'
import en from '@/i18n/locales/en/landing'
import zh from '@/i18n/locales/zh/landing'

const { app, auth, getModelPlaza } = vi.hoisted(() => ({
  app: { cachedPublicSettings: {} as Record<string, unknown>, siteName: 'Fallback', siteLogo: '' },
  auth: { isAuthenticated: false, isAdmin: false },
  getModelPlaza: vi.fn(),
}))
vi.mock('@/stores', () => ({ useAppStore: () => app, useAuthStore: () => auth }))
vi.mock('@/stores/app', () => ({ useAppStore: () => app }))
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))
vi.mock('@/api/modelPlaza', () => ({ getModelPlaza }))

import LandingV2 from '../LandingV2.vue'

const wrappers: Array<{ unmount: () => void }> = []
function render(locale = 'zh') {
  const i18n = createI18n({ legacy: false, locale, messages: { en, zh } })
  const w = mount(LandingV2, { global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } } })
  wrappers.push(w)
  return w
}

beforeEach(() => {
  app.cachedPublicSettings = reactive({
    site_name: 'Example', site_subtitle: 'Sub line', api_base_url: 'https://gw.example/v1',
    payment_enabled: true, subscription_enabled: false, model_plaza_enabled: false, registration_enabled: true,
  })
  auth.isAuthenticated = false
  auth.isAdmin = false
  getModelPlaza.mockReset().mockResolvedValue({ description: '', groups: [] })
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const links = (w: ReturnType<typeof render>) => w.findAllComponents(RouterLinkStub).map((l) => String(l.props('to')))

describe('LandingV2', () => {
  it('shows the headline, subtitle and base URL', () => {
    const w = render()
    expect(w.get('h1').text()).toContain('畅用 Claude 与 Codex')
    expect(w.text()).toContain('Sub line')
    expect(w.get('.url-val').text()).toBe('https://gw.example')
  })

  it('renders no video card or dialog when no intro video URL is configured', () => {
    const w = render()
    expect(w.find('.video-strip').exists()).toBe(false)
    expect(w.find('.video-dialog').exists()).toBe(false)
  })

  it('hides the Chinese site subtitle from English visitors', () => {
    expect(render('en').text()).not.toContain('Sub line')
  })

  it('draws the gateway network in a decorative canvas and labels the traffic log as an illustration', () => {
    const w = render()
    const canvas = w.get('canvas.hero-canvas')
    expect(canvas.attributes('aria-hidden')).toBe('true')
    const log = w.get('[data-gateway-log]')
    expect(log.attributes('aria-hidden')).toBe('true')
    expect(log.text()).toContain('示意动画')
  })

  it('never lists models this site does not offer in the hero', () => {
    const hero = render().get('.hero').text()
    for (const other of ['Gemini', 'DeepSeek', 'Kimi', 'GLM', 'Grok', 'MiniMax']) expect(hero).not.toContain(other)
  })

  it('shows the same base URL in the hero and the closing section, and copies it', async () => {
    const w = render()
    const chips = w.findAll('.url-chip')
    expect(chips.length).toBeGreaterThanOrEqual(2)
    for (const chip of chips) expect(chip.get('.url-val').text()).toBe('https://gw.example')
    await chips[0].trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith('https://gw.example')
  })

  it('keeps the page visible when the intro splash is skipped under reduced motion', () => {
    const w = render()
    // 测试环境把 prefers-reduced-motion 设为 reduce,进场层不应出现,内容不应被隐藏
    expect(w.find('.splash').exists()).toBe(false)
    expect(w.classes()).not.toContain('splash-on')
  })

  it('hides pricing from visitors and shows it after login', async () => {
    const w = render()
    expect(w.find('#pricing').exists()).toBe(false)
    expect(links(w)).not.toContain('/model-pricing')
    w.unmount()
    auth.isAuthenticated = true
    const w2 = render()
    expect(w2.find('#pricing').exists()).toBe(true)
    expect(links(w2)).toContain('/model-pricing')
    expect(links(w2)).not.toContain('/purchase')
  })

  it('shows the subscription card only when subscriptions are enabled', () => {
    auth.isAuthenticated = true
    app.cachedPublicSettings.subscription_enabled = true
    expect(links(render())).toContain('/purchase')
  })

  it('routes the primary CTA by auth and registration state', () => {
    expect(links(render())).toContain('/register')
    app.cachedPublicSettings.registration_enabled = false
    expect(links(render())).not.toContain('/register')
    auth.isAuthenticated = true
    expect(links(render())).toContain('/dashboard')
  })

  it('only requests the model plaza when it is publicly reachable', async () => {
    render()
    await flushPromises()
    expect(getModelPlaza).not.toHaveBeenCalled()
    wrappers.splice(0).forEach((w) => w.unmount())
    app.cachedPublicSettings.model_plaza_enabled = true
    app.cachedPublicSettings.model_plaza_require_auth = true
    render()
    await flushPromises()
    expect(getModelPlaza).not.toHaveBeenCalled()
    wrappers.splice(0).forEach((w) => w.unmount())
    getModelPlaza.mockResolvedValue({ description: '', groups: [{ models: [{ name: 'claude-x', platform: 'anthropic' }, { name: 'gpt-y', platform: 'openai' }] }] })
    app.cachedPublicSettings.model_plaza_require_auth = false
    const w = render()
    await flushPromises()
    expect(getModelPlaza).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('claude-x')
    expect(w.text()).toContain('gpt-y')
  })

  it('copies exactly what the terminal shows', async () => {
    const w = render()
    const pre = () => w.get('[data-testid="lv-code"]').attributes('aria-label') as string
    // Claude Code 展示的是 ~/.claude/settings.json 的真实配置,必须是合法 JSON(settings.json 不允许注释)
    const settings = JSON.parse(pre())
    expect(settings).toEqual({ env: { ANTHROPIC_BASE_URL: 'https://gw.example', ANTHROPIC_AUTH_TOKEN: 'YOUR_API_KEY' } })
    expect(pre()).not.toContain('export ')
    expect(w.get('.term-foot').text()).toContain('~/.claude/settings.json')
    await w.get('.copy-btn').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(pre())
    await w.get('#lv-tab-codex').trigger('click')
    expect(pre()).toContain('base_url = "https://gw.example/v1"')
    await w.get('.copy-btn').trigger('click')
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(pre())
  })

  it('lists plaza models newest first and writes a real Claude model into the settings example', async () => {
    app.cachedPublicSettings.model_plaza_enabled = true
    app.cachedPublicSettings.model_plaza_require_auth = false
    getModelPlaza.mockResolvedValue({
      description: '',
      groups: [
        {
          models: [
            { name: 'claude-sonnet-5', platform: 'anthropic' },
            { name: 'claude-sonnet-5-5', platform: 'anthropic' },
            { name: 'claude-opus-5-5', platform: 'anthropic' },
            { name: 'gpt-6.1-sol', platform: 'openai' },
            { name: 'gpt-5.6-luna', platform: 'openai' },
          ],
        },
      ],
    })
    const w = render()
    await flushPromises()
    const chips = (card: number) => w.findAll('.model')[card].findAll('.model-list .mono').map((e) => e.text())
    // 版本号大的在前;版本号相同按字母序(opus-5-5 在 sonnet-5-5 前)
    expect(chips(0)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5'])
    expect(chips(1)).toEqual(['gpt-6.1-sol', 'gpt-5.6-luna'])
    const settings = JSON.parse(w.get('[data-testid="lv-code"]').attributes('aria-label') as string)
    expect(settings.env.ANTHROPIC_MODEL).toBe('claude-sonnet-5-5')
  })

  it('skips the intro splash under reduced motion and never hides the page', async () => {
    const w = render()
    await flushPromises()
    expect(w.find('.splash').exists()).toBe(false)
    expect(w.get('.lv').classes()).not.toContain('hero-in')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('drops the intro splash at once when the canvas is unavailable, leaving the page usable', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
    const w = render()
    await flushPromises()
    expect(w.find('.splash').exists()).toBe(false)
    expect(document.documentElement.style.overflow).toBe('')
    expect(w.get('.lv').classes()).toContain('hero-in')
    expect(w.get('h1').text()).toContain('畅用 Claude 与 Codex')
  })

  it('plays the intro splash on every visit, even when an old "seen" flag exists', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }))
    // 给画布一个可用的 2D 上下文,进场层才会真正进入播放而不是立刻收尾
    const noop = () => {}
    const ctx2d = new Proxy({}, { get: (_t, p) => (p === 'canvas' ? document.createElement('canvas') : p === 'createRadialGradient' || p === 'createLinearGradient' ? () => ({ addColorStop: noop }) : p === 'measureText' ? () => ({ width: 10 }) : noop), set: () => true })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx2d as unknown as CanvasRenderingContext2D)
    // 旧版本留下的"看过一次"标记不应再影响是否播放
    sessionStorage.setItem('lv-splash-seen', '1')
    const w = render()
    await flushPromises()
    expect(w.find('.splash').exists()).toBe(true)
    w.unmount()
    const w2 = render()
    await flushPromises()
    expect(w2.find('.splash').exists()).toBe(true)
    w2.unmount()
    sessionStorage.removeItem('lv-splash-seen')
    document.documentElement.style.removeProperty('overflow')
  })

  it('answers the stored-content FAQ truthfully and in English', () => {
    expect(render().text()).toContain('请求内容会被保存吗')
    const w = render('en')
    expect(w.text()).toContain('Is request content stored?')
    expect(w.text()).toContain('The platform stores request content')
  })
})
