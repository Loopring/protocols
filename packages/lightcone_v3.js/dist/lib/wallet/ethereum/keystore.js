"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethereumjs_wallet_1 = require("ethereumjs-wallet");
const formatter_1 = require("../common/formatter");
/**
 * Returns private key of given keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
function decryptKeystoreToPkey(keystore, password) {
  let wallet;
  const parsed = JSON.parse(keystore);
  switch (determineKeystoreType(keystore)) {
    case "presale":
      wallet = decryptPresaleToPrivKey(keystore, password);
      break;
    case "v1-unencrypted":
      wallet = Buffer.from(parsed.private, "hex");
      break;
    case "v1-encrypted":
      wallet = decryptMewV1ToPrivKey(keystore, password);
      break;
    case "v2-unencrypted":
      wallet = Buffer.from(parsed.privKey, "hex");
      break;
    case "v2-v3-utc":
      wallet = decryptUtcKeystoreToPkey(keystore, password);
      break;
    default:
      throw new Error("unrecognized type of keystore");
  }
  return wallet;
}
exports.decryptKeystoreToPkey = decryptKeystoreToPkey;
/**
 * Returns keystore of a given ethereum private key with password
 * @param privateKey
 * @param password
 * @returns {{version, id, address, crypto}}  keystore
 */
function pkeyToKeystore(privateKey, password) {
  return ethereumjs_wallet_1
    .fromPrivateKey(privateKey)
    .toV3(password, { c: 1024, n: 1024 });
}
exports.pkeyToKeystore = pkeyToKeystore;
/**
 * Returns ethereum private key of given v3 keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
function decryptUtcKeystoreToPkey(keystore, password) {
  return ethereumjs_wallet_1.fromV3(keystore, password, true).getPrivateKey();
}
exports.decryptUtcKeystoreToPkey = decryptUtcKeystoreToPkey;
/**
 * Returns type of a given keystore
 * @param keystore string
 * @returns {string}
 */
function determineKeystoreType(keystore) {
  const parsed = JSON.parse(keystore);
  if (parsed.encseed) {
    return "presale";
  } else if (parsed.Crypto || parsed.crypto) {
    return "v2-v3-utc";
  } else if (parsed.hash && parsed.locked === true) {
    return "v1-encrypted";
  } else if (parsed.hash && parsed.locked === false) {
    return "v1-unencrypted";
  } else if (parsed.publisher === "MyEtherWallet") {
    return "v2-unencrypted";
  } else {
    throw new Error("Invalid keystore");
  }
}
exports.determineKeystoreType = determineKeystoreType;
/**
 * Returns ethereum  private key of given presale keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
function decryptPresaleToPrivKey(keystore, password) {
  return ethereumjs_wallet_1.fromEthSale(keystore, password).getPrivateKey();
}
exports.decryptPresaleToPrivKey = decryptPresaleToPrivKey;
/**
 * Returns ethereum  private key of given v1 keystore
 * @param keystore string
 * @param password string
 * @returns {Buffer}
 */
function decryptMewV1ToPrivKey(keystore, password) {
  return ethereumjs_wallet_1.fromV1(keystore, password).getPrivateKey();
}
exports.decryptMewV1ToPrivKey = decryptMewV1ToPrivKey;
/**
 * Checks whether a password is required to decrypt the given keystore
 * @param keystore string
 * @returns {boolean}
 */
function isKeystorePassRequired(keystore) {
  switch (determineKeystoreType(keystore)) {
    case "presale":
      return true;
    case "v1-unencrypted":
      return false;
    case "v1-encrypted":
      return true;
    case "v2-unencrypted":
      return false;
    case "v2-v3-utc":
      return true;
    default:
      return false;
  }
}
exports.isKeystorePassRequired = isKeystorePassRequired;
/**
 * Returns V3 format fileName
 * @param address
 * @returns {string}
 */
function getFileName(address) {
  const ts = new Date();
  return [
    "UTC--",
    ts.toJSON().replace(/:/g, "-"),
    "--",
    formatter_1.clearHexPrefix(address),
    ".json"
  ].join("");
}
exports.getFileName = getFileName;
//# sourceMappingURL=keystore.js.map
