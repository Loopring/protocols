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
// @ts-ignore
/* ts-disable */
const validator_1 = __importDefault(require("./validator"));
const formatter_1 = require("../common/formatter");
const keystore_1 = require("./keystore");
const ethereumjs_util_1 = require("ethereumjs-util");
const mnemonic_1 = require("./mnemonic");
const bip39_1 = require("bip39");
const utils_1 = require("../common/utils");
const hdkey_1 = __importDefault(require("hdkey"));
const ethereumjs_tx_1 = __importDefault(require("ethereumjs-tx"));
const MetaMask = __importStar(require("./metaMask"));
const ethereumjs_wallet_1 = __importDefault(require("ethereumjs-wallet"));
const wallets_json_1 = __importDefault(require("../config/wallets.json"));
const LoopringWallet = wallets_json_1.default.find(
  wallet => utils_1.trimAll(wallet.name).toLowerCase() === "loopringwallet"
);
exports.path = LoopringWallet.dpath;
function createWallet() {
  return ethereumjs_wallet_1.default.generate();
}
exports.createWallet = createWallet;
/**
 * @description Returns the ethereum address  of a given private key
 * @param privateKey
 * @returns {string}
 */
function privateKeytoAddress(privateKey) {
  try {
    if (typeof privateKey === "string") {
      validator_1.default.validate({ value: privateKey, type: "ETH_KEY" });
      privateKey = formatter_1.toBuffer(formatter_1.addHexPrefix(privateKey));
    } else {
      validator_1.default.validate({
        value: privateKey,
        type: "PRIVATE_KEY_BUFFER"
      });
    }
  } catch (e) {
    throw new Error("Invalid private key");
  }
  return formatter_1.formatAddress(
    ethereumjs_util_1.privateToAddress(privateKey)
  );
}
exports.privateKeytoAddress = privateKeytoAddress;
/**
 * @description Returns the ethereum address of a given public key.
 * Accepts "Ethereum public keys" and SEC1 encoded keys.
 * @param publicKey Buffer | string
 * @param sanitize bool [sanitize=false] Accept public keys in other formats
 * @returns {string}
 */
function publicKeytoAddress(publicKey, sanitize) {
  publicKey = formatter_1.toBuffer(publicKey);
  return formatter_1.formatAddress(
    ethereumjs_util_1.publicToAddress(publicKey, sanitize)
  );
}
exports.publicKeytoAddress = publicKeytoAddress;
/**
 *
 * @param publicKey
 * @param chainCode
 * @param pageSize
 * @param pageNum
 * @returns {<Array>}
 */
function getAddresses({ publicKey, chainCode, pageSize, pageNum }) {
  const addresses = [];
  const hdk = new hdkey_1.default();
  hdk.publicKey =
    publicKey instanceof Buffer
      ? publicKey
      : formatter_1.toBuffer(formatter_1.addHexPrefix(publicKey));
  hdk.chainCode =
    chainCode instanceof Buffer
      ? chainCode
      : formatter_1.toBuffer(formatter_1.addHexPrefix(chainCode));
  for (let i = 0; i < pageSize; i++) {
    const dkey = hdk.derive(`m/${i + pageSize * pageNum}`);
    addresses.push(publicKeytoAddress(dkey.publicKey, true));
  }
  return addresses;
}
exports.getAddresses = getAddresses;
/**
 * @description Returns the ethereum public key of a given private key.
 * @param privateKey Buffer | string
 * @returns {string}
 */
function privateKeytoPublic(privateKey) {
  try {
    if (typeof privateKey === "string") {
      validator_1.default.validate({ value: privateKey, type: "ETH_KEY" });
      privateKey = formatter_1.toBuffer(formatter_1.addHexPrefix(privateKey));
    } else {
      validator_1.default.validate({
        value: privateKey,
        type: "PRIVATE_KEY_BUFFER"
      });
    }
  } catch (e) {
    throw new Error("Invalid private key");
  }
  return formatter_1.formatKey(ethereumjs_util_1.privateToPublic(privateKey));
}
exports.privateKeytoPublic = privateKeytoPublic;
/**
 * @description Returns WalletAccount of given mnemonic, dpath and password
 * @param mnemonic string
 * @param dpath string
 * @param password string
 * @returns {WalletAccount}
 */
function fromMnemonic(mnemonic, dpath, password) {
  const privateKey = mnemonic_1.mnemonictoPrivatekey(mnemonic, dpath, password);
  return fromPrivateKey(privateKey);
}
exports.fromMnemonic = fromMnemonic;
/**
 * @description Returns WalletAccount of a given private key
 * @param privateKey string | buffer
 * @returns {WalletAccount}
 */
function fromPrivateKey(privateKey) {
  return new PrivateKeyAccount(privateKey);
}
exports.fromPrivateKey = fromPrivateKey;
/**
 * @description Returns WalletAccount of the given keystore
 * @param keystore string
 * @param password string
 * @returns {WalletAccount}
 */
function fromKeystore(keystore, password) {
  const privateKey = keystore_1.decryptKeystoreToPkey(keystore, password);
  return fromPrivateKey(privateKey);
}
exports.fromKeystore = fromKeystore;
function fromMetaMask(web3, account, address) {
  return new MetaMaskAccount(web3, account, address);
}
exports.fromMetaMask = fromMetaMask;
/**
 * @description generate mnemonic
 * @param strength
 * @returns {*}
 */
function createMnemonic(strength) {
  return bip39_1.generateMnemonic(strength || 256);
}
exports.createMnemonic = createMnemonic;
// Hack: Failed to import in react web app
class WalletAccount {
  // Hack: to use in typescript
  getAddress() {
    return "1";
  }
  // /**
  //  * @description sign
  //  * @param hash
  //  */
  // sign(hash) {
  //     throw Error('unimplemented');
  // }
  // /**
  //  * @description Returns serialized signed ethereum tx
  //  * @param rawTx
  //  * @returns {string}
  //  */
  signEthereumTx(rawTx) {
    throw Error("unimplemented");
  }
  // /**
  //  * @description Returns given order along with r, s, v
  //  * @param order
  //  */
  // signOrder(order) {
  //     throw Error('unimplemented');
  // }
  // /**
  //  * @description Calculates an Ethereum specific signature with: sign(keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))).
  //  * @param message string
  //  */
  // signMessage(message) {
  //     throw Error('unimplemented');
  // }
  sendTransaction(ethNode, signedTx) {
    return __awaiter(this, void 0, void 0, function*() {
      const response = yield ethNode.sendRawTransaction(signedTx);
      console.log("WalletAccount sendTransaction: ", response);
      return response;
    });
  }
}
exports.WalletAccount = WalletAccount;
class PrivateKeyAccount extends WalletAccount {
  /**
   * @property
   * @param privateKey string | Buffer
   */
  constructor(privateKey) {
    super();
    try {
      if (typeof privateKey === "string") {
        validator_1.default.validate({ value: privateKey, type: "ETH_KEY" });
        privateKey = formatter_1.toBuffer(formatter_1.addHexPrefix(privateKey));
      } else {
        validator_1.default.validate({
          value: privateKey,
          type: "PRIVATE_KEY_BUFFER"
        });
      }
    } catch (e) {
      throw new Error("Invalid private key");
    }
    this.privateKey = privateKey;
  }
  /**
   * @description Returns V3 type keystore of this account
   * @param password
   * @returns {{version, id, address, crypto}}
   */
  toV3Keystore(password) {
    return keystore_1.pkeyToKeystore(this.privateKey, password);
  }
  /**
   * Returns ethereum public key of this account
   * @returns {string}
   */
  getPublicKey() {
    return privateKeytoPublic(this.privateKey);
  }
  getAddress() {
    return privateKeytoAddress(this.privateKey);
  }
  sign(hash) {
    hash = formatter_1.toBuffer(hash);
    const signature = ethereumjs_util_1.ecsign(hash, this.privateKey);
    const v = formatter_1.toNumber(signature.v);
    const r = formatter_1.toHex(signature.r);
    const s = formatter_1.toHex(signature.s);
    return { r, s, v };
  }
  signMessage(message) {
    const hash = ethereumjs_util_1.sha3(message);
    const finalHash = ethereumjs_util_1.hashPersonalMessage(hash);
    return this.sign(finalHash);
  }
  signEthereumTx(rawTx) {
    validator_1.default.validate({ type: "TX", value: rawTx });
    const ethTx = new ethereumjs_tx_1.default(rawTx);
    ethTx.sign(this.privateKey);
    return formatter_1.toHex(ethTx.serialize());
  }
}
exports.PrivateKeyAccount = PrivateKeyAccount;
class MetaMaskAccount extends WalletAccount {
  constructor(web3, account, address) {
    super();
    this.web3 = web3;
    this.account = account;
    this.address = address;
  }
  getAddress() {
    return this.address;
  }
  sign(hash) {
    return __awaiter(this, void 0, void 0, function*() {
      const result = yield MetaMask.sign(this.web3, this.account, hash);
      if (!result["error"]) {
        return result["result"];
      } else {
        // SDK shouldn't throw any error
        throw new Error(result["error"]["message"]);
      }
    });
  }
  signMessage(message) {
    return __awaiter(this, void 0, void 0, function*() {
      const result = yield MetaMask.signMessage(
        this.web3,
        this.account,
        message
      );
      if (!result["error"]) {
        return result["result"];
      } else {
        // SDK shouldn't throw any error
        throw new Error(result["error"]["message"]);
      }
    });
  }
  signEthereumTx(rawTx) {
    return __awaiter(this, void 0, void 0, function*() {
      const result = yield MetaMask.signEthereumTx(
        this.web3,
        this.account,
        rawTx
      );
      if (!result["error"]) {
        return result["result"];
      } else {
        // SDK shouldn't throw any error
        throw new Error(result["error"]["message"]);
      }
    });
  }
}
exports.MetaMaskAccount = MetaMaskAccount;
//# sourceMappingURL=walletAccount.js.map
