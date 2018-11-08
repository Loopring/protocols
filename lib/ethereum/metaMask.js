'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.signEthereumTx = exports.sign = undefined;

/**
 * @description sign hash
 * @param web3
 * @param account
 * @param hash
 * @returns {Promise.<*>}
 */
var sign = exports.sign = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(web3, account, hash) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.prev = 0;

                        _validator2.default.validate({ value: account, type: 'ETH_ADDRESS' });
                        _context.next = 7;
                        break;

                    case 4:
                        _context.prev = 4;
                        _context.t0 = _context['catch'](0);
                        return _context.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 7:
                        if (!(web3 && web3.eth.accounts[0])) {
                            _context.next = 11;
                            break;
                        }

                        return _context.abrupt('return', new Promise(function (resolve) {
                            web3.eth.sign(account, hash, function (err, result) {
                                if (!err) {
                                    var r = result.slice(0, 66);
                                    var s = (0, _formatter.addHexPrefix)(result.slice(66, 130));
                                    var v = (0, _formatter.toNumber)((0, _formatter.addHexPrefix)(result.slice(130, 132)));
                                    resolve({ result: { r: r, s: s, v: v } });
                                } else {
                                    var errorMsg = err.message.substring(0, err.message.indexOf(' at '));
                                    resolve({ error: { message: errorMsg } });
                                }
                            });
                        }));

                    case 11:
                        throw new Error('Not found MetaMask');

                    case 12:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this, [[0, 4]]);
    }));

    return function sign(_x, _x2, _x3) {
        return _ref.apply(this, arguments);
    };
}();

/**
 * @description sign message
 * @param web3
 * @param account
 * @param message
 * @returns {Promise}
 */


/**
 * @description Signs ethereum tx
 * @param web3
 * @param account
 * @param rawTx
 * @returns {Promise.<*>}
 */
var signEthereumTx = exports.signEthereumTx = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(web3, account, rawTx) {
        var ethTx, hash, response, signature;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.prev = 0;

                        _validator2.default.validate({ value: rawTx, type: 'TX' });
                        _context2.next = 7;
                        break;

                    case 4:
                        _context2.prev = 4;
                        _context2.t0 = _context2['catch'](0);
                        return _context2.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 7:
                        ethTx = new _ethereumjsTx2.default(rawTx);
                        hash = (0, _formatter.toHex)(ethTx.hash(false));
                        _context2.next = 11;
                        return sign(web3, account, hash);

                    case 11:
                        response = _context2.sent;

                        if (response.error) {
                            _context2.next = 19;
                            break;
                        }

                        signature = response.result;

                        signature.v += ethTx._chainId * 2 + 8;
                        Object.assign(ethTx, signature);
                        return _context2.abrupt('return', { result: (0, _formatter.toHex)(ethTx.serialize()) });

                    case 19:
                        return _context2.abrupt('return', response);

                    case 20:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this, [[0, 4]]);
    }));

    return function signEthereumTx(_x4, _x5, _x6) {
        return _ref2.apply(this, arguments);
    };
}();

/**
 * @description Sends ethereum tx through MetaMask
 * @param web3
 * @param tx
 * @returns {*}
 */


exports.signMessage = signMessage;
exports.sendTransaction = sendTransaction;

var _validator = require('./validator');

var _validator2 = _interopRequireDefault(_validator);

var _response = require('../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../common/code');

var _code2 = _interopRequireDefault(_code);

var _formatter = require('../common/formatter');

var _ethereumjsUtil = require('ethereumjs-util');

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function signMessage(web3, account, message) {
    var hash = (0, _formatter.toHex)((0, _ethereumjsUtil.hashPersonalMessage)((0, _ethereumjsUtil.sha3)(message)));
    return sign(web3, account, hash);
}function sendTransaction(web3, tx) {
    try {
        _validator2.default.validate({ type: 'TX', value: tx });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    if (web3 && web3.eth.accounts[0]) {
        return new Promise(function (resolve) {
            web3.eth.sendTransaction(tx, function (err, transactionHash) {
                if (!err) {
                    resolve({ result: transactionHash });
                } else {
                    var errorMsg = err.message.substring(0, err.message.indexOf(' at '));
                    resolve({ error: { message: errorMsg } });
                }
            });
        });
    } else {
        throw new Error('Not found MetaMask');
    }
}