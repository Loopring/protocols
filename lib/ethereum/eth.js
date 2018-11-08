'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.call = exports.getTransactionByhash = exports.getAccountBalance = exports.estimateGas = exports.getGasPrice = exports.sendRawTransaction = exports.getTransactionCount = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _validator = require('./validator');

var _validator2 = _interopRequireDefault(_validator);

var _request = require('../common/request');

var _request2 = _interopRequireDefault(_request);

var _response = require('../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../common/code');

var _code2 = _interopRequireDefault(_code);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Eth = function () {
    function Eth(host) {
        _classCallCheck(this, Eth);

        this.host = host;
    }

    _createClass(Eth, [{
        key: 'getTransactionCount',
        value: function getTransactionCount(_ref) {
            var address = _ref.address,
                tag = _ref.tag;

            return _getTransactionCount(this.host, { address: address, tag: tag });
        }
    }, {
        key: 'sendRawTransaction',
        value: function sendRawTransaction(signedTx) {
            return _sendRawTransaction(this.host, signedTx);
        }
    }, {
        key: 'getGasPrice',
        value: function getGasPrice() {
            return _getGasPrice(this.host);
        }
    }, {
        key: 'estimateGas',
        value: function estimateGas(tx) {
            return _estimateGas(this.host, tx);
        }
    }, {
        key: 'getAccountBalance',
        value: function getAccountBalance(_ref2) {
            var address = _ref2.address,
                tag = _ref2.tag;

            return _getAccountBalance(this.host, { address: address, tag: tag });
        }
    }, {
        key: 'getTransactionByhash',
        value: function getTransactionByhash(txHash) {
            return _getTransactionByhash(this.host, txHash);
        }
    }, {
        key: 'call',
        value: function call(_ref3) {
            var tx = _ref3.tx,
                tag = _ref3.tag;

            return _call(this.host, { tx: tx, tag: tag });
        }
    }]);

    return Eth;
}();

/**
 * @description Returns the number of transactions sent from an address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */


exports.default = Eth;
function _getTransactionCount(host, _ref4) {
    var address = _ref4.address,
        tag = _ref4.tag;

    tag = tag || 'pending';
    try {
        _validator2.default.validate({ value: address, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: tag, type: 'RPC_TAG' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var params = [address, tag];
    var body = {};
    body.method = 'eth_getTransactionCount';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Sends signed ethereum tx
 * @param host
 * @param signedTx
 * @returns {Promise}
 */
exports.getTransactionCount = _getTransactionCount;
function _sendRawTransaction(host, signedTx) {
    var body = {};
    body.method = 'eth_sendRawTransaction';
    body.params = [signedTx];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Returns the current price per gas in wei.
 * @param host
 * @returns {Promise}
 */
exports.sendRawTransaction = _sendRawTransaction;
function _getGasPrice(host) {
    var params = [];
    var body = {};
    body.method = 'eth_gasPrice';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Generates and returns an estimate of how much gas is necessary to allow the transaction to complete.
 * @param host
 * @param tx
 * @returns {Promise}
 */
exports.getGasPrice = _getGasPrice;
function _estimateGas(host, tx) {
    var body = {};
    body.method = 'eth_estimateGas';
    body.params = [tx];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Returns the ethereum balance of the account of given address.
 * @param host
 * @param address
 * @param tag
 * @returns {Promise}
 */
exports.estimateGas = _estimateGas;
function _getAccountBalance(host, _ref5) {
    var address = _ref5.address,
        tag = _ref5.tag;

    tag = tag || 'latest';
    if (tag) {
        try {
            _validator2.default.validate({ value: tag, type: 'RPC_TAG' });
            _validator2.default.validate({ value: address, type: 'ETH_ADDRESS' });
        } catch (e) {
            return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
        }
    }
    var params = [address, tag];
    var body = {};
    body.method = 'eth_getBalance';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Returns the information about a transaction requested by transaction hash.
 * @param host
 * @param hash ethereum tx hash
 * @returns {Promise}
 */
exports.getAccountBalance = _getAccountBalance;
function _getTransactionByhash(host, hash) {
    try {
        _validator2.default.validate({ value: hash, type: 'ETH_DATA' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var params = [hash];
    var body = {};
    body.method = 'eth_getTransactionByHash';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Executes a new message call immediately without creating a transaction on the block chain.
 * @param host
 * @param tx
 * @param tag
 * @returns {Promise}
 */
exports.getTransactionByhash = _getTransactionByhash;
function _call(host, _ref6) {
    var tx = _ref6.tx,
        tag = _ref6.tag;

    tag = tag || 'latest';
    if (tag) {
        try {
            _validator2.default.validate({ value: tag, type: 'RPC_TAG' });
        } catch (e) {
            return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
        }
    }
    var params = [tx, tag];
    var body = {};
    body.method = 'eth_call';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}
exports.call = _call;