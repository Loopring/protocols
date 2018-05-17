import request from '../../common/request'
import {id} from  '../../common/request'
import validator from '../validator'
import Response from '../../common/response'
import code from "../../common/code"
import {toBig, toHex} from "../../common/formatter";

export default class Ring{

  constructor (host){
    this.host = host;
  }

  getRings(filter){
    return getRings(this.host,filter)
  }

  getRingMinedDetail({ringIndex, protocolAddress}){
    return getRingMinedDetail(this.host, {ringIndex, protocolAddress})
  }

  getFills(filter){
    return getFills(this.host,filter)
  }
}

/**
 * @description Get all mined rings.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
export function getRings(host,filter) {
  try {
    validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
    if (filter.pageIndex) {
      validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'})
    }
    if (filter.pageSize) {
      validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'})
    }
  } catch (e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
  }
  const body = {};
  body.method = 'loopring_getRingMined';
  body.params = [filter];
  body.id = id();
  return request(host, {
    method: 'post',
    body,
  })
}

/**
 * @description Get ring mined detail
 * @param host
 * @param ringIndex
 * @param protocolAddress
 * @returns {Promise}
 */
export function getRingMinedDetail(host,{ringIndex, protocolAddress}) {
  try {
    validator.validate({value: protocolAddress, type: 'ETH_ADDRESS'});
  } catch (e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
  }
  ringIndex = toHex(toBig(ringIndex));
  const body = {};
  body.method = 'loopring_getRingMinedDetail';
  body.params = [{ringIndex}];
  body.id = id();
  return request(host, {
    method: 'post',
    body,
  })
}

/**
 * @description Get order fill history. This history consists of OrderFilled events.
 * @param host
 * @param filter {market, owner, delegateAddress, orderHash, ringHash,pageIndex,pageSize}
 * @returns {Promise}
 */
export function getFills(host,filter) {
  try {
    if (filter.delegateAddress) {
      validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
    }
    if (filter.owner) {
      validator.validate({value: filter.owner, type: 'ETH_ADDRESS'});
    }
    if (filter.orderHash) {
      validator.validate({value: filter.orderHash, type: 'HASH'});
    }
    if (filter.ringHash) {
      validator.validate({value: filter.ringHash, type: 'HASH'});
    }
    if (filter.pageIndex) {
      validator.validate({value: filter.pageIndex, type: 'OPTION_NUMBER'})
    }
    if (filter.pageSize) {
      validator.validate({value: filter.pageSize, type: 'OPTION_NUMBER'})
    }
  } catch(e) {
    return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
  }
  const body = {};
  body.method = 'loopring_getFills';
  body.params = [filter];
  body.id = id();
  return request(host, {
    method: 'post',
    body,
  })
}


