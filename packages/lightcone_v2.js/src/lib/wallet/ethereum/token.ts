import {generateAbiData} from './abi';
import validator from './validator';
import Transaction from './transaction';
import request from '../common/request';
import {rawDecode} from 'ethereumjs-abi'
import {toBuffer} from "../common/formatter";

export default class Token {

    constructor(input) {
        validator.validate({value: input, type: 'BASIC_TOKEN'});
        this.address = input.address;
        this.symbol = input.symbol || "";
        this.name = input.name || "";
        this.digits = input.digits;
        this.unit = input.unit || "";
        if (input.website) {
            this.website = input.website
        }
        this.allowance = input.allowance || 10000;
        this.precision = input.precision || 6;
        this.minTradeValue = input.minTradeValue || 0.0001
    }

    generateTransferTx({to, amount, gasPrice, gasLimit, nonce, chainId}) {
        validator.validate({value: amount, type: "ETH_DATA"});
        const tx = {};
        tx.to = this.address;
        tx.value = "0x0";
        tx.data = generateAbiData({method: "transfer", address: to, amount});

        if (gasPrice) {
            tx.gasPrice = gasPrice
        }
        if (gasLimit) {
            tx.gasLimit = gasLimit
        }
        if (nonce) {
            tx.nonce = nonce
        }
        if (chainId) {
            tx.chainId = chainId
        }
        return tx;
    }

    generateApproveTx({spender, amount, gasPrice, gasLimit, nonce, chainId}) {
        validator.validate({value: amount, type: "ETH_DATA"});
        const tx = {};
        tx.to = this.address;
        tx.value = "0x0";
        tx.data = generateAbiData({method: "approve", address: spender, amount});
        if (gasPrice) {
            tx.gasPrice = gasPrice
        }
        if (gasLimit) {
            tx.gasLimit = gasLimit
        }
        if (nonce) {
            tx.nonce = nonce
        }
        if (chainId) {
            tx.chainId = chainId
        }
        return tx;
    }

    async transfer({privateKey, to, amount, gasPrice, gasLimit, nonce, chainId, walletType, path}) { // 王忱
        const tx = this.generateTransferTx({to, amount, gasPrice, gasLimit, nonce, chainId});
        const transaction = new Transaction(tx);
        return transaction.send({privateKey, walletType, path})
    }

    async approve({spender, amount, privateKey, gasPrice, gasLimit, nonce, chainId, walletType, path}) {
        const tx = this.generateApproveTx({spender, amount, gasPrice, gasLimit, nonce, chainId});
        const transaction = new Transaction(tx);
        return transaction.send({privateKey, walletType, path})
    }

    async balanceOf(owner, tag) {
        validator.validate({value: owner, type: "ADDRESS"});
        const tx = {to: this.address};
        tx.data = generateAbiData({method: "balanceOf", address: owner});
        tag = tag || "pending";
        if (tag) {
            try {
                validator.validate({value: tag, type: "RPC_TAG"})
            } catch (e) {
                throw new Error('Invalid tag, must be one of latest, pending,earliest')
            }
        }
        const params = [tx, tag];
        const body = {};
        body.method = 'eth_call';
        body.params = params;
        return request({
            method: 'post',
            body,
        })
    }

    async getAllowance(owner, spender, tag) {
        validator.validate({value: owner, type: "ADDRESS"});
        validator.validate({value: spender, type: "ADDRESS"});
        const tx = {};
        tx.to = this.address;
        tx.data = generateAbiData({method: "allowance", owner, spender});
        tag = tag || "pending";
        if (tag) {
            try {
                validator.validate({value: tag, type: "RPC_TAG"})
            } catch (e) {
                throw new Error('Invalid tag, must be one of latest, pending,earliest')
            }
        }
        const params = [tx, tag];
        const body = {};
        body.method = 'eth_call';
        body.params = params;
        return request({
            method: 'post',
            body,
        })
    }

    async getName() {
        const response = await this.getConfig('name');
        const results = rawDecode(['string'], toBuffer(response.result));
        return results.length > 0 ? results[0] : '';
    }

    async getSymbol() {
        const response = await this.getConfig('symbol');
        const results = rawDecode(['string'], toBuffer(response.result));
        return results.length > 0 ? results[0] : '';
    }

    async getDecimals() {
        const response = await this.getConfig('decimals');
        const results = rawDecode(['uint'], toBuffer(response.result));
        return results.length > 0 ? results[0].toNumber() : -1;
    }

    async getConfig(type) {
        const tx = {};
        if (type === "decimals" || type === "symbol" || type === 'name') {
            tx.to = this.address;
            tx.data = generateAbiData({method: type});
            const params = [tx, 'latest'];
            const body = {};
            body.method = 'eth_call';
            body.params = params;
            return request({
                method: 'post',
                body,
            });
        } else {
            throw new Error('Unsupported kind of config: ' + type);
        }
    }

    async complete() {
        if (!this.symbol) {
            this.symbol = await this.getSymbol();
        }

        if (!this.digits) {
            this.digits = await this.getDecimals();
        }

        if (!this.name) {
            this.name = await this.getName();
        }
    }
}
