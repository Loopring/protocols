"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const bn_js_1 = __importDefault(require("bn.js"));
class Constants {}
exports.Constants = Constants;
Constants.TREE_DEPTH_TRADING_HISTORY = 14;
Constants.TREE_DEPTH_ACCOUNTS = 20;
Constants.TREE_DEPTH_TOKENS = 8;
Constants.NUM_BITS_ACCOUNTID = Constants.TREE_DEPTH_ACCOUNTS;
Constants.NUM_BITS_ORDERID = 20;
Constants.NUM_BITS_LABEL = 32;
Constants.MAX_NUM_TOKENS = Math.pow(2, 8);
Constants.MAX_AMOUNT = new bn_js_1.default(2)
  .pow(new bn_js_1.default(96))
  .sub(new bn_js_1.default(1));
Constants.Float28Encoding = {
  numBitsExponent: 5,
  numBitsMantissa: 23,
  exponentBase: 10
};
Constants.Float24Encoding = {
  numBitsExponent: 5,
  numBitsMantissa: 19,
  exponentBase: 10
};
Constants.Float16Encoding = {
  numBitsExponent: 5,
  numBitsMantissa: 11,
  exponentBase: 10
};
Constants.emptyBytes = [];
Constants.zeroAddress = "0x" + "00".repeat(20);
Constants.scalarField = new bn_js_1.default(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
  10
);
//# sourceMappingURL=constants.js.map
