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
const utils_1 = require("./utils");
const formatter_1 = require("../common/formatter");
const validator_1 = __importDefault(require("./validator"));
const setWallet = wallet => {
  const wallets =
    typeof localStorage !== "undefined" && localStorage.wallet
      ? JSON.parse(localStorage.wallet)
      : [];
  const otherWallets = wallets.filter(
    w => w.address.toLowerCase() !== wallet.address.toLowerCase()
  );
  otherWallets.push({
    address: wallet.address,
    nonce: formatter_1.toNumber(wallet.nonce) + 1
  });
  if (typeof localStorage !== "undefined") {
    localStorage.wallet = JSON.stringify(otherWallets);
  }
};
const getWallet = address => {
  const wallets =
    typeof localStorage !== "undefined" && localStorage.wallet
      ? JSON.parse(localStorage.wallet)
      : [];
  console.log("get wallets");
  return wallets.find(
    wallet => wallet.address.toLowerCase() === address.toLowerCase()
  );
};
const getNonce = address =>
  __awaiter(void 0, void 0, void 0, function*() {
    try {
      validator_1.default.validate({ value: address, type: "ADDRESS" });
      const nonce =
        formatter_1.toNumber(
          (yield utils_1.getTransactionCount(address, "pending"))["result"]
        ) || 0;
      const localNonce =
        getWallet(address) && getWallet(address).nonce
          ? getWallet(address).nonce
          : 0;
      return Math.max(nonce, localNonce);
    } catch (e) {
      throw new Error(e.message);
    }
  });
const storeUnlockedAddress = (unlockType, address) => {
  localStorage.unlockedType = unlockType;
  localStorage.unlockedAddress = address;
};
const getUnlockedAddress = () => {
  return localStorage.unlockedAddress || "";
};
const getUnlockedType = () => {
  return localStorage.unlockedType || "";
};
const clearUnlockedAddress = () => {
  localStorage.unlockedType = "";
  localStorage.unlockedAddress = "";
};
const isInWhiteList = address => {};
exports.default = {
  setWallet,
  getWallet,
  isInWhiteList,
  getNonce,
  storeUnlockedAddress,
  getUnlockedAddress,
  getUnlockedType,
  clearUnlockedAddress
};
//# sourceMappingURL=wallet.js.map
