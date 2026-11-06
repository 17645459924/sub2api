export interface PricingRates {
  /** 官方价展示汇率:$1 = ¥cnyPerUsd */
  cnyPerUsd: number
  /** 每 $1 余额实付人民币(= 1 / 余额充值倍率) */
  cnyPerBalanceUsd: number
}

export function normalizePricingRates(usdToCny: unknown, rechargeMultiplier: unknown): PricingRates {
  const usd = Number(usdToCny) || 1
  const mult = Number(rechargeMultiplier) || 1
  return { cnyPerUsd: usd, cnyPerBalanceUsd: 1 / mult }
}

/** 实付价 / 官方展示价 */
export function discountRatio(groupRate: number, rates: PricingRates): number {
  return (groupRate * rates.cnyPerBalanceUsd) / rates.cnyPerUsd
}

/** 官方美元价 -> 分组实付人民币价 */
export function groupPrice(officialUsd: number, groupRate: number, rates: PricingRates): number {
  return officialUsd * groupRate * rates.cnyPerBalanceUsd
}
