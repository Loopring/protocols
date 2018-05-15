import { BigNumber } from "bignumber.js";
import { Ring } from "./ring";

export interface OrderParams {
  delegateContract: string;
  tokenS: string;
  tokenB: string;
  amountS: BigNumber;
  amountB: BigNumber;
  validSince: BigNumber;
  validUntil: BigNumber;
  lrcFee: BigNumber;
  buyNoMoreThanAmountB: boolean;
  marginSplitPercentage: number;
  authAddr: string;
  walletAddr: string;
  scaledAmountS?: number;
  scaledAmountB?: number;
  rateAmountS?: number;
  rateAmountB?: number;
  fillAmountS?: number;
  orderHashHex?: string;
  v?: number;
  r?: string;
  s?: string;
}

export interface LoopringSubmitParams {
  addressList: string[][];
  uintArgsList: BigNumber[][];
  uint8ArgsList: number[][];
  buyNoMoreThanAmountBList: boolean[];
  vList: number[];
  rList: string[];
  sList: string[];
  ringOwner: string;
  feeRecepient: string;
  feeSelections: number;
}

export interface FeeItem {
  feeS: number;
  feeB: number;
  feeLrc: number;
  lrcReward: number;
}

export interface BalanceItem {
  balanceS: number;
  balanceB: number;
}

export interface RingInfo {
  amountSList: number[];
  amountBList: number[];
  lrcFeeAmountList?: number[];
  miner?: string;
  orderOwners?: string[];
  tokenAddressList?: string[];
  marginSplitPercentageList?: number[];
  buyNoMoreThanAmountBList?: boolean[];
  feeSelections?: number[];
  description?: string;
  salt?: number;
}

export interface RingBalanceInfo {
  participiants: string[];
  tokenAddressList: string[];
  tokenSymbolList: string[];
  tokenBalances: number[][];
}

export interface SimulatorReport {
  ring: Ring;
  fillAmountS: number[];
  transferList: TransferItem[];
  ringBalanceInfo?: RingBalanceInfo;
}

export interface TransferItem {
  description: string;
  tokenAddress: string;
  tokenSymbol?: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
}
