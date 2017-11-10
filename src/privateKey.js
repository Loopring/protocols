"use strict";

const crypto = require('crypto');
const ethereumUtil = require('ethereumjs-util');
const keystore = require('./keystore.js');

function privateKey()
{
    let privateKey,
        publicKey,
        address;

    this.generate = () =>
    {
        privateKey = crypto.randomBytes(32);
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.setPrivateKey = (key) =>
    {
        privateKey = key;
        publicKey = ethereumUtil.privateToPublic(privateKey);
        address = ethereumUtil.publicToAddress(publicKey);
    };

    this.getAddress = () =>
    {
        return ethereumUtil.toChecksumAddress("0x" + address.toString('hex'));
    };


    this.toKeystore = (password) =>
    {
        return keystore.pkeyToKeystore(privateKey, this.getAddress(), password);
    };
}

module.exports = privateKey;
