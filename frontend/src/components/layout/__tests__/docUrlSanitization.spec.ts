import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const read = (relative: string) => readFileSync(resolve(dir, relative), 'utf8')
const headerSource = read('../AppHeader.vue')
const homeViewSource = read('../../../views/HomeView.vue')
const keyUsageViewSource = read('../../../views/KeyUsageView.vue')

describe('documentation entries', () => {
  it('uses one built-in guide path for the whole site', () => {
    expect(read('../../../utils/docPath.ts')).toContain("DOC_PATH = '/docs/quickstart'")
  })

  it.each([
    ['AppHeader', headerSource],
    ['HomeView', homeViewSource],
    ['KeyUsageView', keyUsageViewSource],
  ])('%s routes documentation to the built-in guide instead of doc_url', (_name, source) => {
    expect(source).toContain("import { DOC_PATH } from '@/utils/docPath'")
    expect(source).toContain('const docPath = DOC_PATH')
    expect(source).toContain(':to="docPath"')
    expect(source).not.toMatch(/doc_url|appStore\.docUrl|:href="docUrl"/)
  })
})
