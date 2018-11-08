'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.submitRingForP2P = exports.getRingHash = exports.getFills = exports.getRingMinedDetail = exports.getRings = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.feeSelectionListToNumber = feeSelectionListToNumber;

var _request = require('../../common/request');

var _request2 = _interopRequireDefault(_request);

var _validator = require('../validator');

var _validator2 = _interopRequireDefault(_validator);

var _response = require('../../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../../common/code');

var _code2 = _interopRequireDefault(_code);

var _formatter = require('../../common/formatter');

var _order = require('./order');

var _ethereumjsAbi = require('ethereumjs-abi');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Ring = function () {
    function Ring(host) {
        _classCallCheck(this, Ring);

        this.host = host;
    }

    _createClass(Ring, [{
        key: 'getRings',
        value: function getRings(filter) {
            return _getRings(this.host, filter);
        }
    }, {
        key: 'getRingMinedDetail',
        value: function getRingMinedDetail(filter) {
            return _getRingMinedDetail(this.host, filter);
        }
    }, {
        key: 'getFills',
        value: function getFills(filter) {
            return _getFills(this.host, filter);
        }
    }, {
        key: 'getRingHash',
        value: function getRingHash(orders, feeRecipient, feeSelections) {
            return _getRingHash(orders, feeRecipient, feeSelections);
        }
    }, {
        key: 'submitRingForP2P',
        value: function submitRingForP2P(filter) {
            return _submitRingForP2P(this.host, filter);
        }
    }]);

    return Ring;
}();

/**
 * @description Get all mined rings.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */


exports.default = Ring;
function _getRings(host, filter) {
    try {
        if (filter && filter.delegateAddress) {
            _validator2.default.validate({ value: filter.delegateAddress, type: 'ETH_ADDRESS' });
        }

        if (filter && filter.pageIndex) {
            _validator2.default.validate({ value: filter.pageIndex, type: 'OPTION_NUMBER' });
        }
        if (filter && filter.pageSize) {
            _validator2.default.validate({ value: filter.pageSize, type: 'OPTION_NUMBER' });
        }
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getRingMined';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get ring mined detail
 * @param host
 * @param filter
 * @returns {Promise}
 */
exports.getRings = _getRings;
function _getRingMinedDetail(host, filter) {
    var ringIndex = filter.ringIndex,
        delegateAddress = filter.delegateAddress;

    try {
        _validator2.default.validate({ value: delegateAddress, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    ringIndex = (0, _formatter.toHex)((0, _formatter.toBig)(ringIndex));
    var body = {};
    body.method = 'loopring_getRingMinedDetail';
    body.params = [_extends({}, filter, { ringIndex: ringIndex })];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get order fill history. This history consists of OrderFilled events.
 * @param host
 * @param filter {market, owner, delegateAddress, orderHash, ringHash,pageIndex,pageSize}
 * @returns {Promise}
 */
exports.getRingMinedDetail = _getRingMinedDetail;
function _getFills(host, filter) {
    try {
        if (filter.delegateAddress) {
            _validator2.default.validate({ value: filter.delegateAddress, type: 'ETH_ADDRESS' });
        }
        if (filter.owner) {
            _validator2.default.validate({ value: filter.owner, type: 'ETH_ADDRESS' });
        }
        if (filter.orderHash) {
            _validator2.default.validate({ value: filter.orderHash, type: 'HASH' });
        }
        if (filter.ringHash) {
            _validator2.default.validate({ value: filter.ringHash, type: 'HASH' });
        }
        if (filter.pageIndex) {
            _validator2.default.validate({ value: filter.pageIndex, type: 'OPTION_NUMBER' });
        }
        if (filter.pageSize) {
            _validator2.default.validate({ value: filter.pageSize, type: 'OPTION_NUMBER' });
        }
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getFills';
    body.params = [filter];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

exports.getFills = _getFills;
function _getRingHash(orders, feeRecipient, feeSelections) {
    var orderHashList = orders.map(function (order) {
        return (0, _formatter.toHex)((0, _order.getOrderHash)(order));
    });
    return (0, _ethereumjsAbi.soliditySHA3)(['string', 'address', 'uint16'], [xorReduceStr(orderHashList), feeRecipient, feeSelectionListToNumber(feeSelections)]);
}

exports.getRingHash = _getRingHash;
function _submitRingForP2P(host, filter) {
    var takerOrderHash = filter.takerOrderHash,
        makerOrderHash = filter.makerOrderHash;

    _validator2.default.validate({ value: takerOrderHash, type: 'HASH' });
    _validator2.default.validate({ value: makerOrderHash, type: 'HASH' });
    var body = {};
    body.method = 'loopring_submitRingForP2P';
    body.params = [filter];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

exports.submitRingForP2P = _submitRingForP2P;
function xorReduceStr(strArr) {
    var s0 = strArr[0];
    var tail = strArr.slice(1);
    var strXor = function strXor(s1, s2) {
        var buf1 = Buffer.from(s1.slice(2), 'hex');
        var buf2 = Buffer.from(s2.slice(2), 'hex');
        var res = Buffer.alloc(32);
        for (var i = 0; i < 32; i++) {
            res[i] = buf1[i] ^ buf2[i];
        }
        return (0, _formatter.toHex)(res);
    };
    var reduceRes = tail.reduce(function (a, b) {
        return strXor(a, b);
    }, s0);
    return Buffer.from(reduceRes.slice(2), 'hex');
}

function feeSelectionListToNumber(feeSelections) {
    var res = 0;
    for (var i = 0; i < feeSelections.length; i++) {
        res += feeSelections[i] << i;
    }

    return res;
}