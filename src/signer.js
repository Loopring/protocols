/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

const abi = require('ethereumjs-abi');
const _ = require('lodash');
const Ajv = require('ajv');
const Transaction = require('ethereumjs-tx');
const ethUtil = require('ethereumjs-util');

const transactionSchema = {
    'title': 'Transaction',
    'type': 'object',
    'properties': {
        'nonce': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{1,64}$'
        },
        'gasPrice': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{1,64}$'
        },
        'gasLimit': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{1,64}$'
        },
        'to': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{1,64}$'
        },
        'value': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{1,64}$'
        },
        'data': {
            'type': 'string',
            'pattern': '^0x[0-9a-fA-F]{8}([0-9a-fA-F]{64})*$ |^0x$'
        },
        'chainId': {
            'type': 'integer',
            'minimum': 1
        }
    },
    'required': ['gasPrice', 'gasLimit', 'to', 'value', 'data']
};

const ajv = new Ajv();
exports.solSHA3 = (types, data) =>
{
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

exports.generateCancelOrderData = (order) =>
{
    const data = abi.rawEncode([
        'address[3]',
        'uint[7]',
        'bool',
        'uint8',
        'uint8',
        'bytes32',
        'bytes32'
    ], [
        order.addresses,
        order.orderValues,
        order.buyNoMoreThanAmountB,
        order.marginSplitPercentage,
        order.v, order.r, order.s
    ]).toString('hex');

    const method = abi.methodID(
        'cancelOrder', [
            'address[3]',
            'uint[7]',
            'bool',
            'uint8',
            'uint8',
            'bytes32',
            'bytes32'
        ]).toString('hex');

    return '0x' + method + data;
};

exports.generateCutOffData = (timestamp) =>
{
    const method = abi.methodID('setCutoff', ['uint']).toString('hex');
    const data = abi.rawEncode(['uint'], [timestamp]).toString('hex');
    return '0x' + method + data;
};

exports.generateApproveData = (address, amount) =>
{
    const method = abi.methodID('approve', ['address', 'uint']).toString('hex');
    const data = abi.rawEncode(['address', 'uint'], [address, amount]).toString('hex');
    return '0x' + method + data;
};

exports.generateWithdrawData = (amount) =>
{
    const method = abi.methodID('withdraw', ['uint']).toString('hex');
    const data = abi.rawEncode(['uint'], [amount]).toString('hex');
    return '0x' + method + data;
};

exports.generateTransferData = (address, amount) =>
{
    const method = abi.methodID('transfer', ['address', 'uint']).toString('hex');
    const data = abi.rawEncode(['address', 'uint'], [address, amount]).toString('hex');
    return '0x' + method + data;
};

exports.generateBalanceOfData = (address) =>
{
    const method = abi.methodID('balanceOf', ['address']).toString('hex');
    const data = abi.rawEncode(['address'], [address]).toString('hex');
    return '0x' + method + data;
};

exports.generateAllowanceData = (owner, spender) =>
{
    const method = abi.methodID('allowance', ['address', 'address']).toString('hex');
    const data = abi.rawEncode(['address', 'address'], [owner, spender]).toString('hex');
    return '0x' + method + data;
};
