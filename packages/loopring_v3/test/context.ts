import fs = require("fs");
import Web3 = require("web3");

export class Context {
  public blockNumber: number;
  public blockTimestamp: number;
  public lrcAddress: string;

  public ERC20Contract: any;

  constructor(blockNumber: number, blockTimestamp: number, lrcAddress: string) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = blockTimestamp;
    this.lrcAddress = lrcAddress;

    const ABIPath = "ABI/version36/";
    const erc20Abi = fs.readFileSync(ABIPath + "ERC20.abi", "ascii");

    /*if (!web3) {
      web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    }*/

    this.ERC20Contract = new web3.eth.Contract(JSON.parse(erc20Abi));
  }
}
