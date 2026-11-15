/** 分组美元价 / 官方美元价;充值汇率不参与模型价格比较。 */
export function discountRatio(groupRate: number): number {
  return groupRate
}

/** 官方美元价 -> 分组美元余额扣费。 */
export function groupPrice(officialUsd: number, groupRate: number): number {
  return officialUsd * groupRate
}
