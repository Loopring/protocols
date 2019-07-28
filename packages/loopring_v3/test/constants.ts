import BN = require("bn.js");
import { FloatEncoding } from "./float";

export const TREE_DEPTH_TRADING_HISTORY = 14;
export const TREE_DEPTH_ACCOUNTS = 20;
export const TREE_DEPTH_TOKENS = 8;

export const NUM_BITS_ACCOUNTID = TREE_DEPTH_ACCOUNTS;
export const NUM_BITS_ORDERID = 20;

export const MAX_NUM_TOKENS = 2 ** 8;

export const MAX_AMOUNT = new BN(2).pow(new BN(96)).sub(new BN(1));

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
export const zeroAddress = "0x" + "00".repeat(20);

export const scalarField = new BN("21888242871839275222246405745257275088548364400416034343698204186575808495617", 10);
