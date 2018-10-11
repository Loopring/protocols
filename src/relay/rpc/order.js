import request, {id} from '../../common/request';
import Response from '../../common/response';
import code from '../../common/code';
import {soliditySHA3, solidityPack} from 'ethereumjs-abi';
import validator from '../validator';
import {toBN} from '../../common/formatter';

export default class Order
{
    constructor (host)
    {
        this.host = host;
    }

    getOrders (filter)
    {
        return getOrders(this.host, filter);
    }

    getCutoff (filter)
    {
        return getCutoff(this.host, filter);
    }

    placeOrder (order)
    {
        return placeOrder(this.host, order);
    }

    getOrderHash (order)
    {
        return getOrderHash(order);
    }

    packOrder (order)
    {
        return packOrder(order);
    }

    cancelOrder (params)
    {
        return cancelOrder(this.host, params);
    }

    setTempStore (key, value)
    {
        return setTempStore(this.host, key, value);
    }

    getOrderByHash (filter)
    {
        return getOrderHash(this.host, filter);
    }

    getUnmergedOrderBook (filter)
    {
        return getUnmergedOrderBook(this.host, filter);
    }

    getTempStore (filter)
    {
        return getTempStore(this.host, filter);
    }
}

/**
 * @description Get loopring order list.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
export function getOrders (host, filter)
{
    try
    {
        validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
        validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'});
        filter.market && validator.validate({value: filter.market, type: 'STRING'});
        filter.owner && validator.validate({value: filter.owner, type: 'ETH_ADDRESS'});
        filter.orderHash && validator.validate({value: filter.orderHash, type: 'STRING'});
        filter.pageSize && validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_getOrders';
    body.params = [filter];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * @description Get cut off time of the address.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
export function getCutoff (host, filter)
{
    let {address, delegateAddress, blockNumber} = filter;
    blockNumber = blockNumber || 'latest';
    try
    {
        validator.validate({value: address, type: 'ETH_ADDRESS'});
        validator.validate({value: delegateAddress, type: 'ETH_ADDRESS'});
        validator.validate({value: blockNumber, type: 'RPC_TAG'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_getCutoff';
    body.params = [{...filter}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * @description  Submit an order.The order is submitted to relay as a JSON object,
 * this JSON will be broadcast into peer-to-peer network for off-chain order-book maintainance and ring-ming.
 * Once mined, the ring will be serialized into a transaction and submitted to Ethereum blockchain.
 * @param order
 * @param host
 * @returns {Promise.<*>}
 */
export function placeOrder (host, order)
{
    try
    {
        validator.validate({value: order, type: 'ORDER'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_submitOrder';
    body.params = [order];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * @description Returns the order Hash of given order
 * @param order
 */
export function getOrderHash (order)
{
    try
    {
        validator.validate({value: order, type: 'RAW_Order'});
    }
    catch (e)
    {
        return new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg);
    }
    const orderTypes = [
        'address',
        'address',
        'address',
        'address',
        'address',
        'address',
        'uint',
        'uint',
        'uint',
        'uint',
        'uint',
        'bool',
        'uint8'
    ];
    const orderData = [
        order.delegateAddress,
        order.owner,
        order.tokenS,
        order.tokenB,
        order.walletAddress,
        order.authAddr,
        toBN(order.amountS),
        toBN(order.amountB),
        toBN(order.validSince),
        toBN(order.validUntil),
        toBN(order.lrcFee),
        order.buyNoMoreThanAmountB,
        order.marginSplitPercentage
    ];
    return soliditySHA3(orderTypes, orderData);
}

export function packOrder (order)
{
    try
    {
        validator.validate({value: order, type: 'RAW_Order'});
    }
    catch (e)
    {
        return new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg);
    }
    const orderTypes = [
        'address',
        'address',
        'address',
        'address',
        'address',
        'address',
        'uint',
        'uint',
        'uint',
        'uint',
        'uint',
        'bool',
        'uint8'
    ];
    const orderData = [
        order.delegateAddress,
        order.owner,
        order.tokenS,
        order.tokenB,
        order.walletAddress,
        order.authAddr,
        toBN(order.amountS),
        toBN(order.amountB),
        toBN(order.validSince),
        toBN(order.validUntil),
        toBN(order.lrcFee),
        order.buyNoMoreThanAmountB,
        order.marginSplitPercentage
    ];

    return solidityPack(orderTypes, orderData);
}

/**
 * @description Submit some datas to relay that will store in a short term (24H)
 * @param host
 * @param key
 * @param value
 * @returns {Promise.<*>}
 */
export function setTempStore (host, key, value)
{
    try
    {
        validator.validate({value: key, type: 'STRING'});
        validator.validate({value: value, type: 'STRING'});
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
    const body = {};
    body.method = 'loopring_setTempStore';
    body.params = [{key, value}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

export function getTempStore (host, filter)
{
    const body = {};
    body.method = 'loopring_getTempStore';
    body.params = [{...filter}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

/**
 * Cancel order by Relay
 * @param host
 * @param sign
 * @param orderHash
 * @param tokenS
 * @param tokenB
 * @param cutoff
 * @param type
 * @returns {*}
 */
export function cancelOrder (host, {sign, orderHash, tokenS, tokenB, cutoff, type})
{
    const {owner, r, s, v} = sign;
    try
    {
        validator.validate({value: owner, type: 'ETH_ADDRESS'});
        validator.validate({value: v, type: 'NUM'});
        validator.validate({value: s, type: 'ETH_DATA'});
        validator.validate({value: r, type: 'ETH_DATA'});
        validator.validate({value: type, type: 'CANCEL_ORDER_TYPE'});
        switch (type)
        {
            case 1:
                validator.validate({value: orderHash, type: 'ETH_DATA'});
                break;
            case 2:
                break;
            case 3:
                validator.validate({value: cutoff, type: 'NUM'});
                break;
            case 4:
                validator.validate({value: tokenS, type: 'ETH_ADDRESS'});
                validator.validate({value: tokenB, type: 'ETH_ADDRESS'});
                break;
            default:
        }
        const body = {};
        body.method = 'loopring_flexCancelOrder';
        body.params = [{sign, orderHash, tokenS, tokenB, cutoff, type}];
        body.id = id();
        body.jsonrpc = '2.0';
        return request(host, {
            method: 'post',
            body
        });
    }
    catch (e)
    {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
    }
}

export function getUnmergedOrderBook (host, filter)
{
    const {delegateAddress} = filter;
    validator.validate({value: delegateAddress, type: 'ETH_ADDRESS'});
    const body = {};
    body.method = 'loopring_getUnmergedOrderBook';
    body.params = [{...filter}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}

export function getOrderByHash (host, filter)
{
    const body = {};
    body.method = 'loopring_getOrderByHash';
    body.params = [{orderHash: filter.orderHash}];
    body.id = id();
    body.jsonrpc = '2.0';
    return request(host, {
        method: 'post',
        body
    });
}
