'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.getXPubKey = exports.signEthereumTx = exports.signMessage = exports.getAddress = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * @description Returns ethereum address of given dpath
 * @param dpath
 * @returns {Promise}
 */
var getAddress = exports.getAddress = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(dpath) {
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        if (!dpath) {
                            _context.next = 4;
                            break;
                        }

                        return _context.abrupt('return', new Promise(function (resolve) {
                            _trezorConnect.TrezorConnect.ethereumGetAddress(dpath, function (result) {
                                if (result.success) {
                                    resolve({ result: (0, _formatter.formatAddress)(result.address) });
                                } else {
                                    resolve({ error: result.error });
                                }
                            });
                        }));

                    case 4:
                        throw new Error('dpath can\'t be null');

                    case 5:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function getAddress(_x) {
        return _ref.apply(this, arguments);
    };
}();

/**
 * @description sign message, can only be verified by TREZOR.
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @param message string
 * @returns {Promise}
 */


var signMessage = exports.signMessage = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(dpath, message) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        if (!dpath) {
                            _context2.next = 4;
                            break;
                        }

                        return _context2.abrupt('return', new Promise(function (resolve) {
                            _trezorConnect.TrezorConnect.ethereumSignMessage(dpath, message, function (result) {
                                if (result.success) {
                                    var sig = result.signature;
                                    var r = (0, _formatter.addHexPrefix)(sig.slice(0, 64));
                                    var s = (0, _formatter.addHexPrefix)(sig.slice(64, 128));
                                    var v = (0, _formatter.toNumber)(sig.slice(128, 130));
                                    resolve({ result: { r: r, s: s, v: v } });
                                } else {
                                    resolve({ error: result.error });
                                }
                            });
                        }));

                    case 4:
                        throw new Error('dpath can\'t be null');

                    case 5:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this);
    }));

    return function signMessage(_x2, _x3) {
        return _ref2.apply(this, arguments);
    };
}();

/**
 * @description  sign ethereum tx
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @param rawTx
 * @returns {Promise}
 */


var signEthereumTx = exports.signEthereumTx = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(dpath, rawTx) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        if (!dpath) {
                            _context3.next = 4;
                            break;
                        }

                        return _context3.abrupt('return', new Promise(function (resolve) {
                            var tx = [rawTx.nonce, rawTx.gasPrice, rawTx.gasLimit, rawTx.to, rawTx.value === '' ? '' : rawTx.value, rawTx.data].map(function (item) {
                                return (0, _formatter.padLeftEven)((0, _formatter.clearHexPrefix)(item).toLowerCase());
                            });
                            _trezorConnect.TrezorConnect.ethereumSignTx.apply(_trezorConnect.TrezorConnect, [dpath].concat(_toConsumableArray(tx), [rawTx.chainId, function (result) {
                                if (result.success) {
                                    var ethTx = new _ethereumjsTx2.default(_extends({}, rawTx, {
                                        v: (0, _formatter.addHexPrefix)(new _bn2.default(result.v).toString(16)),
                                        s: (0, _formatter.addHexPrefix)(result.s),
                                        r: (0, _formatter.addHexPrefix)(result.r)
                                    }));
                                    resolve({ result: (0, _formatter.toHex)(ethTx.serialize()) });
                                } else {
                                    resolve({ error: result.error });
                                }
                            }]));
                        }));

                    case 4:
                        throw new Error('dpath can\'t be null');

                    case 5:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this);
    }));

    return function signEthereumTx(_x4, _x5) {
        return _ref3.apply(this, arguments);
    };
}();

/**
 * Returns publicKey and chainCode
 * @param dpath string | array,  examples: "m/44'/60'/0'/0" or [44 | 0x80000000,60 | 0x80000000,0  | 0x80000000,0 ];
 * @returns {Promise}
 */


var getXPubKey = exports.getXPubKey = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(dpath) {
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        if (!dpath) {
                            _context4.next = 4;
                            break;
                        }

                        return _context4.abrupt('return', new Promise(function (resolve) {
                            _trezorConnect.TrezorConnect.setCurrency('BTC');
                            _trezorConnect.TrezorConnect.getXPubKey(dpath, function (result) {
                                if (result.success) {
                                    resolve({ result: result });
                                } else {
                                    resolve({ error: result.error });
                                }
                            });
                        }));

                    case 4:
                        throw new Error('dpath can\'t be null');

                    case 5:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function getXPubKey(_x6) {
        return _ref4.apply(this, arguments);
    };
}();

var _trezorConnect = require('../common/trezor-connect');

var _formatter = require('../common/formatter');

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

var _bn = require('bn.js');

var _bn2 = _interopRequireDefault(_bn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            * help website: https://github.com/trezor/connect
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            */