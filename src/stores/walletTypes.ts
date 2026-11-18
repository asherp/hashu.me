export enum PaymentMethod {
  Bolt11 = "bolt11",
  Bolt12 = "bolt12",
  Bolt12Subpayment = "bolt12-subpayment",
  Onchain = "onchain",
  OnchainSubpayment = "onchain-subpayment",
  // hashu.me: redeem TiH vouchers as hashrate sent to a mining pool.
  Hashrate = "hashrate",
}

export enum UnifiedTransactionType {
  Ecash = "ecash",
  Lightning = "lightning",
  Onchain = "onchain",
}
