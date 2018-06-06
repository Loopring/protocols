/**
 *
 * help website: https://github.com/trezor/connect
 */
import {TrezorConnect} from '../common/trezor-connect';
import {clearHexPrefix, addHexPrefix, padLeftEven, toNumber, toHex, formatAddress} from '../common/formatter';
import EthTransaction from 'ethereumjs-tx';
import BN from 'bn.js';

/**
 * @description Returns ethereum address of given dpath
 * @param dpath
 * @returns {Promise}
 */
export async function getAddress (dpath)
{
    if (dpath)
    {
        return new Promise((resolve) =>
        {
            TrezorConnect.ethereumGetAddress(dpath, (result) =>
            {
                if (result.success)
                {
                    resolve({result: formatAddress(result.address)});
                }
                else
                {
                    resolve({error: result.error});
                }
            });
        });
    }
    else
    {
        throw new Error('dpath can\'t be null');
    }
}

/**
 * @description sign message, can only be verified by TREZOR.
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @param message string
 * @returns {Promise}
 */
export async function signMessage (dpath, message)
{
    if (dpath)
    {
        return new Promise((resolve) =>
        {
            TrezorConnect.ethereumSignMessage(dpath, message, (result) =>
            {
                if (result.success)
                {
                    const sig = result.signature;
                    const r = addHexPrefix(sig.slice(0, 64));
                    const s = addHexPrefix(sig.slice(64, 128));
                    const v = toNumber(sig.slice(128, 130));
                    resolve({result: {r, s, v}});
                }
                else
                {
                    resolve({error: result.error});
                }
            });
        });
    }
    else
    {
        throw new Error('dpath can\'t be null');
    }
}

/**
 * @description  sign ethereum tx
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @param rawTx
 * @returns {Promise}
 */
export async function signEthereumTx (dpath, rawTx)
{
    if (dpath)
    {
        return new Promise((resolve) =>
        {
            const tx = [rawTx.nonce, rawTx.gasPrice, rawTx.gasLimit, rawTx.to, rawTx.value === '' ? '' : rawTx.value, rawTx.data].map(item => padLeftEven(clearHexPrefix(item).toLowerCase()));
            TrezorConnect.ethereumSignTx(
                dpath,
                ...tx,
                rawTx.chainId,
                (result) =>
                {
                    if (result.success)
                    {
                        const ethTx = new EthTransaction({
                            ...rawTx,
                            v: addHexPrefix(new BN(result.v).toString(16)),
                            s: addHexPrefix(result.s),
                            r: addHexPrefix(result.r)
                        });
                        resolve({result: toHex(ethTx.serialize())});
                    }
                    else
                    {
                        resolve({error: result.error});
                    }
                });
        });
    }
    else
    {
        throw new Error('dpath can\'t be null');
    }
}

/**
 * Returns publicKey and chainCode
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @returns {Promise}
 */
export async function getXPubKey (dpath)
{
    if (dpath)
    {
        return new Promise((resolve) =>
        {
            TrezorConnect.setCurrency('BTC');
            TrezorConnect.getXPubKey(dpath, (result) =>
            {
                if (result.success)
                {
                    resolve({result});
                }
                else
                {
                    resolve({error: result.error});
                }
            });
        });
    }
    else
    {
        throw new Error('dpath can\'t be null');
    }
}
