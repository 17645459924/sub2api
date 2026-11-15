export type LandingCodeTool = 'curl' | 'claude' | 'codex'
export type LandingCodeOS = 'unix' | 'win'

export interface LandingCodeOptions {
  tool: LandingCodeTool
  /** 已规范化、以 /v1 结尾的 OpenAI 兼容地址,见 resolveLandingApiBase */
  apiBase: string
  siteName: string
  os?: LandingCodeOS
  comment?: string
  curlHint?: string
  /**
   * Claude Code 的输出形态:
   * - 'settings'(默认):写入 ~/.claude/settings.json 的 env 块,这是 Claude Code 的真实配置文件
   * - 'env':在终端里设置环境变量,仅当前终端有效(旧首页使用)
   */
  claudeFormat?: 'settings' | 'env'
  /** 写入 settings.json 的默认模型,缺省则不写 */
  model?: string
}

/** 首页接入示例。Claude Code 使用根地址,Codex 与 curl 使用 /v1。 */
export function buildLandingCode({
  tool,
  apiBase,
  siteName,
  os = 'unix',
  comment = '',
  curlHint = '',
  claudeFormat = 'env',
  model = '',
}: LandingCodeOptions): string {
  const root = apiBase.replace(/\/v1$/, '')
  const head = comment ? ['# ' + comment] : []
  if (tool === 'curl') {
    const cont = os === 'win' ? ' `' : ' \\'
    return [
      ...head,
      `curl ${apiBase}/responses${cont}`,
      `  -H "Authorization: Bearer YOUR_API_KEY"${cont}`,
      `  -H "Content-Type: application/json"${cont}`,
      '  -d \'{"model": "YOUR_ENABLED_MODEL", "input": "Hello, possibility."}\'',
      ...(curlHint ? ['', '# ' + curlHint] : []),
    ].join('\n')
  }
  if (tool === 'claude') {
    if (claudeFormat === 'settings') return buildClaudeSettings({ root, os, model })
    const set = (k: string, v: string) => (os === 'win' ? `$env:${k} = ${v}` : `export ${k}=${v}`)
    return [
      ...head,
      'npm install -g @anthropic-ai/claude-code',
      '',
      set('ANTHROPIC_BASE_URL', JSON.stringify(root)),
      set('ANTHROPIC_AUTH_TOKEN', '"YOUR_API_KEY"'),
      set('ANTHROPIC_MODEL', '"YOUR_ENABLED_MODEL"'),
      '',
      'claude',
    ].join('\n')
  }
  return [
    os === 'win' ? '# %USERPROFILE%\\.codex\\config.toml' : '# ~/.codex/config.toml',
    'model_provider = "custom_gateway"',
    'model = "YOUR_ENABLED_MODEL"',
    '',
    '[model_providers.custom_gateway]',
    `name = ${JSON.stringify(siteName)}`,
    `base_url = ${JSON.stringify(apiBase)}`,
    'env_key = "CUSTOM_API_KEY"',
    'wire_api = "responses"',
    '',
    os === 'win' ? '# $env:CUSTOM_API_KEY = "YOUR_API_KEY"' : '# export CUSTOM_API_KEY="YOUR_API_KEY"',
    '# codex',
  ].join('\n')
}

/** Claude Code 用户配置文件路径,仅用于展示,不进入被复制的内容。 */
export function claudeSettingsPath(os: LandingCodeOS = 'unix'): string {
  return os === 'win' ? '%USERPROFILE%\\.claude\\settings.json' : '~/.claude/settings.json'
}

/**
 * Claude Code 的真实配置:~/.claude/settings.json 的 env 块。
 * 官方文档:settings.json 是严格 JSON,不允许注释或尾随逗号,所以这里只输出纯 JSON。
 * env 块对每个会话及其子进程生效(含后台 agent);ANTHROPIC_AUTH_TOKEN 以 Bearer 头发送。
 */
function buildClaudeSettings({ root, model }: { root: string; os: LandingCodeOS; model: string }): string {
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: root,
    ANTHROPIC_AUTH_TOKEN: 'YOUR_API_KEY',
  }
  if (model) env.ANTHROPIC_MODEL = model
  return JSON.stringify({ env }, null, 2)
}
