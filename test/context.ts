import fs = require("fs");
import Web3 = require("web3");

export class Context {

  public blockNumber: number;
  public blockTimestamp: number;
  public lrcAddress: string;

  public ERC20Contract: any;
  public TradeDelegateContract: any;

  public tradeDelegate: any;

  constructor(blockNumber: number,
              blockTimestamp: number,
              tradeDelegateAddress: string,
              lrcAddress: string) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = blockTimestamp;
    this.lrcAddress = lrcAddress;

    const ABIPath = "ABI/version30/";
    const erc20Abi = fs.readFileSync(ABIPath + "ERC20.abi", "ascii");
    const tradeDelegateAbi = fs.readFileSync(ABIPath + "ITradeDelegate.abi", "ascii");

    if (!web3) {
      web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    }

    this.ERC20Contract = new web3.eth.Contract(JSON.parse(erc20Abi));
    this.TradeDelegateContract = new web3.eth.Contract(JSON.parse(tradeDelegateAbi), tradeDelegateAddress);

    this.tradeDelegate = this.TradeDelegateContract.clone();
  }

}
