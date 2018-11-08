'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.toBuffer = toBuffer;
exports.toHex = toHex;
exports.toNumber = toNumber;
exports.toBig = toBig;
exports.toBN = toBN;
exports.formatKey = formatKey;
exports.formatAddress = formatAddress;
exports.addHexPrefix = addHexPrefix;
exports.clearHexPrefix = clearHexPrefix;
exports.padLeftEven = padLeftEven;
exports.getDisplaySymbol = getDisplaySymbol;
exports.toFixed = toFixed;

var _ethereumjsUtil = require('ethereumjs-util');

var _ethereumjsUtil2 = _interopRequireDefault(_ethereumjsUtil);

var _bignumber = require('bignumber.js');

var _bignumber2 = _interopRequireDefault(_bignumber);

var _bn = require('bn.js');

var _bn2 = _interopRequireDefault(_bn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_bignumber2.default.config({
    EXPONENTIAL_AT: 20,
    RANGE: [-20, 10000000],
    ROUNDING_MODE: 1
});
/**
 *
 * @param mixed Buffer|number|string (hex string must be with '0x' prefix)
 * @returns {Buffer}
 */
function toBuffer(mixed) {
    if (mixed instanceof Buffer) {
        return mixed;
    } else {
        return _ethereumjsUtil2.default.toBuffer(mixed);
    }
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {string}
 */
function toHex(mixed) {
    if (typeof mixed === 'number' || mixed instanceof _bignumber2.default || mixed instanceof _bn2.default) {
        return addHexPrefix(mixed.toString(16));
    }

    if (mixed instanceof Buffer) {
        return addHexPrefix(mixed.toString('hex'));
    }

    if (typeof mixed === 'string') {
        var regex = new RegExp(/^0x[0-9a-fA-F]*$/);
        return regex.test(mixed) ? mixed : addHexPrefix(toBuffer(mixed).toString('hex'));
    }
    throw new Error('Unsupported type');
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {number}
 */
function toNumber(mixed) {
    if (typeof mixed === 'number') {
        return mixed;
    }

    if (mixed instanceof _bignumber2.default || mixed instanceof _bn2.default) {
        return mixed.toNumber();
    }

    if (typeof mixed === 'string') {
        return Number(mixed);
    }

    throw new Error('Unsupported type');
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BigNumber}
 */
function toBig(mixed) {
    if (mixed instanceof _bignumber2.default) {
        return mixed;
    }

    if (typeof mixed === 'number') {
        return new _bignumber2.default(mixed.toString());
    }

    if (typeof mixed === 'string') {
        return new _bignumber2.default(mixed);
    }

    throw new Error('Unsupported type');
}

/**
 *
 * @param mixed number | BigNumber |  BN  | Buffer | string
 * @returns {BN}
 */
function toBN(mixed) {
    return mixed instanceof _bn2.default ? mixed : new _bn2.default(toBig(mixed).toString(10), 10);
}

/**
 * Returns formatted hex string of a given private key
 * @param mixed Buffer| string
 * @returns {string}
 */
function formatKey(mixed) {
    if (mixed instanceof Buffer) {
        return mixed.toString('hex');
    }

    if (typeof mixed === 'string') {
        return mixed.startsWith('0x') ? mixed.slice(2) : mixed;
    }
    throw new Error('Unsupported type');
}

/**
 * Returns hex string of a given address
 * @param mixed Buffer | string
 * @returns {string}
 */
function formatAddress(mixed) {
    if (mixed instanceof Buffer) {
        return _ethereumjsUtil2.default.toChecksumAddress('0x' + mixed.toString('hex'));
    }

    if (typeof mixed === 'string') {
        return _ethereumjsUtil2.default.toChecksumAddress(mixed.startsWith('0x') ? mixed : '0x' + mixed);
    }
    throw new Error('Unsupported type');
}

/**
 * Returns hex string with '0x' prefix
 * @param input
 * @returns {string}
 */
function addHexPrefix(input) {
    if (typeof input === 'string') {
        return input.startsWith('0x') ? input : '0x' + input;
    }
    throw new Error('Unsupported type');
}

/**
 * Returns hex string without '0x' prefix
 * @param input string
 * @returns {string}
 */
function clearHexPrefix(input) {
    if (typeof input === 'string') {
        return input.startsWith('0x') ? input.slice(2) : input;
    }
    throw new Error('Unsupported type');
}

/**
 *
 * @param hex
 * @returns {string}
 */
function padLeftEven(hex) {
    return hex.length % 2 !== 0 ? '0' + hex : hex;
}

/**
 * Returns symbol of a given kind of currency
 * @param settingsCurrency
 * @returns {*}
 */
function getDisplaySymbol(settingsCurrency) {
    switch (settingsCurrency) {
        case 'CNY':
            return '￥';
        case 'USD':
            return '$';
        default:
            return '';
    }
}

/**
 * Returns number in string with a given precision
 * @param number number | BigNumber
 * @param precision number
 * @param ceil bool  round up
 * @returns {string}
 */
function toFixed(number, precision, ceil) {
    precision = precision || 0;
    ceil = ceil || false;
    if (number instanceof _bignumber2.default) {
        var rm = ceil ? 0 : 1;
        return number.toFixed(precision, rm);
    }

    if (typeof number === 'number') {
        return ceil ? (Math.ceil(number * Number('1e' + precision)) / Number('1e' + precision)).toFixed(precision) : (Math.floor(number * Number('1e' + precision)) / Number('1e' + precision)).toFixed(precision);
    }

    throw new Error('Unsupported type');
}