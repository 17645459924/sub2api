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

export const SHOWCASE_DATE = '2026-11-07'

export const SHOWCASE_IMAGES: ShowcaseImage[] = [
  { src: '/showcase/city.jpg', model: 'gpt-image-2', date: SHOWCASE_DATE, prompt: 'Neon-lit rainy cyberpunk megacity street at night' },
  { src: '/showcase/product.jpg', model: 'gpt-image-2', date: SHOWCASE_DATE, prompt: 'Matte black over-ear headphones, mint rim lighting' },
  { src: '/showcase/ink.jpg', model: 'gpt-image-2', date: SHOWCASE_DATE, prompt: 'Modern minimal Chinese ink wash landscape' },
  { src: '/showcase/desk.jpg', model: 'gpt-image-2', date: SHOWCASE_DATE, prompt: 'Isometric futuristic developer workspace' },
]

export const SHOWCASE_DEMOS: Record<'claude' | 'gpt', ShowcaseDemo> = {
  claude: { src: '/showcase/claude-snake.html', model: 'claude-sonnet-5-5', date: SHOWCASE_DATE },
  gpt: { src: '/showcase/gpt-nebula.html', model: 'gpt-6.1-sol', date: SHOWCASE_DATE },
}

export function nextTypedLength(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(total, Math.max(0, current) + 1)
}
