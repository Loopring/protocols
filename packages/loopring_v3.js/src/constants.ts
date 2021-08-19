import BN from "bn.js";
import { FloatEncoding } from "./float";
import { Balance } from "./types";

export class Constants {
  static readonly BINARY_TREE_DEPTH_STORAGE = 14;
  static readonly BINARY_TREE_DEPTH_ACCOUNTS = 32;
  static readonly BINARY_TREE_DEPTH_TOKENS = 16;

  static readonly TX_DATA_AVAILABILITY_SIZE = 68;

  static readonly NUM_BITS_ACCOUNTID = Constants.BINARY_TREE_DEPTH_ACCOUNTS;
  static readonly NUM_BITS_STORAGEID = 32;
  static readonly NUM_STORAGE_SLOTS = 2 ** Constants.BINARY_TREE_DEPTH_STORAGE;

  static readonly MAX_NUM_TOKENS = 2 ** 16;

  static readonly NFT_TOKEN_ID_START = 2 ** 15;

  static readonly MAX_AMOUNT = new BN(2).pow(new BN(96)).sub(new BN(1));

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

  static readonly DefaultBalance: Balance = {
    balance: new BN(0),
    weightAMM: new BN(0),
    storage: {}
  };

  public static isNFT(tokenID: number) {
    return tokenID >= this.NFT_TOKEN_ID_START;
  }
}
