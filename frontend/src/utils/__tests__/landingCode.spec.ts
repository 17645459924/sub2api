import { describe, expect, it } from 'vitest'
import { buildLandingCode, claudeSettingsPath } from '../landingCode'
import { isTlLandingContent, isTlLandingV2Content } from '../tlLanding'

const base = { apiBase: 'https://gw.example/prefix/v1', siteName: 'Example' }

describe('buildLandingCode', () => {
  it('uses the root URL for Claude Code and /v1 for Codex', () => {
    const claude = buildLandingCode({ ...base, tool: 'claude' })
    expect(claude).toContain('export ANTHROPIC_BASE_URL="https://gw.example/prefix"')
    expect(claude).not.toContain('/v1')
    const codex = buildLandingCode({ ...base, tool: 'codex' })
    expect(codex).toContain('base_url = "https://gw.example/prefix/v1"')
    expect(codex).toContain('name = "Example"')
    expect(codex).toContain('wire_api = "responses"')
    expect(codex).toContain('env_key = "CUSTOM_API_KEY"')
  })

  it('emits the real ~/.claude/settings.json env block as strict JSON', () => {
    const text = buildLandingCode({ ...base, tool: 'claude', claudeFormat: 'settings', model: 'claude-sonnet-5-5' })
    expect(JSON.parse(text)).toEqual({
      env: { ANTHROPIC_BASE_URL: 'https://gw.example/prefix', ANTHROPIC_AUTH_TOKEN: 'YOUR_API_KEY', ANTHROPIC_MODEL: 'claude-sonnet-5-5' },
    })
    expect(text.split('\n').some((l) => l.trim().startsWith('//'))).toBe(false)
    expect(text).not.toContain('/v1')
  })

  it('omits the model from settings.json when none is known', () => {
    const env = JSON.parse(buildLandingCode({ ...base, tool: 'claude', claudeFormat: 'settings' })).env
    expect(env).not.toHaveProperty('ANTHROPIC_MODEL')
  })

  it('shows the settings path per OS', () => {
    expect(claudeSettingsPath('unix')).toBe('~/.claude/settings.json')
    expect(claudeSettingsPath('win')).toBe('%USERPROFILE%\\.claude\\settings.json')
  })

  it('emits PowerShell syntax on Windows', () => {
    const claude = buildLandingCode({ ...base, tool: 'claude', os: 'win' })
    expect(claude).toContain('$env:ANTHROPIC_BASE_URL = "https://gw.example/prefix"')
    expect(claude).not.toContain('export ')
    expect(buildLandingCode({ ...base, tool: 'codex', os: 'win' })).toContain('# $env:CUSTOM_API_KEY = "YOUR_API_KEY"')
    expect(buildLandingCode({ ...base, tool: 'curl', os: 'win' })).toContain(' `')
  })

  it('keeps the legacy curl output when comment and hint are given', () => {
    const curl = buildLandingCode({ ...base, tool: 'curl', comment: 'c', curlHint: 'h' })
    expect(curl.split('\n')[0]).toBe('# c')
    expect(curl).toContain('curl https://gw.example/prefix/v1/responses \\')
    expect(curl.split('\n').at(-1)).toBe('# h')
  })
})

describe('landing markers', () => {
  it('keeps v1 and v2 markers distinct', () => {
    expect(isTlLandingV2Content(' tl:landing-v2\n')).toBe(true)
    expect(isTlLandingV2Content('tl:landing')).toBe(false)
    expect(isTlLandingContent('tl:landing-v2')).toBe(false)
  })
})
