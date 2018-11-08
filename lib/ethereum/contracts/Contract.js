'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbiFunction = require('./AbiFunction');

var _AbiFunction2 = _interopRequireDefault(_AbiFunction);

var _formatter = require('../../common/formatter');

var _ethereumjsAbi = require('ethereumjs-abi');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Contract = function () {
    function Contract(abi) {
        _classCallCheck(this, Contract);

        var funAbi = abi.filter(function (_ref) {
            var type = _ref.type;
            return type === 'function';
        });
        this.abiFunctions = funAbi.reduce(function (acc, item) {
            var _extends2;

            var inputTypes = item.inputs.map(function (_ref2) {
                var type = _ref2.type;
                return type;
            });
            var key = item.name + '(' + inputTypes.toString() + ')';
            var methodHash = (0, _ethereumjsAbi.methodID)(item.name, inputTypes);
            return _extends({}, acc, (_extends2 = {}, _defineProperty(_extends2, item.name, new _AbiFunction2.default(item)), _defineProperty(_extends2, key, new _AbiFunction2.default(item)), _defineProperty(_extends2, methodHash, new _AbiFunction2.default(item)), _extends2));
        });
    }

    /**
    * @description Encodes inputs data according to  ethereum abi
    * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
    * @param inputs array
    * @returns {*|string}
    */


    _createClass(Contract, [{
        key: 'encodeInputs',
        value: function encodeInputs(method, inputs) {
            var abiFunction = this.abiFunctions[method];
            if (abiFunction) {
                return abiFunction.encodeInputs(inputs);
            } else {
                throw new Error('No  ' + method + ' method according to abi ');
            }
        }

        /**
        * @description Decodes outputs
        * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
        * @param outputs string
        * @returns {*}
        */

    }, {
        key: 'decodeOutputs',
        value: function decodeOutputs(method, outputs) {
            var abiFunction = this.abiFunctions[method];
            if (abiFunction) {
                return abiFunction.decodeOutputs(outputs);
            } else {
                throw new Error('No  ' + method + ' method according to abi ');
            }
        }

        /**
        * @description Decode encoded method and inputs
        * @param encode string | Buffer
        * @returns {*}
        */

    }, {
        key: 'decodeEncodeInputs',
        value: function decodeEncodeInputs(encode) {
            encode = (0, _formatter.toHex)(encode);
            var methodId = encode.slice(0, 10);
            var abiFunction = this.abiFunctions[methodId];
            if (abiFunction) {
                return abiFunction.decodeEncodedInputs(encode.slice(10));
            } else {
                throw new Error('No corresponding method according to abi ');
            }
        }
    }]);

    return Contract;
}();

exports.default = Contract;