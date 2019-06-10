import { FloatEncoding } from "./float";

export const TREE_DEPTH_TRADING_HISTORY = 14;
export const TREE_DEPTH_ACCOUNTS = 20;
export const TREE_DEPTH_TOKENS = 8;

export const NUM_BITS_ACCOUNTID = TREE_DEPTH_ACCOUNTS;
export const NUM_BITS_ORDERID = 20;

export const MAX_NUM_TOKENS = 2 ** 8;

export const Float28Encoding: FloatEncoding = {
  numBitsExponent: 5, numBitsMantissa: 23, exponentBase: 10,
};
export const Float24Encoding: FloatEncoding = {
  numBitsExponent: 5, numBitsMantissa: 19, exponentBase: 10,
};
export const Float16Encoding: FloatEncoding = {
  numBitsExponent: 5, numBitsMantissa: 11, exponentBase: 10,
};
export const Float12Encoding: FloatEncoding = {
  numBitsExponent: 5, numBitsMantissa: 7, exponentBase: 10,
};
export const Float8Encoding: FloatEncoding = {
  numBitsExponent: 5, numBitsMantissa: 3, exponentBase: 10,
};

export const emptyBytes = web3.utils.hexToBytes("0x");
