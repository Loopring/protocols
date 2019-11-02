"use strict";
var __importStar =
  (this && this.__importStar) ||
  function(mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
  };
Object.defineProperty(exports, "__esModule", { value: true });
const ethereumjs_util_1 = require("ethereumjs-util");
const formatter_1 = __importStar(require("./formatter"));
/**
 * trim head space and tail space
 * @param str string
 */
function trim(str) {
  return str.replace(/(^\s+)|(\s+$)/g, "");
}
exports.trim = trim;
/**
 * trim all spaces
 * @param str
 */
function trimAll(str) {
  return trim(str).replace(/\s/g, "");
}
exports.trimAll = trimAll;
function keccakHash(str) {
  return formatter_1.toHex(ethereumjs_util_1.keccak(str));
}
exports.keccakHash = keccakHash;
function calculateGas(gasPrice, gasLimit) {
  return formatter_1
    .toBig(gasPrice)
    .times(gasLimit)
    .div(1e9);
}
exports.calculateGas = calculateGas;
exports.default = Object.assign(
  Object.assign(
    { hashPersonalMessage: ethereumjs_util_1.hashPersonalMessage },
    formatter_1.default
  ),
  { trim, trimAll, keccakHash, calculateGas }
);
//# sourceMappingURL=utils.js.map
