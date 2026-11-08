import { describe, expect, it } from 'vitest'
import { isTlLandingContent, nextTypedLength, SHOWCASE_IMAGES, SHOWCASE_DEMOS, resolveLandingApiBase, LANDING_DOC_PATH } from '../tlLanding'

describe('tlLanding', () => {
  it('only matches the exact marker (trimmed)', () => {
    expect(isTlLandingContent('tl:landing')).toBe(true)
    expect(isTlLandingContent('  tl:landing\n')).toBe(true)
    expect(isTlLandingContent('<style>tl:landing</style>')).toBe(false)
    expect(isTlLandingContent('')).toBe(false)
    expect(isTlLandingContent(undefined)).toBe(false)
  })

  it('typed length is clamped', () => {
    expect(nextTypedLength(0, 5)).toBe(1)
    expect(nextTypedLength(5, 5)).toBe(5)
    expect(nextTypedLength(-3, 5)).toBe(1)
    expect(nextTypedLength(2, 0)).toBe(0)
  })

  it('does not fabricate asset provenance', () => {
    for (const item of [...SHOWCASE_IMAGES, ...Object.values(SHOWCASE_DEMOS)]) {
      expect(item.model).toBeFalsy()
      expect(item.date).toBeFalsy()
    }
  })
  it('uses configured endpoints, preserves prefixes and normalizes /v1', () => {
    expect(resolveLandingApiBase('https://gateway.example/proxy/v1/', 'https://local.example')).toBe('https://gateway.example/proxy/v1')
    expect(resolveLandingApiBase('https://gateway.example/v1/v1', 'https://local.example')).toBe('https://gateway.example/v1')
    expect(resolveLandingApiBase('', 'https://local.example')).toBe('https://local.example/v1')
    expect(resolveLandingApiBase('javascript:alert(1)', 'https://local.example')).toBe('https://local.example/v1')
    expect(resolveLandingApiBase('https://user:pass@gateway.example', 'https://local.example')).toBe('https://local.example/v1')
  })
  it('points the landing documentation entry at the built-in guide', () => {
    expect(LANDING_DOC_PATH).toBe('/docs/quickstart')
  })
})
