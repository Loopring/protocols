"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
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
const validator_1 = __importDefault(require("./validator"));
const request_1 = __importStar(require("../common/request"));
const response_1 = __importDefault(require("../common/response"));
const code_1 = __importDefault(require("../common/code"));
class Eth {
  constructor(host) {
    this.host = host;
  }
  getTransactionCount({ address, tag }) {
    return getTransactionCount(this.host, { address, tag });
  }
  sendRawTransaction(signedTx) {
    return sendRawTransaction(this.host, signedTx);
  }
  getGasPrice() {
    return getGasPrice(this.host);
  }
  estimateGas(tx) {
    return estimateGas(this.host, tx);
  }
  getAccountBalance({ address, tag }) {
    return getAccountBalance(this.host, { address, tag });
  }
  getTransactionByhash(txHash) {
    return getTransactionByhash(this.host, txHash);
  }
  call({ tx, tag }) {
    return call(this.host, { tx, tag });
  }
}
exports.default = Eth;
/**
 * @description Returns the number of transactions sent from an address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */
function getTransactionCount(host, { address, tag }) {
  tag = tag || "pending";
  try {
    validator_1.default.validate({ value: address, type: "ETH_ADDRESS" });
    validator_1.default.validate({ value: tag, type: "RPC_TAG" });
  } catch (e) {
    return Promise.resolve(
      new response_1.default(
        code_1.default.PARAM_INVALID.code,
        code_1.default.PARAM_INVALID.msg
      )
    );
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getTransactionCount";
  body["params"] = params;
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.getTransactionCount = getTransactionCount;
/**
 * @description Sends signed ethereum tx
 * @param host
 * @param signedTx
 * @returns {Promise}
 */
function sendRawTransaction(host, signedTx) {
  const body = {};
  body["method"] = "eth_sendRawTransaction";
  body["params"] = [signedTx];
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.sendRawTransaction = sendRawTransaction;
/**
 * @description Returns the current price per gas in wei.
 * @param host
 * @returns {Promise}
 */
function getGasPrice(host) {
  const params = [];
  const body = {};
  body["method"] = "eth_gasPrice";
  body["params"] = params;
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.getGasPrice = getGasPrice;
/**
 * @description Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
 * @param host
 * @param tx
 * @returns {Promise}
 */
function estimateGas(host, tx) {
  const body = {};
  body["method"] = "eth_estimateGas";
  body["params"] = [tx];
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.estimateGas = estimateGas;
/**
 * @description Returns the ethereum balance of the account of given address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */
function getAccountBalance(host, { address, tag }) {
  tag = tag || "latest";
  if (tag) {
    try {
      validator_1.default.validate({ value: tag, type: "RPC_TAG" });
      validator_1.default.validate({ value: address, type: "ETH_ADDRESS" });
    } catch (e) {
      return Promise.resolve(
        new response_1.default(
          code_1.default.PARAM_INVALID.code,
          code_1.default.PARAM_INVALID.msg
        )
      );
    }
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getBalance";
  body["params"] = params;
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.getAccountBalance = getAccountBalance;
/**
 * @description Returns the information about a transaction requested by transaction hash.
 * @param host
 * @param hash ethereum tx hash
 * @returns {Promise}
 */
function getTransactionByhash(host, hash) {
  try {
    validator_1.default.validate({ value: hash, type: "ETH_DATA" });
  } catch (e) {
    return Promise.resolve(
      new response_1.default(
        code_1.default.PARAM_INVALID.code,
        code_1.default.PARAM_INVALID.msg
      )
    );
  }
  const params = [hash];
  const body = {};
  body["method"] = "eth_getTransactionByHash";
  body["params"] = params;
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.getTransactionByhash = getTransactionByhash;
/**
 * @description Executes a new message call immediately without creating a transaction on the block chain.
 * @param host
 * @param tx
 * @param tag
 * @returns {Promise}
 */
function call(host, { tx, tag }) {
  tag = tag || "latest";
  if (tag) {
    try {
      validator_1.default.validate({ value: tag, type: "RPC_TAG" });
    } catch (e) {
      return Promise.resolve(
        new response_1.default(
          code_1.default.PARAM_INVALID.code,
          code_1.default.PARAM_INVALID.msg
        )
      );
    }
  }
  const params = [tx, tag];
  const body = {};
  body["method"] = "eth_call";
  body["params"] = params;
  body["id"] = request_1.id();
  body["jsonrpc"] = "2.0";
  return request_1.default(host, {
    method: "post",
    body
  });
}
exports.call = call;
//# sourceMappingURL=eth.js.map
