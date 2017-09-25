import * as BigNumber from 'bignumber.js';

export interface OrderParams {
  loopringProtocol: string;
  tokenS: string;
  tokenB: string;
  amountS: BigNumber.BigNumber;
  amountB: BigNumber.BigNumber;
  timestamp: number;
  expiration: number;
  rand: number;
  lrcFee: BigNumber.BigNumber;
  buyNoMoreThanAmountB: boolean;
  savingSharePercentage: number;
  orderHashHex?: string;
  v?: number;
  r?: string;
  s?: string;
}
