'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getTrend = exports.getTickerBySource = exports.getTickers = exports.getTicker = exports.getDepth = exports.getSupportedTokens = exports.getSupportedMarket = exports.getPriceQuote = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _request = require('../../common/request');

var _request2 = _interopRequireDefault(_request);

var _validator = require('../validator');

var _validator2 = _interopRequireDefault(_validator);

var _response = require('../../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../../common/code');

var _code2 = _interopRequireDefault(_code);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Market = function () {
    function Market(host) {
        _classCallCheck(this, Market);

        this.host = host;
    }

    _createClass(Market, [{
        key: 'getPriceQuote',
        value: function getPriceQuote(currency) {
            return _getPriceQuote(this.host, currency);
        }
    }, {
        key: 'getSupportedMarket',
        value: function getSupportedMarket() {
            return _getSupportedMarket(this.host);
        }
    }, {
        key: 'getSupportedTokens',
        value: function getSupportedTokens() {
            return _getSupportedTokens(this.host);
        }
    }, {
        key: 'getDepth',
        value: function getDepth(filter) {
            return _getDepth(this.host, filter);
        }
    }, {
        key: 'getTicker',
        value: function getTicker() {
            return _getTicker(this.host);
        }
    }, {
        key: 'getTickers',
        value: function getTickers(market) {
            return _getTickers(this.host, market);
        }
    }, {
        key: 'getTrend',
        value: function getTrend(filter) {
            return _getTrend(this.host, filter);
        }
    }, {
        key: 'getTickerBySource',
        value: function getTickerBySource(filter) {
            return _getTickerBySource(this.host, filter);
        }
    }]);

    return Market;
}();

/**
 * @description Get the given currency price of tokens
 * @param host
 * @param currency USD/CNY
 * @returns {Promise.<*>}
 */


exports.default = Market;
function _getPriceQuote(host, currency) {
    try {
        _validator2.default.validate({ value: currency, type: 'CURRENCY' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getPriceQuote';
    body.params = [{ currency: currency }];
    body.id = (0, _request.id)();
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get relay supported all market pairs
 * @param host
 * @returns {Promise}
 */
exports.getPriceQuote = _getPriceQuote;
function _getSupportedMarket(host) {
    var body = {};
    body.method = 'loopring_getSupportedMarket';
    body.params = [{}];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get all supported tokens of relay
 * @param host
 * @returns {Promise}
 */
exports.getSupportedMarket = _getSupportedMarket;
function _getSupportedTokens(host) {
    var body = {};
    body.method = 'loopring_getSupportedTokens';
    body.params = [{}];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}
/**
 * @description Get depth and accuracy by token pair
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
exports.getSupportedTokens = _getSupportedTokens;
function _getDepth(host, filter) {
    try {
        _validator2.default.validate({ value: filter.delegateAddress, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: filter.market, type: 'STRING' });
        _validator2.default.validate({ value: filter.length, type: 'OPTION_NUMBER' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getDepth';
    body.params = [filter];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get loopring 24hr merged tickers info from loopring relay.
 * @param host
 * @returns {Promise}
 */
exports.getDepth = _getDepth;
function _getTicker(host) {
    var body = {};
    body.method = 'loopring_getTicker';
    body.params = [{}];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description  Get all market 24hr merged tickers info from loopring relay.
 * @param host
 * @param market
 */
exports.getTicker = _getTicker;
function _getTickers(host, market) {
    var body = {};
    body.method = 'loopring_getTickers';
    body.params = [{ market: market }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

exports.getTickers = _getTickers;
function _getTickerBySource(host, filter) {
    var body = {};
    body.method = 'loopring_getTickerBySource';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get trend info per market.
 * @param host
 * @param market
 * @param interval - examples:1Hr, 2Hr, 4Hr, 1Day, 1Week.
 * @returns {Promise.<*>}
 */
exports.getTickerBySource = _getTickerBySource;
function _getTrend(host, filter) {
    var market = filter.market,
        interval = filter.interval;

    try {
        _validator2.default.validate({ value: market, type: 'STRING' });
        _validator2.default.validate({ value: interval, type: 'INTERVAL' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getTrend';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}
exports.getTrend = _getTrend;