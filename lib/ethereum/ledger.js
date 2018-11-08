'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.signEthereumTx = exports.signMessage = exports.getXPubKey = exports.connect = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/**
 * @description connect to Ledger
 * @returns {Promise}
 */
var connect = exports.connect = function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        return _context.abrupt('return', new Promise(function (resolve) {
                            _ledgerco2.default.comm_u2f.create_async().then(function (comm) {
                                try {
                                    resolve({ result: new _ledgerco2.default.eth(comm) });
                                } catch (e) {
                                    resolve({ error: { message: e.message } });
                                }
                            });
                        }));

                    case 1:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function connect() {
        return _ref.apply(this, arguments);
    };
}();

/**
 * @description Returns publicKey , chainCode and address
 * @param dpath string
 * @param ledgerConnect
 * @returns {Promise}
 */


var getXPubKey = exports.getXPubKey = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(dpath, ledgerConnect) {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        if (!dpath) {
                            _context2.next = 4;
                            break;
                        }

                        return _context2.abrupt('return', new Promise(function (resolve) {
                            ledgerConnect.getAddress_async(dpath, false, true).then(function (res) {
                                resolve({ result: res });
                            }).catch(function (err) {
                                resolve({ error: err });
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

    return function getXPubKey(_x, _x2) {
        return _ref2.apply(this, arguments);
    };
}();

/**
 * @description sign message
 * @param dpath string
 * @param message
 * @param ledgerConnect
 * @returns {Promise}
 */
var signMessage = exports.signMessage = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(dpath, message, ledgerConnect) {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        if (!dpath) {
                            _context3.next = 4;
                            break;
                        }

                        return _context3.abrupt('return', new Promise(function (resolve) {
                            ledgerConnect.signPersonalMessage_async(dpath, message).then(function (result) {
                                if (result.error) {
                                    return resolve({ error: result.error });
                                } else {
                                    resolve({ result: { v: result.v, r: (0, _formatter.addHexPrefix)(result.r), s: (0, _formatter.addHexPrefix)(result.s) } });
                                }
                            });
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

    return function signMessage(_x3, _x4, _x5) {
        return _ref3.apply(this, arguments);
    };
}();

/**
 * @description sign ethereum tx
 * @param dpath string
 * @param rawTx
 * @param ledgerConnect
 * @returns {Promise}
 */


var signEthereumTx = exports.signEthereumTx = function () {
    var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(dpath, rawTx, ledgerConnect) {
        var t;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        if (!dpath) {
                            _context4.next = 9;
                            break;
                        }

                        _validator2.default.validate({ type: 'BASIC_TX', value: rawTx });
                        t = new _ethereumjsTx2.default(rawTx);

                        t.v = (0, _formatter.toBuffer)([t._chainId]);
                        t.r = (0, _formatter.toBuffer)(0);
                        t.s = (0, _formatter.toBuffer)(0);
                        return _context4.abrupt('return', new Promise(function (resolve) {
                            ledgerConnect.signTransaction_async(dpath, t.serialize().toString('hex')).then(function (result) {
                                var strTx = getTransactionFields(t);
                                var txToSerialize = _extends({}, strTx, {
                                    v: (0, _formatter.addHexPrefix)(result.v),
                                    r: (0, _formatter.addHexPrefix)(result.r),
                                    s: (0, _formatter.addHexPrefix)(result.s)
                                });
                                var ethTx = new _ethereumjsTx2.default(txToSerialize);
                                var serializedTx = (0, _formatter.toHex)(ethTx.serialize());
                                resolve({ result: serializedTx });
                            }).catch(function (err) {
                                return resolve({ error: { message: err.message + ' . Check to make sure contract data is on' } });
                            });
                        }));

                    case 9:
                        throw new Error('dpath can\'t be null');

                    case 10:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this);
    }));

    return function signEthereumTx(_x6, _x7, _x8) {
        return _ref4.apply(this, arguments);
    };
}();

var _ledgerco = require('ledgerco');

var _ledgerco2 = _interopRequireDefault(_ledgerco);

var _formatter = require('../common/formatter');

var _trimStart = require('lodash/trimStart');

var _trimStart2 = _interopRequireDefault(_trimStart);

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

var _validator = require('./validator');

var _validator2 = _interopRequireDefault(_validator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function hexEncodeQuantity(value) {
    var trimmedValue = (0, _trimStart2.default)(value.toString('hex'), '0');
    return (0, _formatter.addHexPrefix)(trimmedValue === '' ? '0' : trimmedValue);
}

function hexEncodeData(value) {
    return (0, _formatter.toHex)((0, _formatter.toBuffer)(value));
}

function getTransactionFields(t) {
    var data = t.data,
        gasLimit = t.gasLimit,
        gasPrice = t.gasPrice,
        to = t.to,
        nonce = t.nonce,
        value = t.value;

    var chainId = t.getChainId();
    return {
        value: hexEncodeQuantity(value),
        data: hexEncodeData(data),
        to: hexEncodeData(to),
        nonce: hexEncodeQuantity(nonce),
        gasPrice: hexEncodeQuantity(gasPrice),
        gasLimit: hexEncodeQuantity(gasLimit),
        chainId: chainId
    };
}