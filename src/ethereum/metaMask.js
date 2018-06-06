import validator from './validator';
import Response from '../common/response';
import code from '../common/code';
import {addHexPrefix, toHex, toNumber} from '../common/formatter';
import {hashPersonalMessage, sha3} from 'ethereumjs-util';
import EthTransaction from 'ethereumjs-tx';

/**
 * @description sign hash
 * @param web3
 * @param account
 * @param hash
 * @returns {Promise.<*>}
 */
export async function sign (web3, account, hash)
{
    try
    {
        validator.validate({value: account, type: 'ETH_ADDRESS'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    if (web3 && web3.eth.accounts[0])
    {
        return new Promise((resolve) =>
        {
            web3.eth.sign(account, hash, function (err, result)
            {
                if (!err)
                {
                    const r = result.slice(0, 66);
                    const s = addHexPrefix(result.slice(66, 130));
                    const v = toNumber(addHexPrefix(result.slice(130, 132)));
                    resolve({result: {r, s, v}});
                }
                else
                {
                    const errorMsg = err.message.substring(0, err.message.indexOf(' at '));
                    resolve({error: {message: errorMsg}});
                }
            });
        });
    }
    else
    {
        throw new Error('Not found MetaMask');
    }
}

/**
 * @description sign message
 * @param web3
 * @param account
 * @param message
 * @returns {Promise}
 */
export function signMessage (web3, account, message)
{
    const hash = toHex(hashPersonalMessage(sha3(message)));
    return sign(web3, account, hash);
}

/**
 * @description Signs ethereum tx
 * @param web3
 * @param account
 * @param rawTx
 * @returns {Promise.<*>}
 */
export async function signEthereumTx (web3, account, rawTx)
{
    try
    {
        validator.validate({value: rawTx, type: 'TX'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const ethTx = new EthTransaction(rawTx);
    const hash = toHex(ethTx.hash(false));
    const response = await sign(web3, account, hash);
    if (!response.error)
    {
        const signature = response.result;
        signature.v += ethTx._chainId * 2 + 8;
        Object.assign(ethTx, signature);
        return {result: toHex(ethTx.serialize())};
    }
    else
    {
        return response;
    }
}

/**
 * @description Sends ethereum tx through MetaMask
 * @param web3
 * @param tx
 * @returns {*}
 */
export function sendTransaction (web3, tx)
{
    try
    {
        validator.validate({type: 'TX', value: tx});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    if (web3 && web3.eth.accounts[0])
    {
        return new Promise((resolve) =>
        {
            web3.eth.sendTransaction(tx, function (err, transactionHash)
            {
                if (!err)
                {
                    resolve({result: transactionHash});
                }
                else
                {
                    const errorMsg = err.message.substring(0, err.message.indexOf(' at '));
                    resolve({error: {message: errorMsg}});
                }
            });
        });
    }
    else
    {
        throw new Error('Not found MetaMask');
    }
}
