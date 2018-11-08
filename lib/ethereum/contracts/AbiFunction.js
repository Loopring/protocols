'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _ethereumjsAbi = require('ethereumjs-abi');

var _formatter = require('../../common/formatter');

var _bn = require('bn.js');

var _bn2 = _interopRequireDefault(_bn);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AbiFunction = function () {
    function AbiFunction(_ref) {
        var inputs = _ref.inputs,
            name = _ref.name,
            outputs = _ref.outputs,
            constant = _ref.constant;

        _classCallCheck(this, AbiFunction);

        this.name = name;
        this.inputTypes = inputs.map(function (_ref2) {
            var type = _ref2.type;
            return type;
        });
        this.inputs = inputs;
        this.outputTypes = outputs.map(function (_ref3) {
            var type = _ref3.type;
            return type;
        });
        this.outputs = outputs;
        this.constant = constant;
        this.methodAbiHash = (0, _formatter.toHex)((0, _ethereumjsAbi.methodID)(name, this.inputTypes));
    }

    /**
    * @description Returns encoded methodId and inputs
    * @param inputs Object, examples {owner:"0x000...}
    * @returns {string}
    */


    _createClass(AbiFunction, [{
        key: 'encodeInputs',
        value: function encodeInputs(inputs) {
            var abiInputs = this.parseInputs(inputs);
            return this.methodAbiHash + (0, _formatter.clearHexPrefix)((0, _formatter.toHex)((0, _ethereumjsAbi.rawEncode)(this.inputTypes, abiInputs)));
        }

        /**
        * @description decode ethereum jsonrpc response result
        * @param outputs
        * @returns {*}
        */

    }, {
        key: 'decodeOutputs',
        value: function decodeOutputs(outputs) {
            return this.parseOutputs((0, _ethereumjsAbi.rawDecode)(this.outputTypes, (0, _formatter.toBuffer)(outputs)));
        }

        /**
        * @description decode encoded inputs
        * @param encoded
        * @returns {*}
        */

    }, {
        key: 'decodeEncodedInputs',
        value: function decodeEncodedInputs(encoded) {
            return this.parseOutputs((0, _ethereumjsAbi.rawDecode)(this.inputTypes, (0, _formatter.toBuffer)((0, _formatter.addHexPrefix)(encoded))));
        }
    }, {
        key: 'parseInputs',
        value: function parseInputs() {
            var inputs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.inputs.map(function (_ref4) {
                var name = _ref4.name,
                    type = _ref4.type;

                if (inputs[name] === undefined) {
                    throw new Error('Parameter ' + name + ' of type ' + type + ' is required!');
                }
                return inputs[name];
            });
        }
    }, {
        key: 'parseOutputs',
        value: function parseOutputs(outputs) {
            return outputs.map(function (output) {
                if (output instanceof _bn2.default) {
                    return (0, _formatter.toHex)(output);
                }
                return output;
            });
        }
    }]);

    return AbiFunction;
}();

exports.default = AbiFunction;