import validator from "./validator";
import request, { id } from "../common/request";
import Response from "../common/response";
import code from "../common/code";

export default class Eth {
  host: string;

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

/**
 * @description Returns the number of transactions sent from an address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */
export function getTransactionCount(host, { address, tag }) {
  tag = tag || "pending";
  try {
    validator.validate({ value: address, type: "ETH_ADDRESS" });
    validator.validate({ value: tag, type: "RPC_TAG" });
  } catch (e) {
    return Promise.resolve(
      new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
    );
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getTransactionCount";
  body["params"] = params;
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Sends signed ethereum tx
 * @param host
 * @param signedTx
 * @returns {Promise}
 */
export function sendRawTransaction(host, signedTx) {
  const body = {};
  body["method"] = "eth_sendRawTransaction";
  body["params"] = [signedTx];
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Returns the current price per gas in wei.
 * @param host
 * @returns {Promise}
 */
export function getGasPrice(host) {
  const params = [];
  const body = {};
  body["method"] = "eth_gasPrice";
  body["params"] = params;
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
 * @param host
 * @param tx
 * @returns {Promise}
 */
export function estimateGas(host, tx) {
  const body = {};
  body["method"] = "eth_estimateGas";
  body["params"] = [tx];
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Returns the ethereum balance of the account of given address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */
export function getAccountBalance(host, { address, tag }) {
  tag = tag || "latest";
  if (tag) {
    try {
      validator.validate({ value: tag, type: "RPC_TAG" });
      validator.validate({ value: address, type: "ETH_ADDRESS" });
    } catch (e) {
      return Promise.resolve(
        new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
      );
    }
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getBalance";
  body["params"] = params;
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Returns the information about a transaction requested by transaction hash.
 * @param host
 * @param hash ethereum tx hash
 * @returns {Promise}
 */
export function getTransactionByhash(host, hash) {
  try {
    validator.validate({ value: hash, type: "ETH_DATA" });
  } catch (e) {
    return Promise.resolve(
      new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
    );
  }
  const params = [hash];
  const body = {};
  body["method"] = "eth_getTransactionByHash";
  body["params"] = params;
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}

/**
 * @description Executes a new message call immediately without creating a transaction on the block chain.
 * @param host
 * @param tx
 * @param tag
 * @returns {Promise}
 */
export function call(host, { tx, tag }) {
  tag = tag || "latest";
  if (tag) {
    try {
      validator.validate({ value: tag, type: "RPC_TAG" });
    } catch (e) {
      return Promise.resolve(
        new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
      );
    }
  }
  const params = [tx, tag];
  const body = {};
  body["method"] = "eth_call";
  body["params"] = params;
  body["id"] = id();
  body["jsonrpc"] = "2.0";
  return request(host, {
    method: "post",
    body
  });
}
