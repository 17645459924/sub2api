import { describe, expect, it } from 'vitest'
import { normalizeStoredAccountFilter } from './accountScope'

describe('persisted account selection', () => {
  it('restores valid account selections without accepting legacy API key IDs', () => {
    expect(normalizeStoredAccountFilter('account:42')).toBe('account:42')
    expect(normalizeStoredAccountFilter(' account:2 ')).toBe('account:2')
    for (const value of ['42', 'account:0', 'account:-1', 'account:1x', 'account:9007199254740992', null, {}]) {
      expect(normalizeStoredAccountFilter(value)).toBe('')
    }
  })
})
