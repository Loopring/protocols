'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.notifyCircular = exports.notifyScanLogin = exports.getAllEstimatedAllocatedAmount = exports.getNonce = exports.getGasPrice = exports.getPendingRawTxByHash = exports.getPortfolio = exports.getOldWethBalance = exports.getFrozenLrcFee = exports.getEstimatedAllocatedAllowance = exports.getTransactions = exports.notifyTransactionSubmitted = exports.register = exports.getBalance = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

/**
 * Get network gasPrice that relay computes
 * @returns {Promise}
 */
var _getGasPrice = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(host) {
        var body;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        body = {};

                        body.method = 'loopring_getEstimateGasPrice';
                        body.params = [{}];
                        body.id = (0, _request.id)();
                        body.jsonrpc = '2.0';
                        return _context.abrupt('return', (0, _request2.default)(host, {
                            method: 'post',
                            body: body
                        }));

                    case 6:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function _getGasPrice(_x) {
        return _ref2.apply(this, arguments);
    };
}();

/**
 * Get nonce of given address
 * @returns {Promise}
 */


var _getNonce = function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(host, owner) {
        var body;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
                switch (_context2.prev = _context2.next) {
                    case 0:
                        _context2.prev = 0;

                        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
                        _context2.next = 7;
                        break;

                    case 4:
                        _context2.prev = 4;
                        _context2.t0 = _context2['catch'](0);
                        return _context2.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 7:
                        body = {};

                        body.method = 'loopring_getNonce';
                        body.params = [{ owner: owner }];
                        body.id = (0, _request.id)();
                        body.jsonrpc = '2.0';
                        return _context2.abrupt('return', (0, _request2.default)(host, {
                            method: 'post',
                            body: body
                        }));

                    case 13:
                    case 'end':
                        return _context2.stop();
                }
            }
        }, _callee2, this, [[0, 4]]);
    }));

    return function _getNonce(_x2, _x3) {
        return _ref3.apply(this, arguments);
    };
}();
/**
 *
 * @param host
 * @param owner
 * @param delegateAddress
 * @return {Promise.<*>}
 */


var _getAllEstimatedAllocatedAmount = function () {
    var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(host, _ref4) {
        var owner = _ref4.owner,
            delegateAddress = _ref4.delegateAddress;
        var body;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
                switch (_context3.prev = _context3.next) {
                    case 0:
                        _context3.prev = 0;

                        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
                        _validator2.default.validate({ value: delegateAddress, type: 'ETH_ADDRESS' });
                        _context3.next = 8;
                        break;

                    case 5:
                        _context3.prev = 5;
                        _context3.t0 = _context3['catch'](0);
                        return _context3.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 8:
                        body = {};

                        body.method = 'loopring_getAllEstimatedAllocatedAmount';
                        body.params = [{ owner: owner, delegateAddress: delegateAddress }];
                        body.id = (0, _request.id)();
                        body.jsonrpc = '2.0';
                        return _context3.abrupt('return', (0, _request2.default)(host, {
                            method: 'post',
                            body: body
                        }));

                    case 14:
                    case 'end':
                        return _context3.stop();
                }
            }
        }, _callee3, this, [[0, 5]]);
    }));

    return function _getAllEstimatedAllocatedAmount(_x4, _x5) {
        return _ref5.apply(this, arguments);
    };
}();

var _notifyScanLogin = function () {
    var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(host, content) {
        var _content$sign, owner, r, s, v, body;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
                switch (_context4.prev = _context4.next) {
                    case 0:
                        _context4.prev = 0;
                        _content$sign = content.sign, owner = _content$sign.owner, r = _content$sign.r, s = _content$sign.s, v = _content$sign.v;

                        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
                        _validator2.default.validate({ value: v, type: 'NUM' });
                        _validator2.default.validate({ value: s, type: 'ETH_DATA' });
                        _validator2.default.validate({ value: r, type: 'ETH_DATA' });
                        body = {};

                        body.method = 'loopring_notifyScanLogin';
                        body.params = [_extends({}, content)];
                        body.id = (0, _request.id)();
                        body.jsonrpc = '2.0';
                        return _context4.abrupt('return', (0, _request2.default)(host, {
                            method: 'post',
                            body: body
                        }));

                    case 14:
                        _context4.prev = 14;
                        _context4.t0 = _context4['catch'](0);
                        return _context4.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 17:
                    case 'end':
                        return _context4.stop();
                }
            }
        }, _callee4, this, [[0, 14]]);
    }));

    return function _notifyScanLogin(_x6, _x7) {
        return _ref6.apply(this, arguments);
    };
}();

var _notifyCircular = function () {
    var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(host, content) {
        var body;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
                switch (_context5.prev = _context5.next) {
                    case 0:
                        _context5.prev = 0;
                        body = {};

                        body.method = 'loopring_notifyCirculr';
                        body.params = [_extends({}, content)];
                        body.id = (0, _request.id)();
                        body.jsonrpc = '2.0';
                        return _context5.abrupt('return', (0, _request2.default)(host, {
                            method: 'post',
                            body: body
                        }));

                    case 9:
                        _context5.prev = 9;
                        _context5.t0 = _context5['catch'](0);
                        return _context5.abrupt('return', Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg)));

                    case 12:
                    case 'end':
                        return _context5.stop();
                }
            }
        }, _callee5, this, [[0, 9]]);
    }));

    return function _notifyCircular(_x8, _x9) {
        return _ref7.apply(this, arguments);
    };
}();

var _request = require('../../common/request');

var _request2 = _interopRequireDefault(_request);

var _validator = require('../validator');

var _validator2 = _interopRequireDefault(_validator);

var _response = require('../../common/response');

var _response2 = _interopRequireDefault(_response);

var _code = require('../../common/code');

var _code2 = _interopRequireDefault(_code);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Account = function () {
    function Account(host) {
        _classCallCheck(this, Account);

        this.host = host;
    }

    _createClass(Account, [{
        key: 'getBalance',
        value: function getBalance(filter) {
            return _getBalance(this.host, filter);
        }
    }, {
        key: 'register',
        value: function register(owner) {
            return _register(this.host, owner);
        }
    }, {
        key: 'notifyTransactionSubmitted',
        value: function notifyTransactionSubmitted(filter) {
            return _notifyTransactionSubmitted(this.host, filter);
        }
    }, {
        key: 'getTransactions',
        value: function getTransactions(filter) {
            return _getTransactions(this.host, filter);
        }
    }, {
        key: 'getEstimatedAllocatedAllowance',
        value: function getEstimatedAllocatedAllowance(filter) {
            return _getEstimatedAllocatedAllowance(this.host, filter);
        }
    }, {
        key: 'getFrozenLrcFee',
        value: function getFrozenLrcFee(owner) {
            return _getFrozenLrcFee(this.host, owner);
        }
    }, {
        key: 'getOldWethBalance',
        value: function getOldWethBalance(owner) {
            return _getOldWethBalance(this.host, owner);
        }
    }, {
        key: 'getPortfolio',
        value: function getPortfolio(owner) {
            return _getPortfolio(this.host, owner);
        }
    }, {
        key: 'getPendingRawTxByHash',
        value: function getPendingRawTxByHash(txHash) {
            return _getPendingRawTxByHash(this.host, txHash);
        }
    }, {
        key: 'getGasPrice',
        value: function getGasPrice() {
            return _getGasPrice(this.host);
        }
    }, {
        key: 'getNonce',
        value: function getNonce(owner) {
            return _getNonce(this.host, owner);
        }
    }, {
        key: 'getAllEstimatedAllocatedAmount',
        value: function getAllEstimatedAllocatedAmount(params) {
            return _getAllEstimatedAllocatedAmount(this.host, params);
        }
    }, {
        key: 'notifyScanLogin',
        value: function notifyScanLogin(content) {
            return _notifyScanLogin(this.host, content);
        }
    }, {
        key: 'notifyCircular',
        value: function notifyCircular(content) {
            return _notifyCircular(this.host, content);
        }
    }]);

    return Account;
}();

/**
 * @description Get user's balance and token allowance info.
 * @param host
 * @param contractVersion
 * @param owner
 * @returns {Promise.<*>}
 */


exports.default = Account;
function _getBalance(host, filter) {
    var delegateAddress = filter.delegateAddress,
        owner = filter.owner;

    try {
        _validator2.default.validate({ value: delegateAddress, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getBalance';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Notify the relay the unlocked wallet info.
 * @param host
 * @param owner
 * @returns {Promise}
 */
exports.getBalance = _getBalance;
function _register(host, owner) {
    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_unlockWallet';
    body.params = [{ owner: owner }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Wallet should notify relay there was a transaction sending to eth network,
 * then relay will get and save the pending transaction immediately.
 * @param host
 * @param txHash
 * @param rawTx
 * @param from
 * @returns {Promise.<*>}
 */
exports.register = _register;
function _notifyTransactionSubmitted(host, _ref) {
    var txHash = _ref.txHash,
        rawTx = _ref.rawTx,
        from = _ref.from;

    try {
        _validator2.default.validate({ value: from, type: 'ETH_ADDRESS' });
        _validator2.default.validate({ value: rawTx, type: 'TX' });
        _validator2.default.validate({ value: txHash, type: 'HASH' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var nonce = rawTx.nonce,
        to = rawTx.to,
        value = rawTx.value,
        gasPrice = rawTx.gasPrice,
        gasLimit = rawTx.gasLimit,
        data = rawTx.data;

    var body = {};
    body.method = 'loopring_notifyTransactionSubmitted';
    body.params = [{ hash: txHash, nonce: nonce, to: to, value: value, gasPrice: gasPrice, gas: gasLimit, input: data, from: from }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get user's  transactions by given filter.
 * @param host
 * @param filter
 * @returns {Promise.<*>}
 */
exports.notifyTransactionSubmitted = _notifyTransactionSubmitted;
function _getTransactions(host, filter) {
    var owner = filter.owner,
        status = filter.status,
        thxHash = filter.thxHash,
        pageIndex = filter.pageIndex,
        pageSize = filter.pageSize,
        symbol = filter.symbol;

    status = status || 'pending';
    try {
        _validator2.default.validate({ value: symbol, type: 'STRING' });
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
        if (status) {
            _validator2.default.validate({ value: status, type: 'RPC_TAG' });
        }

        if (thxHash) {
            _validator2.default.validate({ value: thxHash, type: 'HASH' });
        }
        if (pageIndex) {
            _validator2.default.validate({ value: pageIndex, type: 'OPTION_NUMBER' });
        }
        if (pageSize) {
            _validator2.default.validate({ value: pageSize, type: 'OPTION_NUMBER' });
        }
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getTransactions';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get the total frozen amount of all unfinished orders
 * @param host
 * @param filter
 * @returns {Promise}
 */
exports.getTransactions = _getTransactions;
function _getEstimatedAllocatedAllowance(host, filter) {
    var owner = filter.owner;

    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getEstimatedAllocatedAllowance';
    body.params = [_extends({}, filter)];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get the total frozen LRC fee amount of all unfinished orders
 * @param host
 * @param owner
 * @returns {Promise}
 */
exports.getEstimatedAllocatedAllowance = _getEstimatedAllocatedAllowance;
function _getFrozenLrcFee(host, owner) {
    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getFrozenLRCFee';
    body.params = [{ owner: owner }];
    body.id = (0, _request.id)();
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description get Ether Token (WETH) balance of given owner, contract Address:0x2956356cD2a2bf3202F771F50D3D14A367b48070
 *@param host
 * @param owner
 * @returns {Promise.<*>}
 */
exports.getFrozenLrcFee = _getFrozenLrcFee;
function _getOldWethBalance(host, owner) {
    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getOldVersionWethBalance';
    body.params = [{ owner: owner }];
    body.id = (0, _request.id)();
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * @description Get user's portfolio info.
 * @param host
 * @param owner
 * @returns {*}
 */
exports.getOldWethBalance = _getOldWethBalance;
function _getPortfolio(host, owner) {
    try {
        _validator2.default.validate({ value: owner, type: 'ETH_ADDRESS' });
    } catch (e) {
        return Promise.resolve(new _response2.default(_code2.default.PARAM_INVALID.code, _code2.default.PARAM_INVALID.msg));
    }
    var body = {};
    body.method = 'loopring_getPortfolio';
    body.params = [{ owner: owner }];
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}

/**
 * Gets pending tx detail that sent to relay
 * @param host
 * @param txHash
 * @returns {Promise}
 */
exports.getPortfolio = _getPortfolio;
function _getPendingRawTxByHash(host, txHash) {
    try {
        _validator2.default.validate({ value: txHash, type: 'HASH' });
    } catch (e) {
        throw new Error('Invalid tx hash');
    }
    var params = [{ thxHash: txHash }];
    var body = {};
    body.method = 'loopring_getPendingRawTxByHash';
    body.params = params;
    body.id = (0, _request.id)();
    body.jsonrpc = '2.0';
    return (0, _request2.default)(host, {
        method: 'post',
        body: body
    });
}exports.getPendingRawTxByHash = _getPendingRawTxByHash;
exports.getGasPrice = _getGasPrice;
exports.getNonce = _getNonce;
exports.getAllEstimatedAllocatedAmount = _getAllEstimatedAllocatedAmount;
exports.notifyScanLogin = _notifyScanLogin;
exports.notifyCircular = _notifyCircular;