import { sanitizeUrl } from './url'

export const TL_LANDING_MARKER = 'tl:landing'

export function isTlLandingContent(content: string | null | undefined): boolean {
  return (content ?? '').trim() === TL_LANDING_MARKER
}

export interface ShowcaseImage {
  src: string
  model: string
  date: string
  prompt: string
}

export interface ShowcaseDemo {
  src: string
  model: string
  date: string
}

// Asset provenance is not verified; do not present model IDs or dates as facts.
export const SHOWCASE_DATE = ''

export const SHOWCASE_IMAGES: ShowcaseImage[] = [
  { src: '/showcase/city.jpg', model: '', date: SHOWCASE_DATE, prompt: 'Neon-lit rainy cyberpunk megacity street at night' },
  { src: '/showcase/product.jpg', model: '', date: SHOWCASE_DATE, prompt: 'Matte black over-ear headphones, mint rim lighting' },
  { src: '/showcase/ink.jpg', model: '', date: SHOWCASE_DATE, prompt: 'Modern minimal Chinese ink wash landscape' },
  { src: '/showcase/desk.jpg', model: '', date: SHOWCASE_DATE, prompt: 'Isometric futuristic developer workspace' },
]

export const SHOWCASE_DEMOS: Record<'claude' | 'gpt', ShowcaseDemo> = {
  claude: { src: '/showcase/claude-snake.html', model: '', date: SHOWCASE_DATE },
  gpt: { src: '/showcase/gpt-nebula.html', model: '', date: SHOWCASE_DATE },
}

export function nextTypedLength(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(total, Math.max(0, current) + 1)
}

/** Resolve a deployment's OpenAI endpoint without duplicating /v1. */
export function resolveLandingApiBase(configured: string | null | undefined, origin: string): string {
  const valid = (value: string) => {
    const safe = sanitizeUrl(value)
    if (!safe) return ''
    const url = new URL(safe)
    if (url.username || url.password || url.search || url.hash) return ''
    return safe.replace(/\/+$/, '').replace(/(?:\/v1)+$/, '')
  }
  return (valid(configured || '') || valid(origin)) + '/v1'
}

export { DOC_PATH as LANDING_DOC_PATH } from './docPath'
