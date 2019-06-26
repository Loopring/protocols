import validator from '../common/validator'
import request from '../common/request'
import {generateAbiData} from './abi';
import {configs} from "../config/data";
import {toBuffer} from "../common/formatter";
import {rawDecode} from 'ethereumjs-abi'
import {sha3} from 'ethereumjs-util'

export async function getTransactionCount(address, tag) {
    try {
        validator.validate({value: address, type: "ADDRESS"})
    } catch (e) {
        throw new Error('Invalid Address')
    }
    tag = tag || "pending";
    if (tag) {
        try {
            validator.validate({value: tag, type: "RPC_TAG"})
        } catch (e) {
            throw new Error('Invalid tag, must be one of latest, pending,earliest')
        }
    }
    const params = [address, tag];
    const body = {};
    body.method = 'eth_getTransactionCount';
    body.params = params;
    return request({
        method: 'post',
        body,
    })
}

export async function getGasPrice() {
    const params = [];
    const body = {};
    body.method = 'eth_gasPrice';
    body.params = params;

    return request({
        method: 'post',
        body,
    })
}

export async function estimateGas(tx) {
    const body = {};
    body.method = 'eth_estimateGas';
    body.params = [tx];
    return request({
        method: 'post',
        body,
    })
}

export async function getAccountBalance(address, tag) {
    try {
        validator.validate({value: address, type: "ADDRESS"})
    } catch (e) {
        throw new Error('Invalid Address')
    }
    tag = tag || "pending";
    if (tag) {
        try {
            validator.validate({value: tag, type: "RPC_TAG"})
        } catch (e) {
            throw new Error('Invalid tag, must be one of latest, pending,earliest')
        }
    }
    const params = [address, tag];
    const body = {};
    body.method = 'eth_getBalance';
    body.params = params;
    return request({
        method: 'post',
        body,
    })
}

export async function getTransactionByhash(hash) {
    try {
        validator.validate({value: hash, type: "ETH_DATA"})
    } catch (e) {
        throw new Error('Invalid Transaction Hash')
    }
    const params = [hash];
    const body = {};
    body.method = 'eth_getTransactionByHash';
    body.params = params;
    return request({
        method: 'post',
        body,
    })
}

export async function getTransactionRecipt(hash) {
    try {
        validator.validate({value: hash, type: "ETH_DATA"})
    } catch (e) {
        throw new Error('Invalid Transaction Hash')
    }
    const params = [hash];
    const body = {};
    body.method = 'eth_getTransactionReceipt';
    body.params = params;
    return request({
        method: 'post',
        body,
    })
}

export function generateBindAddressTx({projectId, address, gasPrice, gasLimit, nonce, chainId}) {
    const tx = {};
    tx.to = configs.bindContractAddress;
    tx.value = "0x0";
    tx.data = generateAbiData({method: "bind", address: address, projectId});
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
    return tx
}

export function eosRegisterTx({key, to, gasPrice, gasLimit, nonce, chainId}) {
    const tx = {};
    tx.to = to;
    tx.value = "0x0";
    tx.data = generateAbiData({method: "register", key});
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
    return tx
}

export async function getEosKey({address, to}) {
    const tx = {};
    tx.data = generateAbiData({method: "keys", address});
    tx.to = to;
    const params = [tx, "latest"];
    const body = {};
    body.method = 'eth_call';
    body.params = params;
    const response = await request({
        method: 'post',
        body,
    });
    const results = rawDecode(['string'], toBuffer(response.result));
    return results.length > 0 ? results[0] : '';
}

export async function getBindAddress(owner, projectId) {
    const tx = {};
    tx.data = generateAbiData({method: "getBindingAddress", owner, projectId});
    tx.to = configs.bindContractAddress;
    const params = [tx, "latest"];
    const body = {};
    body.method = 'eth_call';
    body.params = params;
    const response = await request({
        method: 'post',
        body,
    });
    const results = rawDecode(['string'], toBuffer(response.result));
    return results.length > 0 ? results[0] : '';
}

export function generateRegisterNameTx({name, to, gasPrice, gasLimit, nonce, chainId}) {
    const tx = {};
    tx.to = to;
    tx.value = "0x0";
    tx.data = generateAbiData({method: "registerName", name});
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
    return tx
}

export function addParticipant({feeRecipient, signer, to, gasPrice, gasLimit, nonce, chainId}) {
    const tx = {};
    tx.to = to;
    tx.value = "0x0";
    tx.data = generateAbiData({method: "addParticipant", feeRecipient, signer});
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
    return tx
}

export function isValidEthAddress(address) {
    try {
        validator.validate({value: address, type: "ADDRESS"})
        return true
    } catch (e) {
        return false
    }
}

export function getHash(message) {
    return sha3(message)
}

