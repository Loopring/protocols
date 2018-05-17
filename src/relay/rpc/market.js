import request from '../../common/request'
import {id} from '../../common/request'
import validator from '../validator'
import Response from '../../common/response'
import code from "../../common/code"





export default class Market{

  constructor(host){
    this.host = host;
  }

  /**
   * @description Get the given currency price of tokens
   * @param currency USD/CNY
   * @returns {Promise.<*>}
   */
getPriceQuote(currency) {
    try {
      validator.validate({value: currency, type: 'CURRENCY'})
    } catch (e) {
      return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
    }
    const body = {};
    body.method = 'loopring_getPriceQuote';
    body.params = [{currency}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

  /**
   * @description Get relay supported all market pairs
   * @returns {Promise}
   */
 getSupportedMarket() {
    const body = {};
    body.method = 'loopring_getSupportedMarket';
    body.params = [{}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

  /**
   * @description Get all supported tokens of relay
   * @returns {Promise}
   */
 getSupportedTokens() {
    const body = {};
    body.method = 'loopring_getSupportedTokens';
    body.params = [{}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }
  /**
   * @description Get depth and accuracy by token pair
   * @param filter
   * @returns {Promise.<*>}
   */
  getDepth(filter) {
    try {
      validator.validate({value: filter.delegateAddress, type: 'ETH_ADDRESS'});
      validator.validate({value: filter.market, type: 'STRING'});
      validator.validate({value: filter.length, type: 'OPTION_NUMBER'})
    } catch (e) {
      return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
    }
    const body = {};
    body.method = 'loopring_getDepth';
    body.params = [filter];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

  /**
   * @description Get loopring 24hr merged tickers info from loopring relay.
   * @returns {Promise}
   */
   getTicker() {
    const body = {};
    body.method = 'loopring_getTicker';
    body.params = [{}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

  /**
   * @description  Get all market 24hr merged tickers info from loopring relay.
   * @param market
   */
 getTickers(market) {
    const body = {};
    body.method = 'loopring_getTickers';
    body.params = [{market}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

  /**
   * @description Get trend info per market.
   * @param market
   * @param interval - examples:1Hr, 2Hr, 4Hr, 1Day, 1Week.
   * @returns {Promise.<*>}
   */
 getTrend({market, interval}) {
    try {
      validator.validate({value: market, type: 'STRING'});
      validator.validate({value: interval, type: 'INTERVAL'});
    } catch (e) {
      return Promise.resolve(new Response(code.PARAM_INVALID.code, code.PARAM_INVALID.msg))
    }
    const body = {};
    body.method = 'loopring_getTrend';
    body.params = [{market, interval}];
    body.id = id();
    return request(this.host, {
      method: 'post',
      body
    })
  }

}



