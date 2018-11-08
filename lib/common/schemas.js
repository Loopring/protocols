'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
// Schema Help： https://github.com/yiminghe/async-validator
// required: value should be not empty eg: null, undefined, ''

var basicSchemas = {
    STRING: {
        type: 'string',
        required: true
    },
    OPTION_NUMBER: {
        validator: function validator(rule, value, cb) {
            if (value) {
                if (typeof value === 'number') {
                    cb();
                } else {
                    cb('page number valid');
                }
            } else {
                cb();
            }
        }
    },
    URL: {
        type: 'url',
        required: true
    },
    HEX: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]+$/g
    },
    ETH_VALUES: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{1,64}$/g
    },
    ETH_ADDRESS: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{40}$/g
    },
    ETH_KEY: {
        type: 'string',
        required: true,
        len: 64
    },
    ETH_DATA: {
        type: 'string',
        required: true,
        pattern: /^0x[0-9a-fA-F]{64}$/g
    },
    QUANTITY: {
        type: 'string',
        required: true
    },
    TIMESTAMP: {
        type: 'string'
    },
    CURRENCY: {
        type: 'string',
        required: true,
        enum: ['USD', 'CNY']
    },
    RPC_TAG: {
        type: 'enum',
        required: true,
        enum: ['latest', 'earliest', 'pending']
    },
    NUM: {
        type: 'number',
        required: true
    }
};

exports.default = basicSchemas;