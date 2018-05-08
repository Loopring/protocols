import AbiFunction from './AbiFunction';

export default class Contract {

  constructor(abi) {
    const funAbi = abi.filter(({type}) => type === 'function');
    this.abiFunctions = funAbi.reduce((acc, item) => {
      const inputTypes = item.inputs.map(({type})=>type);
      const key = `${item.name}(${inputTypes.toString()})`;
      return ({
        ...acc,
        [item.name]: new AbiFunction(item),
        [key]:new AbiFunction(item)
      })
    });
  }


  /**
   * @description Encodes inputs data according to  ethereum abi
   * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
   * @param inputs array
   * @returns {*|string}
   */
  encodeInputs(method,inputs){
    const abiFunction = this.abiFunctions[method];
    if (abiFunction) {
      return abiFunction.encodeInputs(inputs)
    } else {
      throw  new Error(`No  ${method} method according to abi `)
    }
  }

  /**
   * @description Decodes outputs
   * @param method string can be full method or just method name, examples: 'balanceOf' or balanceOf(address)
   * @param outputs string
   * @returns {*}
   */
  decodeOutputs(method,outputs){
    const abiFunction = this.abiFunctions[method];
    if (abiFunction) {
      return abiFunction.decodeOutputs(outputs)
    } else {
      throw new Error(`No  ${method} method according to abi `)
    }
  }


}
