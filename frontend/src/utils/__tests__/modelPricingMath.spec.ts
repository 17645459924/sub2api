import { describe, expect, it } from 'vitest'
import { discountRatio, groupPrice } from '../modelPricingMath'

describe('modelPricingMath', () => {
  it('美元价格 = 官方美元价 × 分组倍率', () => {
    expect(groupPrice(5, 0.8)).toBeCloseTo(4)
    expect(discountRatio(0.8)).toBeCloseTo(0.8)
  })

  it('Codex 0.3 倍显示七成节省,不再混用人民币汇率显示 96%', () => {
    expect(groupPrice(2, 0.3)).toBeCloseTo(0.6)
    expect((1 - discountRatio(0.3)) * 100).toBeCloseTo(70)
  })

  it('Claude 0.4 倍使用同一美元口径', () => {
    expect(groupPrice(2, 0.4)).toBeCloseTo(0.8)
    expect(groupPrice(10, 0.4)).toBeCloseTo(4)
    expect(discountRatio(0.4)).toBe(0.4)
  })

  it('支持原价、免费价格和按次计费', () => {
    expect(groupPrice(5, 1)).toBe(5)
    expect(groupPrice(5, 0)).toBe(0)
    expect(groupPrice(0.04, 0.3)).toBeCloseTo(0.012)
  })
})
