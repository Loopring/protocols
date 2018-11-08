'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _account = require('./rpc/account');

var _account2 = _interopRequireDefault(_account);

var _order = require('./rpc/order');

var _order2 = _interopRequireDefault(_order);

var _market = require('./rpc/market');

var _market2 = _interopRequireDefault(_market);

var _ring = require('./rpc/ring');

var _ring2 = _interopRequireDefault(_ring);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Relay = function Relay(host) {
    _classCallCheck(this, Relay);

    this.account = new _account2.default(host);
    this.order = new _order2.default(host);
    this.market = new _market2.default(host);
    this.ring = new _ring2.default(host);
};

exports.default = Relay;