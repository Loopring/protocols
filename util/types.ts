import { BigNumber } from "bignumber.js";

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

export interface RingsSubmitParam {
  miningSpec: number;
  orderSpecs: number[];
  ringSpecs: number[][];
  addressList: string[];
  uintList: BigNumber[];
  bytesList: string[];
}

export interface RingInfo {
  amountSList: number[];
  amountBList: number[];
  lrcFeeAmountList?: number[];
  miner?: string;
  orderOwners?: string[];
  tokenAddressList?: string[];
  authAddressList?: string[];
  walletAddrList?: string[];
  marginSplitPercentageList?: number[];
  buyNoMoreThanAmountBList?: boolean[];
  feeSelections?: number[];
  spendableAmountSList?: number[];
  spendableLrcFeeAmountList?: number[];
  orderFilledOrCancelledAmountList?: number[];
  description?: string;
  salt?: number;
  verbose?: boolean;
  id?: string;
}

export interface RingsInfo {
  description?: string;
  ringInfoList: RingInfo[];
}
