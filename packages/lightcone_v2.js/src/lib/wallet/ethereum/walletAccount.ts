// @ts-ignore
/* ts-disable */
import validator from "./validator";
import {
  addHexPrefix,
  formatAddress,
  formatKey,
  toBuffer,
  toHex,
  toNumber
} from "../common/formatter";
import { decryptKeystoreToPkey, pkeyToKeystore } from "./keystore";
import {
  ecsign,
  hashPersonalMessage,
  privateToAddress,
  privateToPublic,
  publicToAddress,
  sha3
} from "ethereumjs-util";
import { mnemonictoPrivatekey } from "./mnemonic";
import { generateMnemonic } from "bip39";
import { trimAll } from "../common/utils";
import HDKey from "hdkey";
import EthTransaction from "ethereumjs-tx";
import * as MetaMask from "./metaMask";
import Wallet from "ethereumjs-wallet";

import wallets from "../config/wallets.json";
const LoopringWallet = wallets.find(
  wallet => trimAll(wallet.name).toLowerCase() === "loopringwallet"
);
export const path = LoopringWallet.dpath;

export function createWallet() {
  return Wallet.generate();
}

/**
 * @description Returns the ethereum address  of a given private key
 * @param privateKey
 * @returns {string}
 */
export function privateKeytoAddress(privateKey) {
  try {
    if (typeof privateKey === "string") {
      validator.validate({ value: privateKey, type: "ETH_KEY" });
      privateKey = toBuffer(addHexPrefix(privateKey));
    } else {
      validator.validate({ value: privateKey, type: "PRIVATE_KEY_BUFFER" });
    }
  } catch (e) {
    throw new Error("Invalid private key");
  }
  return formatAddress(privateToAddress(privateKey));
}

/**
 * @description Returns the ethereum address of a given public key.
 * Accepts "Ethereum public keys" and SEC1 encoded keys.
 * @param publicKey Buffer | string
 * @param sanitize bool [sanitize=false] Accept public keys in other formats
 * @returns {string}
 */
export function publicKeytoAddress(publicKey, sanitize) {
  publicKey = toBuffer(publicKey);
  return formatAddress(publicToAddress(publicKey, sanitize));
}

/**
 *
 * @param publicKey
 * @param chainCode
 * @param pageSize
 * @param pageNum
 * @returns {<Array>}
 */
export function getAddresses({ publicKey, chainCode, pageSize, pageNum }) {
  const addresses = [];
  const hdk = new HDKey();
  hdk.publicKey =
    publicKey instanceof Buffer ? publicKey : toBuffer(addHexPrefix(publicKey));
  hdk.chainCode =
    chainCode instanceof Buffer ? chainCode : toBuffer(addHexPrefix(chainCode));
  for (let i = 0; i < pageSize; i++) {
    const dkey = hdk.derive(`m/${i + pageSize * pageNum}`);
    addresses.push(publicKeytoAddress(dkey.publicKey, true));
  }
  return addresses;
}

/**
 * @description Returns the ethereum public key of a given private key.
 * @param privateKey Buffer | string
 * @returns {string}
 */
export function privateKeytoPublic(privateKey) {
  try {
    if (typeof privateKey === "string") {
      validator.validate({ value: privateKey, type: "ETH_KEY" });
      privateKey = toBuffer(addHexPrefix(privateKey));
    } else {
      validator.validate({ value: privateKey, type: "PRIVATE_KEY_BUFFER" });
    }
  } catch (e) {
    throw new Error("Invalid private key");
  }
  return formatKey(privateToPublic(privateKey));
}

/**
 * @description Returns WalletAccount of given mnemonic, dpath and password
 * @param mnemonic string
 * @param dpath string
 * @param password string
 * @returns {WalletAccount}
 */
export function fromMnemonic(mnemonic, dpath, password) {
  const privateKey = mnemonictoPrivatekey(mnemonic, dpath, password);
  return fromPrivateKey(privateKey);
}

/**
 * @description Returns WalletAccount of a given private key
 * @param privateKey string | buffer
 * @returns {WalletAccount}
 */
export function fromPrivateKey(privateKey) {
  return new PrivateKeyAccount(privateKey);
}

/**
 * @description Returns WalletAccount of the given keystore
 * @param keystore string
 * @param password string
 * @returns {WalletAccount}
 */
export function fromKeystore(keystore, password) {
  const privateKey = decryptKeystoreToPkey(keystore, password);
  return fromPrivateKey(privateKey);
}

export function fromMetaMask(web3, account, address) {
  return new MetaMaskAccount(web3, account, address);
}

/**
 * @description generate mnemonic
 * @param strength
 * @returns {*}
 */
export function createMnemonic(strength) {
  return generateMnemonic(strength || 256);
}

// Hack: Failed to import in react web app
export class WalletAccount {
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

  async sendTransaction(ethNode, signedTx) {
    const response = await ethNode.sendRawTransaction(signedTx);
    console.log("WalletAccount sendTransaction: ", response);
    return response;
  }
}

export class PrivateKeyAccount extends WalletAccount {
  privateKey: any;

  /**
   * @property
   * @param privateKey string | Buffer
   */
  constructor(privateKey) {
    super();
    try {
      if (typeof privateKey === "string") {
        validator.validate({ value: privateKey, type: "ETH_KEY" });
        privateKey = toBuffer(addHexPrefix(privateKey));
      } else {
        validator.validate({ value: privateKey, type: "PRIVATE_KEY_BUFFER" });
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
    return pkeyToKeystore(this.privateKey, password);
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
    hash = toBuffer(hash);
    const signature = ecsign(hash, this.privateKey);
    const v = toNumber(signature.v);
    const r = toHex(signature.r);
    const s = toHex(signature.s);
    return { r, s, v };
  }

  signMessage(message) {
    const hash = sha3(message);
    const finalHash = hashPersonalMessage(hash);
    return this.sign(finalHash);
  }

  signEthereumTx(rawTx) {
    validator.validate({ type: "TX", value: rawTx });
    const ethTx = new EthTransaction(rawTx);
    ethTx.sign(this.privateKey);
    return toHex(ethTx.serialize());
  }
}

export class MetaMaskAccount extends WalletAccount {
  web3: any;
  account: any;
  address: string;

  constructor(web3, account, address) {
    super();
    this.web3 = web3;
    this.account = account;
    this.address = address;
  }

  getAddress() {
    return this.address;
  }

  async sign(hash) {
    const result = await MetaMask.sign(this.web3, this.account, hash);
    if (!result["error"]) {
      return result["result"];
    } else {
      // SDK shouldn't throw any error
      throw new Error(result["error"]["message"]);
    }
  }

  async signMessage(message) {
    const result = await MetaMask.signMessage(this.web3, this.account, message);
    if (!result["error"]) {
      return result["result"];
    } else {
      // SDK shouldn't throw any error
      throw new Error(result["error"]["message"]);
    }
  }

  async signEthereumTx(rawTx) {
    const result = await MetaMask.signEthereumTx(
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
  }
}
