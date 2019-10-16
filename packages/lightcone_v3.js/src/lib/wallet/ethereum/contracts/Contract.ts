import AbiFunction from "./AbiFunction";
import { toHex } from "../../common/formatter";
var ethereumjs_abi = require("ethereumjs-abi");

export default class Contract {
  abiFunctions: any;

  constructor(abi) {
    const funAbi = abi.filter(({ type }) => type === "function");
    this.abiFunctions = funAbi.reduce((acc, item) => {
      const inputTypes = item.inputs.map(({ type }) => type);
      const key = `${item.name}(${inputTypes.toString()})`;
      const methodHash = ethereumjs_abi.methodID(item.name, inputTypes);
      return {
        ...acc,
        [item.name]: new AbiFunction(item),
        [key]: new AbiFunction(item),
        [methodHash]: new AbiFunction(item)
      };
    });
  }

  /**
   * @description Encodes inputs data according to  ethereum abi
   * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
   * @param inputs array
   * @returns {*|string}
   */
  encodeInputs(method, inputs) {
    const abiFunction = this.abiFunctions[method];
    if (abiFunction) {
      return abiFunction.encodeInputs(inputs);
    } else {
      throw new Error(`No  ${method} method according to abi `);
    }
  }

  /**
   * @description Decodes outputs
   * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
   * @param outputs string
   * @returns {*}
   */
  decodeOutputs(method, outputs) {
    const abiFunction = this.abiFunctions[method];
    if (abiFunction) {
      return abiFunction.decodeOutputs(outputs);
    } else {
      throw new Error(`No  ${method} method according to abi `);
    }
  }

  /**
   * @description Decode encoded method and inputs
   * @param encode string | Buffer
   * @returns {*}
   */
  decodeEncodeInputs(encode) {
    encode = toHex(encode);
    const methodId = encode.slice(0, 10);
    const abiFunction = this.abiFunctions[methodId];
    if (abiFunction) {
      return abiFunction.decodeEncodedInputs(encode.slice(10));
    } else {
      throw new Error(`No corresponding method according to abi `);
    }
  }
}
