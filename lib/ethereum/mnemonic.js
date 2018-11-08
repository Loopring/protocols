'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.mnemonictoPrivatekey = mnemonictoPrivatekey;
exports.isValidateMnemonic = isValidateMnemonic;

var _bip = require('bip39');

var _hdkey = require('hdkey');

/**
 * Decrypt mnemonic into ethereum private key
 * @param mnemonic string
 * @param password string
 * @param dpath string
 */
function mnemonictoPrivatekey(mnemonic, dpath, password) {
    if (dpath) {
        mnemonic = mnemonic.trim();
        if (!(0, _bip.validateMnemonic)(mnemonic)) {
            throw new Error('Invalid mnemonic');
        }
        var seed = (0, _bip.mnemonicToSeed)(mnemonic, password);
        var derived = (0, _hdkey.fromMasterSeed)(seed).derive(dpath);
        return derived.privateKey;
    } else {
        throw new Error('dpath can\'t be null');
    }
}

/**
 * Valid mnemonic
 * @param phrase string
 * @returns {bool}
 */
function isValidateMnemonic(phrase) {
    return (0, _bip.validateMnemonic)(phrase);
}