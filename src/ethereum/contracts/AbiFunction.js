import {rawEncode, methodID, rawDecode} from 'ethereumjs-abi';
import {toHex, clearHexPrefix, toBuffer, addHexPrefix} from '../../common/formatter';
import BN from 'bn.js';

export default class AbiFunction
{
    constructor ({inputs, name, outputs, constant})
    {
        this.name = name;
        this.inputTypes = inputs.map(({type}) => type);
        this.inputs = inputs;
        this.outputTypes = outputs.map(({type}) => type);
        this.outputs = outputs;
        this.constant = constant;
        this.methodAbiHash = toHex(methodID(name, this.inputTypes));
    }

    /**
   * @description Returns encoded methodId and inputs
   * @param inputs Object, examples {owner:"0x000...}
   * @returns {string}
   */
    encodeInputs (inputs)
    {
        const abiInputs = this.parseInputs(inputs);
        return this.methodAbiHash + clearHexPrefix(toHex(rawEncode(this.inputTypes, abiInputs)));
    }

    /**
   * @description decode ethereum jsonrpc response result
   * @param outputs
   * @returns {*}
   */
    decodeOutputs (outputs)
    {
        return this.parseOutputs(rawDecode(this.outputTypes, toBuffer(outputs)));
    }

    /**
   * @description decode encoded inputs
   * @param encoded
   * @returns {*}
   */
    decodeEncodedInputs (encoded)
    {
        return this.parseOutputs(rawDecode(this.inputTypes, toBuffer(addHexPrefix(encoded))));
    }

    parseInputs (inputs = {})
    {
        return this.inputs.map(({name, type}) =>
        {
            if (!inputs[name])
            {
                throw new Error(`Parameter ${name} of type ${type} is required!`);
            }
            return inputs[name];
        });
    }

    parseOutputs (outputs)
    {
        return outputs.map(output =>
        {
            if (output instanceof BN)
            {
                return toHex(output);
            }
            return output;
        });
    }
}
