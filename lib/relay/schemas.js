'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _schemas = require('../common/schemas');

var _schemas2 = _interopRequireDefault(_schemas);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var loopringScheams = _extends({}, _schemas2.default, {
    INTERVAL: {
        type: 'enum',
        required: true,
        enum: ['1Hr', '2Hr', '4Hr', '1Day', '1Week']
    },
    HASH: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{64}$/g
    },
    PROJECT_ID: {
        type: 'number',
        required: true,
        min: 1
    },
    LOOPRING_TOKEN: {
        type: 'enum',
        required: true,
        enum: ['LRC', 'LRN', 'LRQ']
    },
    CANCEL_ORDER_TYPE: {
        type: 'enum',
        required: true,
        enum: [1, 2, 3, 4]
    },
    RAW_Order: {
        type: 'object',
        required: true,
        fields: {
            delegateAddress: _extends({}, _schemas2.default.ETH_ADDRESS),
            protocol: _extends({}, _schemas2.default.ETH_ADDRESS),
            owner: _extends({}, _schemas2.default.ETH_ADDRESS),
            tokenS: _extends({}, _schemas2.default.ETH_ADDRESS),
            tokenB: _extends({}, _schemas2.default.ETH_ADDRESS),
            authAddr: _extends({}, _schemas2.default.ETH_ADDRESS),
            authPrivateKey: _extends({}, _schemas2.default.ETH_KEY, {
                required: false
            }),
            validSince: _extends({}, _schemas2.default.ETH_VALUES),
            validUntil: _extends({}, _schemas2.default.ETH_VALUES),
            amountS: _extends({}, _schemas2.default.ETH_VALUES),
            amountB: _extends({}, _schemas2.default.ETH_VALUES),
            lrcFee: _extends({}, _schemas2.default.ETH_VALUES),
            walletAddress: _extends({}, _schemas2.default.ETH_ADDRESS),
            buyNoMoreThanAmountB: {
                type: 'boolean',
                required: true
            },
            marginSplitPercentage: {
                type: 'integer',
                required: true,
                minimum: 0,
                maximum: 100
            }
        }
    },
    ORDER: {
        type: 'object',
        required: true,
        fields: {
            delegateAddress: _extends({}, _schemas2.default.ETH_ADDRESS),
            protocol: _extends({}, _schemas2.default.ETH_ADDRESS),
            owner: _extends({}, _schemas2.default.ETH_ADDRESS),
            tokenS: _extends({}, _schemas2.default.ETH_ADDRESS),
            tokenB: _extends({}, _schemas2.default.ETH_ADDRESS),
            authAddr: _extends({}, _schemas2.default.ETH_ADDRESS),
            authPrivateKey: _extends({}, _schemas2.default.ETH_KEY, {
                required: false
            }),
            validSince: _extends({}, _schemas2.default.ETH_VALUES),
            validUntil: _extends({}, _schemas2.default.ETH_VALUES),
            amountS: _extends({}, _schemas2.default.ETH_VALUES),
            amountB: _extends({}, _schemas2.default.ETH_VALUES),
            lrcFee: _extends({}, _schemas2.default.ETH_VALUES),
            walletAddress: _extends({}, _schemas2.default.ETH_ADDRESS),
            buyNoMoreThanAmountB: {
                type: 'boolean',
                required: true
            },
            marginSplitPercentage: {
                type: 'integer',
                required: true,
                minimum: 0,
                maximum: 100
            },
            v: {
                type: 'integer',
                required: true,
                minimum: 0
            },
            s: {
                'type': 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{64}$/g
            },
            r: {
                'type': 'string',
                required: true,
                pattern: /^0x[0-9a-fA-F]{64}$/g
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
            }
        }
    }
});

exports.default = loopringScheams;