'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.trim = trim;
exports.trimAll = trimAll;
exports.keccakHash = keccakHash;
exports.calculateGas = calculateGas;

var _ethereumjsUtil = require('ethereumjs-util');

var _formatter = require('./formatter');

var _formatter2 = _interopRequireDefault(_formatter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * trim head space and tail space
 * @param str string
 */
function trim(str) {
    return str.replace(/(^\s+)|(\s+$)/g, '');
}

/**
 * trim all spaces
 * @param str
 */
function trimAll(str) {
    return trim(str).replace(/\s/g, '');
}

function keccakHash(str) {
    return (0, _formatter.toHex)((0, _ethereumjsUtil.keccak)(str));
}

function calculateGas(gasPrice, gasLimit) {
    return (0, _formatter.toBig)(gasPrice).times(gasLimit).div(1e9);
}

exports.default = _extends({
    hashPersonalMessage: _ethereumjsUtil.hashPersonalMessage
}, _formatter2.default, {
    trim: trim,
    trimAll: trimAll,
    keccakHash: keccakHash,
    calculateGas: calculateGas
});