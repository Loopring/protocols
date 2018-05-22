import request from '../../common/request'
import {id} from '../../common/request'
import Response from '../../common/response'
import code from "../../common/code"
import {soliditySHA3} from 'ethereumjs-abi'
import validator from '../validator'
import {toBN} from "../../common/formatter";


export class Order{

  constructor (host){
    this.host = host;
  }

  getOrders(filter){
    return getOrders(this.host, filter)
  }

  getCutoff({address, delegateAddress, blockNumber}){
    return getCutoff(this.host, {address, delegateAddress, blockNumber})
  }

  placeOrder(order){
    return placeOrder(this.host, order);
  }

  getOrderHash(order){
    return getOrderHash(order)
  }
}

/**
 * @description Get loopring order list.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
export function getOrders(host,filter) {
  try {
    validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
    validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'});
    filter.market && validator.validate({value: filter.market, type: 'STRING'});
    filter.owner && validator.validate({value: filter.owner, type: 'ETH_ADDRESS'});
    filter.orderHash && validator.validate({value: filter.orderHash, type: 'STRING'});
    filter.pageSize && validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'});
  } catch (e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg));
  }
  const body = {};
  body.method = 'loopring_getOrders';
  body.params = [filter];
  body.id = id();
  body.jsonrpc = '2.0';
  return request(host, {
    method: 'post',
    body,
  })
}

/**
 * @description Get cut off time of the address.
 * @param host
 * @param address
 * @param delegateAddress
 * @param blockNumber
 * @returns {Promise.<*>}
 */
export function getCutoff(host,{address, delegateAddress, blockNumber}) {
  blockNumber = blockNumber || 'latest';
  try {
    validator.validate({value: address, type: 'ETH_ADDRESS'});
    validator.validate({value: delegateAddress, type: 'ETH_ADDRESS'});
    validator.validate({value: blockNumber, type: 'RPC_TAG'});
  } catch (e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
  }
  const body = {};
  body.method = 'loopring_getCutoff';
  body.params = [{address, delegateAddress, blockNumber}];
  body.id = id();
  body.jsonrpc = '2.0';
  return request(host, {
    method: 'post',
    body,
  })
}

/**
 * @description  Submit an order.The order is submitted to relay as a JSON object,
 * this JSON will be broadcast into peer-to-peer network for off-chain order-book maintainance and ring-ming.
 * Once mined, the ring will be serialized into a transaction and submitted to Ethereum blockchain.
 * @param order
 * @param host
 * @returns {Promise.<*>}
 */
export function placeOrder(host,order) {
  try {
    validator.validate({value: order, type: "Order"});
  } catch(e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
  }
  const body = {};
  body.method = 'loopring_submitOrder';
  body.params = [order];
  body.id = id();
  body.jsonrpc = '2.0';
  return request(host, {
    method: 'post',
    body,
  })
}


/**
 * @description Returns the order Hash of given order
 * @param order
 */
export function getOrderHash(order) {
  try {
    validator.validate({value: order, type: 'RAW_Order'});
  } catch(e) {
    return new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg)
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
