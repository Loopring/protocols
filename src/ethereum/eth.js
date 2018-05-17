import validator from './validator'
import request from '../common/request'
import {id} from '../common/request'
import Response from '../common/response'
import code from "../common/code"

export default class Eth {

  constructor (host) {
    this.host = host;
  }

  /**
   * @description Returns the number of transactions sent from an address.
   * @param address
   * @param tag
   * @returns {Promise}
   */
 getTransactionCount({address, tag}) {
    tag = tag || "pending";
    try {
      validator.validate({value: address, type: "ETH_ADDRESS"});
      validator.validate({value: tag, type: "RPC_TAG"})
    } catch (e) {
      return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
    }
    const params = [address, tag];
    const body = {};
    body.method = 'eth_getTransactionCount';
    body.params = params;
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    })
  }


  /**
   * @description Sends signed ethereum tx
   * @param signedTx
   * @returns {Promise}
   */
  sendRawTransaction({signedTx}) {
    const body = {};
    body.method = 'eth_sendRawTransaction';
    body.params = [signedTx];
    body.id = id();
    return request(this.host,{
      method: 'post',
      body,
    })
  }

  /**
   * @description Returns the current price per gas in wei.
   * @returns {Promise}
   */
  getGasPrice() {
    const params = [];
    const body = {};
    body.method = 'eth_gasPrice';
    body.params = params;
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    })
  }

  /**
   * @description Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
   * @param tx
   * @returns {Promise}
   */
  estimateGas(tx) {
    const body = {};
    body.method = 'eth_estimateGas';
    body.params = [tx];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    })
  }

  /**
   * @description Returns the ethereum balance of the account of given address.
   * @param address
   * @param tag
   * @returns {Promise}
   */
  getAccountBalance({address, tag}) {
    tag = tag || "latest";
    if (tag) {
      try {
        validator.validate({value: tag, type: "RPC_TAG"});
        validator.validate({value: address, type: "ETH_ADDRESS"});
      } catch (e) {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
      }
    }
    const params = [address, tag];
    const body = {};
    body.method = 'eth_getBalance';
    body.params = params;
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    })
  }

  /**
   * @description Returns the information about a transaction requested by transaction hash.
   * @param hash ethereum tx hash
   * @returns {Promise}
   */
  getTransactionByhash({hash}) {
    try {
      validator.validate({value: hash, type: "ETH_DATA"});
    } catch (e) {
      return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
    }
    const params = [hash];
    const body = {};
    body.method = 'eth_getTransactionByHash';
    body.params = params;
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    })
  }

  /**
   * @description Executes a new message call immediately without creating a transaction on the block chain.
   * @param tx
   * @param tag
   * @returns {Promise}
   */
  call({tx, tag}) {
    tag = tag || "latest";
    if (tag) {
      try {
        validator.validate({value: tag, type: "RPC_TAG"})
      } catch (e) {
        return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
      }
    }
    const params = [tx, tag];
    const body = {};
    body.method = 'eth_call';
    body.params = params;
    body.id = id();
    return request(this.host, {
      method: 'post',
      body,
    });
  }





}
