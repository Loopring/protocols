'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.MetaMaskAccount = exports.LedgerAccount = exports.TrezorAccount = exports.KeyAccount = exports.Account = exports.fromLedger = exports.path = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var fromLedger = exports.fromLedger = function () {
    var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(dpath) {
        var response;
        return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
                switch (_context.prev = _context.next) {
                    case 0:
                        _context.next = 2;
                        return Ledger.connect();

                    case 2:
                        response = _context.sent;

                        if (!response.result) {
                            _context.next = 5;
                            break;
                        }

                        return _context.abrupt('return', new LedgerAccount(response.result, dpath));

                    case 5:
                        throw new Error(response.error.message);

                    case 6:
                    case 'end':
                        return _context.stop();
                }
            }
        }, _callee, this);
    }));

    return function fromLedger(_x) {
        return _ref2.apply(this, arguments);
    };
}();

exports.createWallet = createWallet;
exports.privateKeytoAddress = privateKeytoAddress;
exports.publicKeytoAddress = publicKeytoAddress;
exports.getAddresses = getAddresses;
exports.privateKeytoPublic = privateKeytoPublic;
exports.fromMnemonic = fromMnemonic;
exports.fromPrivateKey = fromPrivateKey;
exports.fromKeystore = fromKeystore;
exports.fromTrezor = fromTrezor;
exports.fromMetaMask = fromMetaMask;
exports.createMnemonic = createMnemonic;

var _validator = require('./validator');

var _validator2 = _interopRequireDefault(_validator);

var _formatter = require('../common/formatter');

var _keystore = require('./keystore');

var _ethereumjsUtil = require('ethereumjs-util');

var _mnemonic = require('./mnemonic');

var _bip = require('bip39');

var _utils = require('../common/utils');

var _hdkey = require('hdkey');

var _hdkey2 = _interopRequireDefault(_hdkey);

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

var _order = require('../relay/rpc/order');

var _trezor = require('./trezor');

var Trezor = _interopRequireWildcard(_trezor);

var _ledger = require('./ledger');

var Ledger = _interopRequireWildcard(_ledger);

var _metaMask = require('./metaMask');

var MetaMask = _interopRequireWildcard(_metaMask);

var _ethereumjsWallet = require('ethereumjs-wallet');

var _ethereumjsWallet2 = _interopRequireDefault(_ethereumjsWallet);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var wallets = require('../config/wallets.json');
var LoopringWallet = wallets.find(function (wallet) {
    return (0, _utils.trimAll)(wallet.name).toLowerCase() === 'loopringwallet';
});
var path = exports.path = LoopringWallet.dpath;

function createWallet() {
    return _ethereumjsWallet2.default.generate();
}

/**
 * @description Returns the ethereum address  of a given private key
 * @param privateKey
 * @returns {string}
 */
function privateKeytoAddress(privateKey) {
    try {
        if (typeof privateKey === 'string') {
            _validator2.default.validate({ value: privateKey, type: 'ETH_KEY' });
            privateKey = (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(privateKey));
        } else {
            _validator2.default.validate({ value: privateKey, type: 'PRIVATE_KEY_BUFFER' });
        }
    } catch (e) {
        throw new Error('Invalid private key');
    }
    return (0, _formatter.formatAddress)((0, _ethereumjsUtil.privateToAddress)(privateKey));
}

/**
 * @description Returns the ethereum address of a given public key.
 * Accepts "Ethereum public keys" and SEC1 encoded keys.
 * @param publicKey Buffer | string
 * @param sanitize bool [sanitize=false] Accept public keys in other formats
 * @returns {string}
 */
function publicKeytoAddress(publicKey, sanitize) {
    publicKey = (0, _formatter.toBuffer)(publicKey);
    return (0, _formatter.formatAddress)((0, _ethereumjsUtil.publicToAddress)(publicKey, sanitize));
}

/**
 *
 * @param publicKey
 * @param chainCode
 * @param pageSize
 * @param pageNum
 * @returns {<Array>}
 */
function getAddresses(_ref) {
    var publicKey = _ref.publicKey,
        chainCode = _ref.chainCode,
        pageSize = _ref.pageSize,
        pageNum = _ref.pageNum;

    var addresses = [];
    var hdk = new _hdkey2.default();
    hdk.publicKey = publicKey instanceof Buffer ? publicKey : (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(publicKey));
    hdk.chainCode = chainCode instanceof Buffer ? chainCode : (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(chainCode));
    for (var i = 0; i < pageSize; i++) {
        var dkey = hdk.derive('m/' + (i + pageSize * pageNum));
        addresses.push(publicKeytoAddress(dkey.publicKey, true));
    }
    return addresses;
}

/**
 * @description Returns the ethereum public key of a given private key.
 * @param privateKey Buffer | string
 * @returns {string}
 */
function privateKeytoPublic(privateKey) {
    try {
        if (typeof privateKey === 'string') {
            _validator2.default.validate({ value: privateKey, type: 'ETH_KEY' });
            privateKey = (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(privateKey));
        } else {
            _validator2.default.validate({ value: privateKey, type: 'PRIVATE_KEY_BUFFER' });
        }
    } catch (e) {
        throw new Error('Invalid private key');
    }
    return (0, _formatter.formatKey)((0, _ethereumjsUtil.privateToPublic)(privateKey));
}

/**
 * @description Returns Account of given mnemonic, dpath and password
 * @param mnemonic string
 * @param dpath string
 * @param password string
 * @returns {Account}
 */
function fromMnemonic(mnemonic, dpath, password) {
    var privateKey = (0, _mnemonic.mnemonictoPrivatekey)(mnemonic, dpath, password);
    return fromPrivateKey(privateKey);
}

/**
 * @description Returns Account of a given private key
 * @param privateKey string | buffer
 * @returns {Account}
 */
function fromPrivateKey(privateKey) {
    return new KeyAccount(privateKey);
}

/**
 * @description Returns Account of the given keystore
 * @param keystore string
 * @param password string
 * @returns {Account}
 */
function fromKeystore(keystore, password) {
    var privateKey = (0, _keystore.decryptKeystoreToPkey)(keystore, password);
    return fromPrivateKey(privateKey);
}

function fromTrezor(dpath) {
    return new TrezorAccount(dpath);
}

function fromMetaMask(web3) {
    return new MetaMaskAccount(web3);
}

/**
 * @description generate mnemonic
 * @param strength
 * @returns {*}
 */
function createMnemonic(strength) {
    return (0, _bip.generateMnemonic)(strength || 256);
}

var Account = exports.Account = function () {
    function Account() {
        _classCallCheck(this, Account);
    }

    _createClass(Account, [{
        key: 'getAddress',
        value: function getAddress() {
            throw Error('unimplemented');
        }

        /**
        * @description sign
        * @param hash
        */

    }, {
        key: 'sign',
        value: function sign(hash) {
            throw Error('unimplemented');
        }

        /**
        * @description Returns serialized signed ethereum tx
        * @param rawTx
        * @returns {string}
        */

    }, {
        key: 'signEthereumTx',
        value: function signEthereumTx(rawTx) {
            throw Error('unimplemented');
        }

        /**
        * @description Returns given order along with r, s, v
        * @param order
        */

    }, {
        key: 'signOrder',
        value: function signOrder(order) {
            throw Error('unimplemented');
        }

        /**
        * @description Calculates an Ethereum specific signature with: sign(keccak256("\x19Ethereum Signed Message:\n" + len(message) + message))).
        * @param message string
        */

    }, {
        key: 'signMessage',
        value: function signMessage(message) {
            throw Error('unimplemented');
        }
    }, {
        key: 'sendTransaction',
        value: function sendTransaction(ethNode, signedTx) {
            return ethNode.sendRawTransaction(signedTx);
        }
    }]);

    return Account;
}();

var KeyAccount = exports.KeyAccount = function (_Account) {
    _inherits(KeyAccount, _Account);

    /**
    * @property
    * @param privateKey string | Buffer
    */
    function KeyAccount(privateKey) {
        _classCallCheck(this, KeyAccount);

        var _this = _possibleConstructorReturn(this, (KeyAccount.__proto__ || Object.getPrototypeOf(KeyAccount)).call(this));

        try {
            if (typeof privateKey === 'string') {
                _validator2.default.validate({ value: privateKey, type: 'ETH_KEY' });
                privateKey = (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(privateKey));
            } else {
                _validator2.default.validate({ value: privateKey, type: 'PRIVATE_KEY_BUFFER' });
            }
        } catch (e) {
            throw new Error('Invalid private key');
        }
        _this.privateKey = privateKey;
        return _this;
    }

    /**
    * @description Returns V3 type keystore of this account
    * @param password
    * @returns {{version, id, address, crypto}}
    */


    _createClass(KeyAccount, [{
        key: 'toV3Keystore',
        value: function toV3Keystore(password) {
            return (0, _keystore.pkeyToKeystore)(this.privateKey, password);
        }

        /**
        * Returns ethereum public key of this account
        * @returns {string}
        */

    }, {
        key: 'getPublicKey',
        value: function getPublicKey() {
            return privateKeytoPublic(this.privateKey);
        }
    }, {
        key: 'getAddress',
        value: function getAddress() {
            return privateKeytoAddress(this.privateKey);
        }
    }, {
        key: 'sign',
        value: function sign(hash) {
            hash = (0, _formatter.toBuffer)(hash);
            var signature = (0, _ethereumjsUtil.ecsign)(hash, this.privateKey);
            var v = (0, _formatter.toNumber)(signature.v);
            var r = (0, _formatter.toHex)(signature.r);
            var s = (0, _formatter.toHex)(signature.s);
            return { r: r, s: s, v: v };
        }
    }, {
        key: 'signMessage',
        value: function signMessage(message) {
            var hash = (0, _ethereumjsUtil.sha3)(message);
            var finalHash = (0, _ethereumjsUtil.hashPersonalMessage)(hash);
            return this.sign(finalHash);
        }
    }, {
        key: 'signEthereumTx',
        value: function signEthereumTx(rawTx) {
            _validator2.default.validate({ type: 'TX', value: rawTx });
            var ethTx = new _ethereumjsTx2.default(rawTx);
            ethTx.sign(this.privateKey);
            return (0, _formatter.toHex)(ethTx.serialize());
        }
    }, {
        key: 'signOrder',
        value: function signOrder(order) {
            var hash = (0, _order.getOrderHash)(order);
            var signature = (0, _ethereumjsUtil.ecsign)((0, _ethereumjsUtil.hashPersonalMessage)(hash), this.privateKey);
            var v = (0, _formatter.toNumber)(signature.v);
            var r = (0, _formatter.toHex)(signature.r);
            var s = (0, _formatter.toHex)(signature.s);
            return _extends({}, order, { v: v, r: r, s: s
            });
        }
    }]);

    return KeyAccount;
}(Account);

var TrezorAccount = exports.TrezorAccount = function (_Account2) {
    _inherits(TrezorAccount, _Account2);

    function TrezorAccount(dpath) {
        _classCallCheck(this, TrezorAccount);

        var _this2 = _possibleConstructorReturn(this, (TrezorAccount.__proto__ || Object.getPrototypeOf(TrezorAccount)).call(this));

        _this2.dpath = dpath;
        return _this2;
    }

    _createClass(TrezorAccount, [{
        key: 'getAddress',
        value: function () {
            var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
                var result;
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                _context2.next = 2;
                                return Trezor.getAddress(this.dpath);

                            case 2:
                                result = _context2.sent;

                                if (!result.error) {
                                    _context2.next = 7;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 7:
                                return _context2.abrupt('return', result.result);

                            case 8:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            function getAddress() {
                return _ref3.apply(this, arguments);
            }

            return getAddress;
        }()
    }, {
        key: 'signMessage',
        value: function () {
            var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(message) {
                var result;
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _context3.next = 2;
                                return Trezor.signMessage(this.dpath, message);

                            case 2:
                                result = _context3.sent;

                                if (!result.error) {
                                    _context3.next = 7;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 7:
                                return _context3.abrupt('return', result.result);

                            case 8:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            }));

            function signMessage(_x2) {
                return _ref4.apply(this, arguments);
            }

            return signMessage;
        }()
    }, {
        key: 'signEthereumTx',
        value: function () {
            var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(rawTX) {
                var result;
                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                _context4.next = 2;
                                return Trezor.signMessage(this.dpath, rawTX);

                            case 2:
                                result = _context4.sent;

                                if (!result.error) {
                                    _context4.next = 7;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 7:
                                return _context4.abrupt('return', result.result);

                            case 8:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            }));

            function signEthereumTx(_x3) {
                return _ref5.apply(this, arguments);
            }

            return signEthereumTx;
        }()
    }]);

    return TrezorAccount;
}(Account);

var LedgerAccount = exports.LedgerAccount = function (_Account3) {
    _inherits(LedgerAccount, _Account3);

    function LedgerAccount(ledger, dpath) {
        _classCallCheck(this, LedgerAccount);

        var _this3 = _possibleConstructorReturn(this, (LedgerAccount.__proto__ || Object.getPrototypeOf(LedgerAccount)).call(this));

        _this3.ledger = ledger;
        _this3.dpath = dpath;
        return _this3;
    }

    _createClass(LedgerAccount, [{
        key: 'getAddress',
        value: function () {
            var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
                var result;
                return regeneratorRuntime.wrap(function _callee5$(_context5) {
                    while (1) {
                        switch (_context5.prev = _context5.next) {
                            case 0:
                                _context5.next = 2;
                                return Ledger.getXPubKey(this.dpath, this.ledger);

                            case 2:
                                result = _context5.sent;

                                if (!result.error) {
                                    _context5.next = 7;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 7:
                                return _context5.abrupt('return', (0, _formatter.formatAddress)(result.result.address));

                            case 8:
                            case 'end':
                                return _context5.stop();
                        }
                    }
                }, _callee5, this);
            }));

            function getAddress() {
                return _ref6.apply(this, arguments);
            }

            return getAddress;
        }()
    }, {
        key: 'signMessage',
        value: function () {
            var _ref7 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(message) {
                var hash, result;
                return regeneratorRuntime.wrap(function _callee6$(_context6) {
                    while (1) {
                        switch (_context6.prev = _context6.next) {
                            case 0:
                                hash = (0, _formatter.clearHexPrefix)((0, _formatter.toHex)((0, _ethereumjsUtil.sha3)(message)));
                                _context6.next = 3;
                                return Ledger.signMessage(this.dpath, hash, this.ledger);

                            case 3:
                                result = _context6.sent;

                                if (!result.error) {
                                    _context6.next = 8;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 8:
                                return _context6.abrupt('return', result.result);

                            case 9:
                            case 'end':
                                return _context6.stop();
                        }
                    }
                }, _callee6, this);
            }));

            function signMessage(_x4) {
                return _ref7.apply(this, arguments);
            }

            return signMessage;
        }()
    }, {
        key: 'signEthereumTx',
        value: function () {
            var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(rawTx) {
                var result;
                return regeneratorRuntime.wrap(function _callee7$(_context7) {
                    while (1) {
                        switch (_context7.prev = _context7.next) {
                            case 0:
                                _context7.next = 2;
                                return Ledger.signEthereumTx(this.dpath, rawTx, this.ledger);

                            case 2:
                                result = _context7.sent;

                                if (!result.error) {
                                    _context7.next = 7;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 7:
                                return _context7.abrupt('return', result.result);

                            case 8:
                            case 'end':
                                return _context7.stop();
                        }
                    }
                }, _callee7, this);
            }));

            function signEthereumTx(_x5) {
                return _ref8.apply(this, arguments);
            }

            return signEthereumTx;
        }()
    }, {
        key: 'signOrder',
        value: function () {
            var _ref9 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(order) {
                var hash, result;
                return regeneratorRuntime.wrap(function _callee8$(_context8) {
                    while (1) {
                        switch (_context8.prev = _context8.next) {
                            case 0:
                                hash = (0, _order.getOrderHash)(order);
                                _context8.next = 3;
                                return Ledger.signMessage(this.dpath, (0, _formatter.clearHexPrefix)((0, _formatter.toHex)(hash)), this.ledger);

                            case 3:
                                result = _context8.sent;

                                if (!result.error) {
                                    _context8.next = 8;
                                    break;
                                }

                                throw new Error(result.error.message);

                            case 8:
                                return _context8.abrupt('return', _extends({}, order, result.result));

                            case 9:
                            case 'end':
                                return _context8.stop();
                        }
                    }
                }, _callee8, this);
            }));

            function signOrder(_x6) {
                return _ref9.apply(this, arguments);
            }

            return signOrder;
        }()
    }]);

    return LedgerAccount;
}(Account);

var MetaMaskAccount = exports.MetaMaskAccount = function (_Account4) {
    _inherits(MetaMaskAccount, _Account4);

    function MetaMaskAccount(web3) {
        _classCallCheck(this, MetaMaskAccount);

        var _this4 = _possibleConstructorReturn(this, (MetaMaskAccount.__proto__ || Object.getPrototypeOf(MetaMaskAccount)).call(this));

        if (web3 && web3.eth.accounts[0]) {
            _this4.web3 = web3;
            _this4.account = _this4.web3.eth.accounts[0];
        }
        return _this4;
    }

    _createClass(MetaMaskAccount, [{
        key: 'getAddress',
        value: function getAddress() {
            if (this.web3 && this.web3.eth.accounts[0]) return this.web3.eth.accounts[0];else throw new Error('Not found MetaMask');
        }
    }, {
        key: 'sign',
        value: function () {
            var _ref10 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(hash) {
                var result;
                return regeneratorRuntime.wrap(function _callee9$(_context9) {
                    while (1) {
                        switch (_context9.prev = _context9.next) {
                            case 0:
                                _context9.next = 2;
                                return MetaMask.sign(this.web3, this.account, hash);

                            case 2:
                                result = _context9.sent;

                                if (result.error) {
                                    _context9.next = 7;
                                    break;
                                }

                                return _context9.abrupt('return', result.result);

                            case 7:
                                throw new Error(result.error.message);

                            case 8:
                            case 'end':
                                return _context9.stop();
                        }
                    }
                }, _callee9, this);
            }));

            function sign(_x7) {
                return _ref10.apply(this, arguments);
            }

            return sign;
        }()
    }, {
        key: 'signMessage',
        value: function () {
            var _ref11 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10(message) {
                var result;
                return regeneratorRuntime.wrap(function _callee10$(_context10) {
                    while (1) {
                        switch (_context10.prev = _context10.next) {
                            case 0:
                                _context10.next = 2;
                                return MetaMask.signMessage(this.web3, this.account, message);

                            case 2:
                                result = _context10.sent;

                                if (result.error) {
                                    _context10.next = 7;
                                    break;
                                }

                                return _context10.abrupt('return', result.result);

                            case 7:
                                throw new Error(result.error.message);

                            case 8:
                            case 'end':
                                return _context10.stop();
                        }
                    }
                }, _callee10, this);
            }));

            function signMessage(_x8) {
                return _ref11.apply(this, arguments);
            }

            return signMessage;
        }()
    }, {
        key: 'signEthereumTx',
        value: function () {
            var _ref12 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11(rawTx) {
                var result;
                return regeneratorRuntime.wrap(function _callee11$(_context11) {
                    while (1) {
                        switch (_context11.prev = _context11.next) {
                            case 0:
                                _context11.next = 2;
                                return MetaMask.signEthereumTx(this.web3, this.account, rawTx);

                            case 2:
                                result = _context11.sent;

                                if (result.error) {
                                    _context11.next = 7;
                                    break;
                                }

                                return _context11.abrupt('return', result.result);

                            case 7:
                                throw new Error(result.error.message);

                            case 8:
                            case 'end':
                                return _context11.stop();
                        }
                    }
                }, _callee11, this);
            }));

            function signEthereumTx(_x9) {
                return _ref12.apply(this, arguments);
            }

            return signEthereumTx;
        }()
    }, {
        key: 'signOrder',
        value: function () {
            var _ref13 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12(order) {
                var hash, result;
                return regeneratorRuntime.wrap(function _callee12$(_context12) {
                    while (1) {
                        switch (_context12.prev = _context12.next) {
                            case 0:
                                hash = (0, _formatter.toHex)((0, _ethereumjsUtil.hashPersonalMessage)((0, _order.getOrderHash)(order)));
                                _context12.next = 3;
                                return MetaMask.sign(this.web3, this.account, hash);

                            case 3:
                                result = _context12.sent;

                                if (result.error) {
                                    _context12.next = 8;
                                    break;
                                }

                                return _context12.abrupt('return', _extends({}, order, result.result));

                            case 8:
                                throw new Error(result.error.message);

                            case 9:
                            case 'end':
                                return _context12.stop();
                        }
                    }
                }, _callee12, this);
            }));

            function signOrder(_x10) {
                return _ref13.apply(this, arguments);
            }

            return signOrder;
        }()
    }]);

    return MetaMaskAccount;
}(Account);