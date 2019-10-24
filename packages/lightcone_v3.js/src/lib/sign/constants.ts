import BN from "bn.js";
import { FloatEncoding } from "./float";

export class Constants {
  static readonly TREE_DEPTH_TRADING_HISTORY = 14;
  static readonly TREE_DEPTH_ACCOUNTS = 20;
  static readonly TREE_DEPTH_TOKENS = 8;

  static readonly NUM_BITS_ACCOUNTID = Constants.TREE_DEPTH_ACCOUNTS;
  static readonly NUM_BITS_ORDERID = 20;
  static readonly NUM_BITS_LABEL = 32;

  static readonly MAX_NUM_TOKENS = 2 ** 8;

  static readonly MAX_AMOUNT = new BN(2).pow(new BN(96)).sub(new BN(1));

  static readonly Float28Encoding: FloatEncoding = {
    numBitsExponent: 5,
    numBitsMantissa: 23,
    exponentBase: 10
  };
  static readonly Float24Encoding: FloatEncoding = {
    numBitsExponent: 5,
    numBitsMantissa: 19,
    exponentBase: 10
  };
  static readonly Float16Encoding: FloatEncoding = {
    numBitsExponent: 5,
    numBitsMantissa: 11,
    exponentBase: 10
  };

  static readonly emptyBytes: any = [];
  static readonly zeroAddress = "0x" + "00".repeat(20);

  static readonly scalarField = new BN(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617",
    10
  );
}
