"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Using import {*} from 'ethereumjs-abi'; failed to import ethereumjs-abi
var abi = require("ethereumjs-abi");
const formatter_1 = require("../../common/formatter");
const bn_js_1 = __importDefault(require("bn.js"));
class AbiFunction {
    constructor({ inputs, name, outputs, constant }) {
        this.name = name;
        this.inputTypes = inputs.map(({ type }) => type);
        this.inputs = inputs;
        this.outputTypes = outputs.map(({ type }) => type);
        this.outputs = outputs;
        this.constant = constant;
        this.methodAbiHash = formatter_1.toHex(abi.methodID(name, this.inputTypes));
    }
    /**
     * @description Returns encoded methodId and inputs
     * @param inputs Object, examples {owner:"0x000...}
     * @returns {string}
     */
    encodeInputs(inputs) {
        const abiInputs = this.parseInputs(inputs);
        return (this.methodAbiHash +
            formatter_1.clearHexPrefix(formatter_1.toHex(abi.rawEncode(this.inputTypes, abiInputs))));
    }
    /**
     * @description decode ethereum jsonrpc response result
     * @param outputs
     * @returns {*}
     */
    decodeOutputs(outputs) {
        return this.parseOutputs(abi.rawDecode(this.outputTypes, formatter_1.toBuffer(outputs)));
    }
    /**
     * @description decode encoded inputs
     * @param encoded
     * @returns {*}
     */
    decodeEncodedInputs(encoded) {
        return this.parseOutputs(abi.rawDecode(this.inputTypes, formatter_1.toBuffer(formatter_1.addHexPrefix(encoded))));
    }
    parseInputs(inputs = {}) {
        return this.inputs.map(({ name, type }) => {
            if (inputs[name] === undefined) {
                throw new Error(`Parameter ${name} of type ${type} is required!`);
            }
            return inputs[name];
        });
    }
    parseOutputs(outputs) {
        return outputs.map(output => {
            if (output instanceof bn_js_1.default) {
                return formatter_1.toHex(output);
            }
            return output;
        });
    }
}
exports.default = AbiFunction;
//# sourceMappingURL=AbiFunction.js.map