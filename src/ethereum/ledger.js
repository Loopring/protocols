import ledger from 'ledgerco';
import {addHexPrefix, toBuffer, toHex} from '../common/formatter';
import trimStart from 'lodash/trimStart';
import EthTransaction from 'ethereumjs-tx';
import validator from './validator';

/**
 * @description connect to Ledger
 * @returns {Promise}
 */
export async function connect() {
    return new Promise((resolve) => {
        ledger.comm_u2f.create_async()
            .then(comm => {
                try {
                    resolve({result: new ledger.eth(comm)});
                } catch (e) {
                    resolve({error: {message: e.message}})
                }
            })
    })
}

/**
 * @description Returns publicKey , chainCode and address
 * @param dpath string
 * @param ledgerConnect
 * @returns {Promise}
 */
export async function getXPubKey(dpath, ledgerConnect) {
    if (dpath) {
        return new Promise((resolve) => {
            ledgerConnect.getAddress_async(dpath, false, true)
                .then(res => {
                    resolve({result: res})
                }).catch(err => {
                resolve({error: err})
            });
        })
    } else {
        throw new Error('dpath can\'t be null')
    }
}

function hexEncodeQuantity(value) {
    const trimmedValue = trimStart((value).toString('hex'), '0');
    return addHexPrefix(trimmedValue === '' ? '0' : trimmedValue);
}

function hexEncodeData(value) {
    return toHex(toBuffer(value));
}

function getTransactionFields(t) {
    const {data, gasLimit, gasPrice, to, nonce, value} = t;
    const chainId = t.getChainId();
    return {
        value: hexEncodeQuantity(value),
        data: hexEncodeData(data),
        to: hexEncodeData(to),
        nonce: hexEncodeQuantity(nonce),
        gasPrice: hexEncodeQuantity(gasPrice),
        gasLimit: hexEncodeQuantity(gasLimit),
        chainId
    };
};

/**
 * @description sign message
 * @param dpath string
 * @param message
 * @param ledgerConnect
 * @returns {Promise}
 */
export async function signMessage(dpath, message, ledgerConnect) {
    if (dpath) {
        return new Promise((resolve) => {
            ledgerConnect.signPersonalMessage_async(dpath, message).then(result => {
                if (result.error) {
                    return resolve({error: result.error});
                } else {
                    resolve({result: {v: result.v, r: addHexPrefix(result.r), s: addHexPrefix(result.s)}});
                }
            });
        });
    } else {
        throw new Error('dpath can\'t be null')
    }
}

/**
 * @description sign ethereum tx
 * @param dpath string
 * @param rawTx
 * @param ledgerConnect
 * @returns {Promise}
 */
export async function signEthereumTx(dpath, rawTx, ledgerConnect) {
    if (dpath) {
        validator.validate({type: 'BASIC_TX', value: rawTx});
        const t = new EthTransaction(rawTx);
        t.v = toBuffer([t._chainId]);
        t.r = toBuffer(0);
        t.s = toBuffer(0);
        return new Promise((resolve) => {
            ledgerConnect.ledger
                .signTransaction_async(dpath, t.serialize().toString('hex'))
                .then(result => {
                    const strTx = getTransactionFields(t);
                    const txToSerialize = {
                        ...strTx,
                        v: addHexPrefix(result.v),
                        r: addHexPrefix(result.r),
                        s: addHexPrefix(result.s)
                    };
                    const ethTx = new EthTransaction(txToSerialize)
                    const serializedTx = ethTx.serialize();
                    resolve({result: serializedTx});
                })
                .catch(err => {
                    return resolve({error: {message: (`${err.message} . Check to make sure contract data is on`)}});
                });
        });
    } else {
        throw new Error('dpath can\'t be null')
    }
}


