'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _schemas = require('../common/schemas');

var _schemas2 = _interopRequireDefault(_schemas);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ethereumSchemas = _extends({}, _schemas2.default, {
    PRIVATE_KEY_BUFFER: {
        validator: function validator(rule, value, cb) {
            if (value instanceof Buffer) {
                value.length === 32 ? cb() : cb('length of private key must be 32');
            } else {
                cb('private key is not an instance of Buffer');
            }
        }
    },
    TX_HASH: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{64}$/g
    },
    BASIC_TX: {
        type: 'object',
        required: true,
        fields: {
            to: _extends({}, _schemas2.default.ETH_ADDRESS),
            value: _extends({}, _schemas2.default.ETH_VALUES),
            gasLimit: {
                type: 'string',
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            gasPrice: {
                type: 'string',
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            chainId: {
                type: 'number'
            },
            nonce: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{1,64}$/g
            },
            data: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]*$/g
            }
        }
    },
    TX: {
        type: 'object',
        required: true,
        fields: {
            to: _extends({}, _schemas2.default.ETH_ADDRESS),
            value: _extends({}, _schemas2.default.ETH_VALUES),
            gasLimit: _extends({}, _schemas2.default.ETH_VALUES),
            gasPrice: _extends({}, _schemas2.default.ETH_VALUES),
            chainId: {
                type: 'number',
                required: true
            },
            nonce: _extends({}, _schemas2.default.ETH_VALUES),
            data: {
                type: 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]*$/g
            },
            signed: {
                type: 'string'
            }
        }
    }
});

exports.default = ethereumSchemas;