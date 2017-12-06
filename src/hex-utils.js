"use strict";

const BigNumber = require('bignumber.js');

exports.stripHex = (address) =>
{
    return address.replace('0x', '').toLowerCase();
};

exports.valueToHex = (value) =>
{
    const big = new BigNumber(value);
    return '0x' + big.toString(16);
};
