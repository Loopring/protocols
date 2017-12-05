"use strict";

const signer = require('./signer.js');
const ethUtil = require('ethereumjs-util');
const _ = require('lodash');
const BigNumber = require('bignumber.js');
const ajv = require('ajv');

function Order(data)
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

    const orderSchema = {
        "title": "Order",
        "type": "object",
        "properties": {
            "protocol": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{40}$"
            },
            "owner": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{40}$"
            },
            "tokenS": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{40}$"
            },
            "tokenB": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{40}$"
            },
            "buyNoMoreThanAmountB": {
                "type": "boolean"
            },
            "marginSplitPercentage": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100
            },
            "r": {
                "type": "integer",
                "minimum": 0
            },
            "s": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{64}$"
            },
            "v": {
                "type": "string",
                "pattern": "^0x[0-9a-fA-F]{64}$"
            }
        },
        "required": ["protocol", "owner", "tokenS", "tokenB", "buyNoMoreThanAmountB", "marginSplitPercentage"]
    };

    const orderTypes = ['address', 'address', 'address', 'address', 'uint', 'uint', 'uint', 'uint', 'uint', 'uint', 'bool', 'uint8'];

    this.sign = function (privateKey)
    {
        const validation = ajv.validate(orderSchema, data);

        if (!validation)
        {
            throw new Error('Invalid Loopring Order');
        }

        const hash = signer.solSHA3(orderTypes, [protocol, owner, tokenS, tokenB,
            new BigNumber(Number(amountS).toString(10), 10),
            new BigNumber(Number(amountB).toString(10), 10),
            new BigNumber(Number(timestamp).toString(10), 10),
            new BigNumber(Number(ttl).toString(10), 10),
            new BigNumber(Number(salt).toString(10), 10),
            new BigNumber(Number(lrcFee).toString(10), 10),
            buyNoMoreThanAmountB,
            marginSplitPercentage]);

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

    this.cancel = function (amount, privateKey)
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
