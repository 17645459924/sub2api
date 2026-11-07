import { describe, expect, it } from 'vitest'
import { isTlLandingContent, nextTypedLength, SHOWCASE_IMAGES, SHOWCASE_DEMOS } from '../tlLanding'

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

  it('every showcase item labels model and date', () => {
    for (const i of SHOWCASE_IMAGES) {
      expect(i.model).toBeTruthy()
      expect(i.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(SHOWCASE_DEMOS.claude.model).toBe('claude-sonnet-5-5')
    expect(SHOWCASE_DEMOS.gpt.model).toBe('gpt-6.1-sol')
  })
})
