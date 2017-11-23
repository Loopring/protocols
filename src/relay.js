const fetch = require('node-fetch');
const crypto = require('crypto');
const Validator = require('./validator.js');
const Wallet = require('./wallet.js');
const ethUtil = require('ethereumjs-util');
const signer = require('./signer.js');
const Joi = require('joi');
const BigNumber = require('bignumber.js');
const _ = require('lodash');

function relay(host) {
    const txSchema = Joi.object().keys({
        nonce: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
        gasPrice: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
        gasLimit: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
        to: Joi.string().regex(/^0x[0-9a-fA-F]{40}$/i),
        value: Joi.string().regex(/^0x[0-9a-fA-F]{1,64}$/i),
        data: Joi.string().regex(/^0x([0-9a-fA-F]{8})*([0-9a-fA-F]{64})*$/i),
        chainId: Joi.number().integer().min(1)
    }).with('gasPrice', 'gasLimit', 'to', 'value', 'data').without('nonce', 'chainId');

    const request = {"jsonrpc": "2.0"};

    const validataor = new Validator();

    this.getTransactionCount = async function (add, tag) {

        if (!validataor.isValidETHAddress(add)) {
            throw new Error('invalid ETH address');
        }

        if (!tag) {
            tag = 'latest';
        }
        if (tag !== 'latest' && tag !== 'earliest' && tag !== 'pending') {
            throw new Error('invalid  tag:' + tag);
        }

        const params = [add, tag];
        request.id = id();
        request.method = "eth_getTransactionCount";
        request.params = params;

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(res => res.json()).then(res => {
            if (res.error) {
                throw new Error(res.error.message);
            }
            return res.result;
        });
    };

    this.getAccountBalance = async function (add, tag) {
        if (!validataor.isValidETHAddress(add)) {
            throw new Error('invalid ETH address');
        }

        if (!tag) {
            tag = 'latest';
        }
        if (tag !== 'latest' && tag !== 'earliest' && tag !== 'pending') {
            throw new Error('invalid  tag:' + tag);
        }

        const params = [add, tag];
        request.id = id();
        request.method = "eth_getBalance";
        request.params = params;

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(res => res.json()).then(res => {
            if (res.error) {
                throw new Error(res.error.message);
            }
            return new BigNumber(Number(validHex(res.result)));
        });
    };

    this.call = async function (data, tag) {

        if (!tag) {
            tag = 'latest';
        }
        if (tag !== 'latest' && tag !== 'earliest' && tag !== 'pending') {
            throw new Error('invalid  tag:' + tag);
        }

        request.method = 'eth_call';
        request.params = [data, tag];
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(res => res.json()).then(res => {
            if (res.error) {
                throw new Error(res.error.message);
            }
            return validHex(res.result);
        });

    };

    this.generateTx = async function (rawTx, privateKey) {

        const wallet = new Wallet();
        wallet.setPrivateKey(ethUtil.toBuffer(privateKey));

        const valid_result = Joi.validate(rawTx, txSchema);

        if (valid_result.error) {
            throw new Error('invalid Tx data ');
        }

        const gasLimit = new BigNumber(Number(rawTx.gasLimit));

        if (gasLimit.lessThan(21000)) {

            throw  new Error('gasLimit must be greater than 21000');
        }

        if (gasLimit.greaterThan(5000000)) {
            throw  new Error('gasLimit is too big');
        }

        // const balance = await this.getAccountBalance(wallet.getAddress());
        //
        // const needBalance = new BigNumber(Number(rawTx.value)) + gasLimit * new BigNumber(Number(rawTx.gasPrice));
        //
        // if (balance.lessThan(needBalance)) {
        //
        //     throw new Error('Balance  is not enough')
        // }

        const nonce = await this.getTransactionCount(wallet.getAddress());

        rawTx.nonce = rawTx.nonce || nonce;
        rawTx.chainId = rawTx.chainId || 1;

        const signed = signer.signEthTx(rawTx, privateKey);
        return {
            tx: rawTx,
            signedTx: signed
        }

    };

    this.sendSignedTx = async function (tx) {

        request.id = id();
        request.method = "eth_sendRawTransaction";
        request.params = [tx];

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(res => res.json()).then(res => {
            if (res.error) {
                throw new Error(res.error.message);
            }
            return res.result;
        });

    };

    this.getTokenBalance = async function (token, add, tag) {

        if (!validataor.isValidETHAddress(add)) {
            throw new Error('invalid ETH address' + add);
        }

        if (!validataor.isValidETHAddress(token)) {

            throw new Error('invalid token contract Address ' + token);
        }
        const data = signer.generateBalanceOfData(add);

        const params = {
            to: token,
            data
        };

        if (!tag) {
            tag = 'latest';
        }

        if (tag !== 'latest' && tag !== 'earliest' && tag !== 'pending') {
            throw new Error('invalid  tag:' + tag);
        }
        return new BigNumber(Number(await this.call(params, tag)));

    };

    this.getTokenAllowance = async function (token, owner, spender, tag) {

        if (!validataor.isValidETHAddress(owner)) {
            throw new Error('invalid owner address');
        }

        if (!validataor.isValidETHAddress(spender)) {
            throw new Error('invalid spender address');
        }

        if (!validataor.isValidETHAddress(token)) {

            throw new Error('invalid token Contract Address');
        }

        const data = signer.generateAllowanceData(owner,spender);
        const params = {
            to: token,
            data
        };

        if (!tag) {
            tag = 'latest';
        }

        if (tag !== 'latest' && tag !== 'earliest' && tag !== 'pending') {
            throw new Error('invalid  tag:' + tag);
        }

        return new BigNumber(Number(await this.call(params, tag)));

    };

    this.submitLoopringOrder = async function (order) {

        request.method = 'submitOrder';
        request.params = order;
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });

    };

    this.cancelLoopringOrder = async function (rawTX, privateKey) {
        const tx = await this.generateTx(rawTX, privateKey);
        return await this.sendSignedTx(tx.signedTx);
    };

    this.getOrders = async function (market, address, status, pageIndex, pageSize, contractVersion) {

        request.method = 'getOrders';
        request.params = {market, address, status,contractVersion, pageIndex, pageSize};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });

    };

    this.getDepth = async function (market, pageIndex, pageSize, contractVersion) {
        request.method = 'getDepth';
        request.params = {market, pageIndex, pageSize,contractVersion};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });
    };

    this.getTicker = async function (market) {

        request.method = 'getTicker';
        request.params = {market};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });
    };

    this.getFills = async function (market, address, pageIndex, pageSize,contractVersion) {

        request.method = 'getFills';
        request.params = {market, address, pageIndex, pageSize,contractVersion};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });

    };

    this.getCandleTicks = async function (market, interval, size) {

        request.method = 'getCandleTicks';
        request.params = {market, interval, size};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });

    };

    this.getRingMined = async function (ringHash, orderHash, miner, pageIndex, pageSize,contractVersion) {

        request.method = 'getRingMined';
        request.params = {ringHash, orderHash, miner, pageIndex, pageSize,contractVersion};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });

    };

    this.getBalances = async function (address) {

        request.method = 'getBalances';
        request.params = {address};
        request.id = id();

        return await fetch(host, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        }).then(r => r.json()).then(res => {
            return res;
        });
    };

    function id() {
        return crypto.randomBytes(16).toString('hex');
    }

    function validHex(data) {

        if (data === '0x') {
            data = '0x0';
        }

        return data;
    }
}

module.exports = relay;