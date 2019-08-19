import EthTransaction from "ethereumjs-tx";
import validator from "./validator";
import { addHexPrefix, toBuffer, toHex } from "../common/formatter";
import { getGasPrice, getTransactionCount } from "./utils";
import request from "../common/request";
import { configs } from "../config/data";

// HACK: What is the host in wallet/ethereum?
const host = "host";

export default class Transaction {
  raw: string;
  signed: string;

  constructor(rawTx) {
    validator.validate({ value: rawTx, type: "BASIC_TX" });
    this.raw = rawTx;
  }

  setGasLimit() {
    this.raw["gasLimit"] = this.raw["gasLimit"] || configs["defaultGasLimit"];
  }

  async setGasPrice() {
    this.raw["gasPrice"] =
      this.raw["gasPrice"] || (await getGasPrice())["result"];
  }

  setChainId() {
    this.raw["chainId"] = this.raw["chainId"] || configs["chainId"] || 1;
  }

  async setNonce(address, tag) {
    tag = tag || "pending";
    this.raw["nonce"] =
      this.raw["nonce"] || (await getTransactionCount(address, tag))["result"];
  }

  hash() {
    validator.validate({ value: this.raw, type: "TX" });
    return new EthTransaction(this.raw).hash();
  }

  async sign({ privateKey, walletType, path }) {
    try {
      validator.validate({ value: this.raw, type: "TX" });
    } catch (e) {
      await this.complete();
    }
    const ethTx = new EthTransaction(this.raw);

    let signed;
    if (privateKey) {
      try {
        if (typeof privateKey === "string") {
          validator.validate({ value: privateKey, type: "PRIVATE_KEY" });
          privateKey = toBuffer(addHexPrefix(privateKey));
        } else {
          validator.validate({ value: privateKey, type: "PRIVATE_KEY_BUFFER" });
        }
      } catch (e) {
        throw new Error("Invalid private key");
      }

      ethTx.sign(privateKey);
      signed = toHex(ethTx.serialize());
    } else {
      throw new Error("Invalid private key");
    }
    this.signed = signed;
    return signed;
  }

  async send({ privateKey, walletType, path }) {
    if (!this.signed) {
      await this.sign({ privateKey, walletType, path });
    }
    let body = {};
    body["method"] = "eth_sendRawTransaction";
    body["params"] = [this.signed];
    return request(host, {
      method: "post",
      body
    });
  }

  async sendRawTx(signedTx) {
    let body = {};
    body["method"] = "eth_sendRawTransaction";
    body["params"] = [signedTx];
    return request(host, {
      method: "post",
      body
    });
  }

  async complete() {
    this.setChainId();
    this.setGasLimit();
    await this.setGasPrice();
  }
}
