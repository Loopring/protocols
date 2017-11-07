const abi = require('ethereumjs-abi');
const _ = require('lodash');
const Joi = require('joi');
const Transaction = require('ethereumjs-tx');
const ethUtil = require('ethereumjs-util');

const txSchema = Joi.object().keys({
    nonce: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
    gasPrice: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
    gasLimit: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
    to: Joi.string().regex(/^0x[0-9a-fA-F]{40}$/i),
    value: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
    data: Joi.string().regex(/^0x[0-9a-fA-F]*$/i),
    chainId: Joi.number().integer().min(1)
}).with('nonce', 'gasPrice', 'gasLimit', 'to', 'value', 'data', 'chainId');

exports.solSHA3 = function (types, data) {
    const hash = abi.soliditySHA3(types, data);
    return hash;
};

exports.signEthTx = function (tx, privateKey) {

    const result = Joi.validate(tx, txSchema);
    if (result.error) {
        return new Error(JSON.stringify(result.error.details));
    }

    const ethTx = new Transaction(tx);
    if (_.isString(privateKey)) {
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