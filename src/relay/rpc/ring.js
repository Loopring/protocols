import request, {id} from '../../common/request';
import validator from '../validator';
import Response from '../../common/response';
import code from '../../common/code';
import {toBig, toHex} from '../../common/formatter';
import {getOrderHash} from './order';
import {soliditySHA3} from 'ethereumjs-abi';

export default class Ring
{
    constructor (host)
    {
        this.host = host;
    }

    getRings (filter)
    {
        return getRings(this.host, filter);
    }

    getRingMinedDetail ({ringIndex, protocolAddress})
    {
        return getRingMinedDetail(this.host, {ringIndex, protocolAddress});
    }

    getFills (filter)
    {
        return getFills(this.host, filter);
    }

    getRingHash (orders, feeRecipient, feeSelections)
    {
        return getRingHash(orders, feeRecipient, feeSelections);
    }
}

/**
 * @description Get all mined rings.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
export function getRings (host, filter)
{
    try
    {
        validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
        if (filter.pageIndex)
        {
            validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'});
        }
        if (filter.pageSize)
        {
            validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'});
        }
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_getRingMined';
    body.params = [filter];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * @description Get ring mined detail
 * @param host
 * @param ringIndex
 * @param protocolAddress
 * @returns {Promise}
 */
export function getRingMinedDetail (host, {ringIndex, protocolAddress})
{
    try
    {
        validator.validate({value: protocolAddress, type: 'ETH_ADDRESS'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    ringIndex = toHex(toBig(ringIndex));
    const body = {};
    body.method = 'loopring_getRingMinedDetail';
    body.params = [{ringIndex, protocolAddress}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * @description Get order fill history. This history consists of OrderFilled events.
 * @param host
 * @param filter {market, owner, delegateAddress, orderHash, ringHash,pageIndex,pageSize}
 * @returns {Promise}
 */
export function getFills (host, filter)
{
    try
    {
        if (filter.delegateAddress)
        {
            validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
        }
        if (filter.owner)
        {
            validator.validate({value: filter.owner, type: 'ETH_ADDRESS'});
        }
        if (filter.orderHash)
        {
            validator.validate({value: filter.orderHash, type: 'HASH'});
        }
        if (filter.ringHash)
        {
            validator.validate({value: filter.ringHash, type: 'HASH'});
        }
        if (filter.pageIndex)
        {
            validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'});
        }
        if (filter.pageSize)
        {
            validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'});
        }
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_getFills';
    body.params = [filter];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

export function getRingHash (orders, feeRecipient, feeSelections)
{
    const orderHashList = orders.map(order => getOrderHash(order));
    return soliditySHA3(['string', 'address', 'uint16'], [
        xorReduceStr(orderHashList),
        feeRecipient,
        feeSelections
    ]);
}

function xorReduceStr (strArr)
{
    const s0 = strArr[0];
    const tail = strArr.slice(1);
    const strXor = (s1, s2) =>
    {
        const buf1 = Buffer.from(s1.slice(2), 'hex');
        const buf2 = Buffer.from(s2.slice(2), 'hex');
        const res = Buffer.alloc(32);
        for (let i = 0; i < 32; i++)
        {
            res[i] = buf1[i] ^ buf2[i];
        }
        return toHex(res);
    };
    const reduceRes = tail.reduce((a, b) => strXor(a, b), s0);
    return Buffer.from(reduceRes.slice(2), 'hex');
}
