"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function(resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const ethereumjs_tx_1 = __importDefault(require("ethereumjs-tx"));
const validator_1 = __importDefault(require("./validator"));
const formatter_1 = require("../common/formatter");
const utils_1 = require("./utils");
const request_1 = __importDefault(require("../common/request"));
const data_1 = require("../config/data");
// HACK: What is the host in wallet/ethereum?
const host = "host";
class Transaction {
  constructor(rawTx) {
    validator_1.default.validate({ value: rawTx, type: "BASIC_TX" });
    this.raw = rawTx;
  }
  setGasLimit() {
    this.raw["gasLimit"] =
      this.raw["gasLimit"] || data_1.configs["defaultGasLimit"];
  }
  setGasPrice() {
    return __awaiter(this, void 0, void 0, function*() {
      this.raw["gasPrice"] =
        this.raw["gasPrice"] || (yield utils_1.getGasPrice())["result"];
    });
  }
  setChainId() {
    this.raw["chainId"] = this.raw["chainId"] || data_1.configs["chainId"] || 1;
  }
  setNonce(address, tag) {
    return __awaiter(this, void 0, void 0, function*() {
      tag = tag || "pending";
      this.raw["nonce"] =
        this.raw["nonce"] ||
        (yield utils_1.getTransactionCount(address, tag))["result"];
    });
  }
  hash() {
    validator_1.default.validate({ value: this.raw, type: "TX" });
    return new ethereumjs_tx_1.default(this.raw).hash();
  }
  sign({ privateKey, walletType, path }) {
    return __awaiter(this, void 0, void 0, function*() {
      try {
        validator_1.default.validate({ value: this.raw, type: "TX" });
      } catch (e) {
        yield this.complete();
      }
      const ethTx = new ethereumjs_tx_1.default(this.raw);
      let signed;
      if (privateKey) {
        try {
          if (typeof privateKey === "string") {
            validator_1.default.validate({
              value: privateKey,
              type: "PRIVATE_KEY"
            });
            privateKey = formatter_1.toBuffer(
              formatter_1.addHexPrefix(privateKey)
            );
          } else {
            validator_1.default.validate({
              value: privateKey,
              type: "PRIVATE_KEY_BUFFER"
            });
          }
        } catch (e) {
          throw new Error("Invalid private key");
        }
        ethTx.sign(privateKey);
        signed = formatter_1.toHex(ethTx.serialize());
      } else {
        throw new Error("Invalid private key");
      }
      this.signed = signed;
      return signed;
    });
  }
  send({ privateKey, walletType, path }) {
    return __awaiter(this, void 0, void 0, function*() {
      if (!this.signed) {
        yield this.sign({ privateKey, walletType, path });
      }
      let body = {};
      body["method"] = "eth_sendRawTransaction";
      body["params"] = [this.signed];
      return request_1.default(host, {
        method: "post",
        body
      });
    });
  }
  sendRawTx(signedTx) {
    return __awaiter(this, void 0, void 0, function*() {
      let body = {};
      body["method"] = "eth_sendRawTransaction";
      body["params"] = [signedTx];
      return request_1.default(host, {
        method: "post",
        body
      });
    });
  }
  complete() {
    return __awaiter(this, void 0, void 0, function*() {
      this.setChainId();
      this.setGasLimit();
      yield this.setGasPrice();
    });
  }
}
exports.default = Transaction;
//# sourceMappingURL=transaction.js.map
