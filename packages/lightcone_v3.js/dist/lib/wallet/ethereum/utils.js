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
const validator_1 = __importDefault(require("../common/validator"));
const request_1 = __importDefault(require("../common/request"));
const ethereumjs_util_1 = require("ethereumjs-util");
var host = "http://localhost:8545";
function updateHost(newValue) {
  host = newValue;
}
exports.updateHost = updateHost;
function getTransactionCount(address, tag) {
  return __awaiter(this, void 0, void 0, function*() {
    try {
      validator_1.default.validate({ value: address, type: "ADDRESS" });
    } catch (e) {
      throw new Error("Invalid Address");
    }
    tag = tag || "pending";
    if (tag) {
      try {
        validator_1.default.validate({ value: tag, type: "RPC_TAG" });
      } catch (e) {
        throw new Error(
          "Invalid tag, must be one of latest, pending, earliest"
        );
      }
    }
    const params = [address, tag];
    const body = {};
    body["method"] = "eth_getTransactionCount";
    body["params"] = params;
    // Set id
    body["id"] = 1;
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.getTransactionCount = getTransactionCount;
function getGasPrice() {
  return __awaiter(this, void 0, void 0, function*() {
    const params = [];
    const body = {};
    body["method"] = "eth_gasPrice";
    body["params"] = params;
    // Set id
    body["id"] = 1;
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.getGasPrice = getGasPrice;
function estimateGas(tx) {
  return __awaiter(this, void 0, void 0, function*() {
    const body = {};
    body["method"] = "eth_estimateGas";
    body["params"] = [tx];
    // Set id
    body["id"] = 1;
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.estimateGas = estimateGas;
function getAccountBalance(address, tag) {
  return __awaiter(this, void 0, void 0, function*() {
    try {
      validator_1.default.validate({ value: address, type: "ADDRESS" });
    } catch (e) {
      throw new Error("Invalid Address");
    }
    tag = tag || "pending";
    if (tag) {
      try {
        validator_1.default.validate({ value: tag, type: "RPC_TAG" });
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
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.getAccountBalance = getAccountBalance;
function getTransactionByhash(hash) {
  return __awaiter(this, void 0, void 0, function*() {
    try {
      validator_1.default.validate({ value: hash, type: "ETH_DATA" });
    } catch (e) {
      throw new Error("Invalid Transaction Hash");
    }
    const params = [hash];
    const body = {};
    body["method"] = "eth_getTransactionByHash";
    body["params"] = params;
    // Set id
    body["id"] = 1;
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.getTransactionByhash = getTransactionByhash;
function getTransactionRecipt(hash) {
  return __awaiter(this, void 0, void 0, function*() {
    try {
      validator_1.default.validate({ value: hash, type: "ETH_DATA" });
    } catch (e) {
      throw new Error("Invalid Transaction Hash");
    }
    const params = [hash];
    const body = {};
    body["method"] = "eth_getTransactionReceipt";
    body["params"] = params;
    // Set id
    body["id"] = 1;
    return request_1.default(host, {
      method: "post",
      body
    });
  });
}
exports.getTransactionRecipt = getTransactionRecipt;
function isValidEthAddress(address) {
  try {
    validator_1.default.validate({ value: address, type: "ADDRESS" });
    return true;
  } catch (e) {
    return false;
  }
}
exports.isValidEthAddress = isValidEthAddress;
function getHash(message) {
  return ethereumjs_util_1.sha3(message);
}
exports.getHash = getHash;
//# sourceMappingURL=utils.js.map
