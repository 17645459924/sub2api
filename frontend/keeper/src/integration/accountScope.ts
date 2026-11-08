/** Account choices are namespaced so persisted API key IDs cannot become account IDs. */
export function normalizeStoredAccountFilter(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = /^account:([1-9]\d*)$/.exec(value.trim())
  if (!match || !Number.isSafeInteger(Number(match[1]))) return ''
  return `account:${match[1]}`
}
