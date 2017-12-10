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

const signer = require('./signer.js');
const ethUtil = require('ethereumjs-util');
const BN = require('bn.js');
const BigNumber = require('bignumber.js');
const Ajv = require('ajv');
const _ = require('lodash');

function Order (data)
{
    const protocol = data.protocol;
    const owner = data.owner;
    const tokenS = data.tokenS;
    const tokenB = data.tokenB;
    const amountS = data.amountS;
    const amountB = data.amountB;
    const timestamp = data.timestamp;
    const ttl = data.ttl;
    const salt = data.salt;
    const lrcFee = data.lrcFee;
    const buyNoMoreThanAmountB = data.buyNoMoreThanAmountB;
    const marginSplitPercentage = data.marginSplitPercentage;

    let v = data.v;
    let r = data.r;
    let s = data.s;

    const ajv = new Ajv();

    const orderSchema = {
        'title': 'Order',
        'type': 'object',
        'properties': {
            'protocol': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{40}$'
            },
            'owner': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{40}$'
            },
            'tokenS': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{40}$'
            },
            'tokenB': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{40}$'
            },
            'buyNoMoreThanAmountB': {
                'type': 'boolean'
            },
            'marginSplitPercentage': {
                'type': 'integer',
                'minimum': 0,
                'maximum': 100
            },
            'r': {
                'type': 'integer',
                'minimum': 0
            },
            's': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{64}$'
            },
            'v': {
                'type': 'string',
                'pattern': '^0x[0-9a-fA-F]{64}$'
            }
        },
        'required': [
            'protocol',
            'owner',
            'tokenS',
            'tokenB',
            'buyNoMoreThanAmountB',
            'marginSplitPercentage'
        ]
    };

    const orderTypes = [
        'address',
        'address',
        'address',
        'address',
        'uint',
        'uint',
        'uint',
        'uint',
        'uint',
        'uint',
        'bool',
        'uint8'
    ];

    this.sign = (privateKey) =>
    {
        const validation = ajv.validate(orderSchema, data);

        if (!validation)
        {
            throw new Error('Invalid Loopring Order');
        }

        const hash = signer.solSHA3(orderTypes, [protocol, owner, tokenS, tokenB,
            new BN(new BigNumber(amountS).toString(10), 10),
            new BN(new BigNumber(amountB).toString(10), 10),
            new BN(new BigNumber(timestamp).toString(10), 10),
            new BN(new BigNumber(ttl).toString(10), 10),
            new BN(new BigNumber(salt).toString(10), 10),
            new BN(new BigNumber(lrcFee).toString(10), 10),
            buyNoMoreThanAmountB,
            marginSplitPercentage
        ]);

        const finalHash = ethUtil.hashPersonalMessage(hash);

        if (_.isString(privateKey))
        {
            privateKey = ethUtil.toBuffer(privateKey);
        }

        const signature = ethUtil.ecsign(finalHash, privateKey);

        v = Number(signature.v.toString());
        r = '0x' + signature.r.toString('hex');
        s = '0x' + signature.s.toString('hex');

        return {
            protocol,
            owner,
            tokenS,
            tokenB,
            amountS,
            amountB,
            timestamp,
            ttl,
            salt,
            lrcFee,
            buyNoMoreThanAmountB,
            marginSplitPercentage,
            v,
            r,
            s
        };
    };

    this.cancel = (amount, privateKey) =>
    {
        if (!r || !v || !s)
        {
            this.sign(privateKey);
        }

        const order = {
            addresses: [owner, tokenS, tokenB],
            orderValues: [amountS, amountB, timestamp, ttl, salt, lrcFee, amount],
            buyNoMoreThanAmountB,
            marginSplitPercentage,
            v,
            r,
            s
        };

        return signer.generateCancelOrderData(order);
    };
}

module.exports = Order;
