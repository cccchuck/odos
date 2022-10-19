import { BigNumber } from 'ethers'

export interface ISwapItem {
  tokenName: string
  tokenAddr: string
  tokenValue: number
  tokenDecimal: number
  tokenSlippage: number
}

export type ISwapList = ISwapItem[]

export interface IInput {
  tokenAddress: string
  amountIn: BigNumber | number
  receiver: string
  permit: string
}

export interface IOutput {
  tokenAddress: string
  relativeValue: number
  receiver: string
}

export interface ISwapArgus {
  inputs: IInput[]
  outputs: IOutput[]
  valueOutQuote: BigNumber | number
  valueOutMin: BigNumber | number
  executor: string
  pathDefinition: string
  override: {
    gasLimit?: number
    maxFeePerGas?: BigNumber | null
    maxPriorityFeePerGas?: BigNumber | null
    value?: BigNumber
  }
}
