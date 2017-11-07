const crypto = require('crypto');
const ethereumUtil = require('ethereumjs-util');
const keystore = require('./keystore.js');

function privateKey() {
    var privateKey;
    var publicKey;
    var address;

    this.generate = function () {
        privateKey = crypto.randomBytes(32);
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.setPrivateKey = function (key) {
        privateKey = key;
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.getAddress = function () {
        return ethereumUtil.toChecksumAddress("0x" + address.toString('hex'));
    };


    this.toKeystore = function (password) {
        return keystore.pkeyToKeystore(privateKey, this.getAddress(), password)
    }

}

module.exports = privateKey;