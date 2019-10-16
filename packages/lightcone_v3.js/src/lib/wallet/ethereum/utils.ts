import validator from "../common/validator";
import request from "../common/request";

import { sha3 } from "ethereumjs-util";

var host = "http://localhost:8545";

export function updateHost(newValue) {
  host = newValue;
}

export async function getTransactionCount(address, tag) {
  try {
    validator.validate({ value: address, type: "ADDRESS" });
  } catch (e) {
    throw new Error("Invalid Address");
  }
  tag = tag || "pending";
  if (tag) {
    try {
      validator.validate({ value: tag, type: "RPC_TAG" });
    } catch (e) {
      throw new Error("Invalid tag, must be one of latest, pending, earliest");
    }
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getTransactionCount";
  body["params"] = params;
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export async function getGasPrice() {
  const params = [];
  const body = {};
  body["method"] = "eth_gasPrice";
  body["params"] = params;
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export async function estimateGas(tx) {
  const body = {};
  body["method"] = "eth_estimateGas";
  body["params"] = [tx];
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export async function getAccountBalance(address, tag?) {
  try {
    validator.validate({ value: address, type: "ADDRESS" });
  } catch (e) {
    throw new Error("Invalid Address");
  }
  tag = tag || "pending";
  if (tag) {
    try {
      validator.validate({ value: tag, type: "RPC_TAG" });
    } catch (e) {
      throw new Error("Invalid tag, must be one of latest, pending,earliest");
    }
  }
  const params = [address, tag];
  const body = {};
  body["method"] = "eth_getBalance";
  body["params"] = params;
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export async function getTransactionByhash(hash) {
  try {
    validator.validate({ value: hash, type: "ETH_DATA" });
  } catch (e) {
    throw new Error("Invalid Transaction Hash");
  }
  const params = [hash];
  const body = {};
  body["method"] = "eth_getTransactionByHash";
  body["params"] = params;
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export async function getTransactionRecipt(hash) {
  try {
    validator.validate({ value: hash, type: "ETH_DATA" });
  } catch (e) {
    throw new Error("Invalid Transaction Hash");
  }
  const params = [hash];
  const body = {};
  body["method"] = "eth_getTransactionReceipt";
  body["params"] = params;
  // Set id
  body["id"] = 1;
  return request(host, {
    method: "post",
    body
  });
}

export function isValidEthAddress(address) {
  try {
    validator.validate({ value: address, type: "ADDRESS" });
    return true;
  } catch (e) {
    return false;
  }
}

export function getHash(message) {
  return sha3(message);
}
