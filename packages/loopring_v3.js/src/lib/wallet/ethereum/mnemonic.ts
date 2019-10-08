import { mnemonicToSeed, validateMnemonic } from "bip39";
import { fromMasterSeed } from "hdkey";

/**
 * Decrypt mnemonic into ethereum private key
 * @param mnemonic string
 * @param password string
 * @param dpath string
 */
export function mnemonictoPrivatekey(mnemonic, dpath, password) {
  if (dpath) {
    mnemonic = mnemonic.trim();
    if (!validateMnemonic(mnemonic)) {
      throw new Error("Invalid mnemonic");
    }
    const seed = mnemonicToSeed(mnemonic, password);
    const derived = fromMasterSeed(seed).derive(dpath);
    return derived.privateKey;
  } else {
    throw new Error("dpath can't be null");
  }
}

/**
 * Valid mnemonic
 * @param phrase string
 * @returns {bool}
 */
export function isValidateMnemonic(phrase) {
  return validateMnemonic(phrase);
}
