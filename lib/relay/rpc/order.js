'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getContracts = exports.getOrderByHash = exports.getUnmergedOrderBook = exports.cancelOrder = exports.getTempStore = exports.setTempStore = exports.packOrder = exports.getOrderHash = exports.placeOrder = exports.getCutoff = exports.getOrders = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _request = require('../../common/request');

var _request2 = _interopRequireDefault(_request);

var _response = require('../../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../../common/code');

var _code2 = _interopRequireDefault(_code);

var _ethereumjsAbi = require('ethereumjs-abi');

var _validator = require('../validator');

var _validator2 = _interopRequireDefault(_validator);

var _formatter = require('../../common/formatter');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Order = function () {
    function Order(host) {
        _classCallCheck(this, Order);

        this.host = host;
    }

    _createClass(Order, [{
        key: 'getOrders',
        value: function getOrders(filter) {
            return _getOrders(this.host, filter);
        }
    }, {
        key: 'getCutoff',
        value: function getCutoff(filter) {
            return _getCutoff(this.host, filter);
        }
    }, {
        key: 'placeOrder',
        value: function placeOrder(order) {
            return _placeOrder(this.host, order);
        }
    }, {
        key: 'getOrderHash',
        value: function getOrderHash(order) {
            return _getOrderHash(order);
        }
    }, {
        key: 'packOrder',
        value: function packOrder(order) {
            return _packOrder(order);
        }
    }, {
        key: 'cancelOrder',
        value: function cancelOrder(params) {
            return _cancelOrder(this.host, params);
        }
    }, {
        key: 'setTempStore',
        value: function setTempStore(key, value) {
            return _setTempStore(this.host, key, value);
        }
    }, {
        key: 'getOrderByHash',
        value: function getOrderByHash(filter) {
            return _getOrderByHash(this.host, filter);
        }
    }, {
        key: 'getUnmergedOrderBook',
        value: function getUnmergedOrderBook(filter) {
            return _getUnmergedOrderBook(this.host, filter);
        }
    }, {
        key: 'getTempStore',
        value: function getTempStore(filter) {
            return _getTempStore(this.host, filter);
        }
    }, {
        key: 'getContracts',
        value: function getContracts() {
            return _getContracts(this.host);
        }
    }]);

    return Order;
}();

/**
 * @description Get loopring order list.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */


exports.default = Order;
function _getOrders(host, filter) {
    try {
        _validator2.default.validate({ value: filter.delegateAddress, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: filter.pageIndex, type: 'OPTION_NUMBER' });
        filter.market && _validator2.default.validate({ value: filter.market, type: 'STRING' });
        filter.owner && _validator2.default.validate({ value: filter.owner, type: 'ETH_ADDRESS' });
        filter.orderHash && _validator2.default.validate({ value: filter.orderHash, type: 'STRING' });
        filter.pageSize && _validator2.default.validate({ value: filter.pageSize, type: 'OPTION_NUMBER' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getOrders';
    body.params = [filter];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get cut off time of the address.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
exports.getOrders = _getOrders;
function _getCutoff(host, filter) {
    var address = filter.address,
        delegateAddress = filter.delegateAddress,
        blockNumber = filter.blockNumber;

    blockNumber = blockNumber || 'latest';
    try {
        _validator2.default.validate({ value: address, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: delegateAddress, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: blockNumber, type: 'RPC_TAG' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getCutoff';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
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
exports.getCutoff = _getCutoff;
function _placeOrder(host, order) {
    try {
        _validator2.default.validate({ value: order, type: 'ORDER' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_submitOrder';
    body.params = [order];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Returns the order Hash of given order
 * @param order
 */
exports.placeOrder = _placeOrder;
function _getOrderHash(order) {
    try {
        _validator2.default.validate({ value: order, type: 'RAW_Order' });
    } catch (e) {
        return new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg);
    }
    var orderTypes = ['address', 'address', 'address', 'address', 'address', 'address', 'uint', 'uint', 'uint', 'uint', 'uint', 'bool', 'uint8'];
    var orderData = [order.delegateAddress, order.owner, order.tokenS, order.tokenB, order.walletAddress, order.authAddr, (0, _formatter.toBN)(order.amountS), (0, _formatter.toBN)(order.amountB), (0, _formatter.toBN)(order.validSince), (0, _formatter.toBN)(order.validUntil), (0, _formatter.toBN)(order.lrcFee), order.buyNoMoreThanAmountB, order.marginSplitPercentage];
    return (0, _ethereumjsAbi.soliditySHA3)(orderTypes, orderData);
}

exports.getOrderHash = _getOrderHash;
function _packOrder(order) {
    try {
        _validator2.default.validate({ value: order, type: 'RAW_Order' });
    } catch (e) {
        return new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg);
    }
    var orderTypes = ['address', 'address', 'address', 'address', 'address', 'address', 'uint', 'uint', 'uint', 'uint', 'uint', 'bool', 'uint8'];
    var orderData = [order.delegateAddress, order.owner, order.tokenS, order.tokenB, order.walletAddress, order.authAddr, (0, _formatter.toBN)(order.amountS), (0, _formatter.toBN)(order.amountB), (0, _formatter.toBN)(order.validSince), (0, _formatter.toBN)(order.validUntil), (0, _formatter.toBN)(order.lrcFee), order.buyNoMoreThanAmountB, order.marginSplitPercentage];

    return (0, _ethereumjsAbi.solidityPack)(orderTypes, orderData);
}

/**
 * @description Submit some datas to relay that will store in a short term (24H)
 * @param host
 * @param key
 * @param value
 * @returns {Promise.<*>}
 */
exports.packOrder = _packOrder;
function _setTempStore(host, key, value) {
    try {
        _validator2.default.validate({ value: key, type: 'STRING' });
        _validator2.default.validate({ value: value, type: 'STRING' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_setTempStore';
    body.params = [{ key: key, value: value }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

exports.setTempStore = _setTempStore;
function _getTempStore(host, filter) {
    var body = {};
    body.method = 'loopring_getTempStore';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
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
exports.getTempStore = _getTempStore;
function _cancelOrder(host, _ref) {
    var sign = _ref.sign,
        orderHash = _ref.orderHash,
        tokenS = _ref.tokenS,
        tokenB = _ref.tokenB,
        cutoff = _ref.cutoff,
        type = _ref.type;
    var owner = sign.owner,
        r = sign.r,
        s = sign.s,
        v = sign.v;

    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: v, type: 'NUM' });
        _validator2.default.validate({ value: s, type: 'ETH_DATA' });
        _validator2.default.validate({ value: r, type: 'ETH_DATA' });
        _validator2.default.validate({ value: type, type: 'CANCEL_ORDER_TYPE' });
        switch (type) {
            case 1:
                _validator2.default.validate({ value: orderHash, type: 'ETH_DATA' });
                break;
            case 2:
                break;
            case 3:
                _validator2.default.validate({ value: cutoff, type: 'NUM' });
                break;
            case 4:
                _validator2.default.validate({ value: tokenS, type: 'ETH_ADDRESS' });
                _validator2.default.validate({ value: tokenB, type: 'ETH_ADDRESS' });
                break;
            default:
        }
        var body = {};
        body.method = 'loopring_flexCancelOrder';
        body.params = [{ sign: sign, orderHash: orderHash, tokenS: tokenS, tokenB: tokenB, cutoff: cutoff, type: type }];
        body.id = (0, _request.id)();
        body.jsonrpc = '2.0';
        return (0, _request2.default)(host, {
            method: 'post',
            body: body
        });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
}

exports.cancelOrder = _cancelOrder;
function _getUnmergedOrderBook(host, filter) {
    var delegateAddress = filter.delegateAddress;

    _validator2.default.validate({ value: delegateAddress, type: 'ETH_ADDRESS' });
    var body = {};
    body.method = 'loopring_getUnmergedOrderBook';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

exports.getUnmergedOrderBook = _getUnmergedOrderBook;
function _getOrderByHash(host, filter) {
    var body = {};
    body.method = 'loopring_getOrderByHash';
    body.params = [{ orderHash: filter.orderHash }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}
exports.getOrderByHash = _getOrderByHash;
function _getContracts(host) {
    var body = {};
    body.method = 'loopring_getContracts';
    body.params = [{}];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}
exports.getContracts = _getContracts;