"use strict";

const abi = require('ethereumjs-abi');
const _ = require('lodash');
const ajv = require('ajv');
const Transaction = require('ethereumjs-tx');
const ethUtil = require('ethereumjs-util');
const Validator = require('./validator');
const BigNumber = require('bignumber.js');

const transactionSchema = {
    "title": "Transaction",
    "type": "object",
    "properties": {
        "nonce": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{1,64}$"
        },
        "gasPrice": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{1,64}$"
        },
        "gasLimit": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{1,64}$"
        },
        "to": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{1,64}$"
        },
        "value": {
            "type": "string",
            "pattern": "^0x[0-9a-fA-F]{1,64}$"
        },
        "data": {
            "type": "string",
            "pattern": "^0x([0-9a-fA-F]{8})*([0-9a-fA-F]{64})*$"
        },
        "chainId": {
            "type": "integer",
            "minimum": 1
        }
    },
    "required": ["gasPrice", "gasLimit", "to", "value", "data"]
};

const validator = new Validator();

exports.solSHA3 = function (types, data) {
    const hash = abi.soliditySHA3(types, data);
    return hash;
};

exports.signEthTx = (tx, privateKey) =>
{

    const result = ajv.validate(transactionSchema, tx);
    if (result.error)
    {
        return new Error(JSON.stringify(result.error.details));
    }

    const ethTx = new Transaction(tx);
    if (_.isString(privateKey))
    {
        privateKey = ethUtil.toBuffer(privateKey);
    }
    ethTx.sign(privateKey);
    return '0x' + ethTx.serialize().toString('hex');
};

exports.generateCancelOrderData = function (order) {

    const data = abi.rawEncode(['address[3]', 'uint[7]', 'bool', 'uint8', 'uint8', 'bytes32', 'bytes32'], [order.addresses, order.orderValues, order.buyNoMoreThanAmountB, order.marginSplitPercentage, order.v, order.r, order.s]).toString('hex');
    const method = abi.methodID('cancelOrder', ['address[3]', 'uint[7]', 'bool', 'uint8', 'uint8', 'bytes32', 'bytes32']).toString('hex');

    return '0x' + method + data;
};


exports.generateCutOffData = function (timestamp) {

    const method = abi.methodID('setCutoff', ['uint']).toString('hex');
    const data = abi.rawEncode(['uint'], [timestamp]).toString('hex');
    return '0x' + method + data;
};


exports.generateApproveData = function (address, amount) {

    const method = abi.methodID('approve',['address','uint']).toString('hex');
    const data = abi.rawEncode(['address','uint'],[address,amount]).toString('hex');
    return '0x' + method + data;
};

exports.generateWithdrawData = function (amount) {

    const method = abi.methodID('withdraw',['uint']).toString('hex');
    const data = abi.rawEncode(['uint'],[amount]).toString('hex');
    return '0x' + method + data;
};

exports.generateTransferData = function (address,amount) {

    const method = abi.methodID('transfer',['address','uint']).toString('hex');
    const data = abi.rawEncode(['address','uint'],[address, amount]).toString('hex');
    return '0x' + method + data;

};

exports.generateBalanceOfData = function (address) {
    const method = abi.methodID('balanceOf',['address']).toString('hex');
    const data = abi.rawEncode(['address'],[address]).toString('hex');
    return '0x' + method + data;
};

exports.generateAllowanceData = function (owner, spender) {

    const method = abi.methodID('allowance',['address','address']).toString('hex');
    const data = abi.rawEncode(['address','address'],[owner,spender]).toString('hex');
    return '0x' + method + data;
};
