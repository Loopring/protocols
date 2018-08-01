import fs = require("fs");

export class Context {

  public blockNumber: number;
  public blockTimestamp: number;

  public ERC20Contract: any;
  public TokenRegistryContract: any;
  public TradeDelegateContract: any;
  public BrokerRegistryContract: any;
  public OrderRegistryContract: any;
  public MinerRegistryContract: any;

  public tokenRegistry: any;
  public tradeDelegate: any;
  public orderBrokerRegistry: any;
  public minerBrokerRegistry: any;
  public orderRegistry: any;
  public minerRegistry: any;

  constructor(blockNumber: number,
              blockTimestamp: number,
              tokenRegistryAddress: string,
              tradeDelegateAddress: string,
              orderBrokerRegistryAddress: string,
              minerBrokerRegistryAddress: string,
              orderRegistryAddress: string,
              minerRegistryAddress: string,
              ) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = blockTimestamp;

    const ABIPath = "ABI/latest/";
    const erc20Abi = fs.readFileSync(ABIPath + "ERC20.abi", "ascii");
    const tokenRegistryAbi = fs.readFileSync(ABIPath + "ITokenRegistry.abi", "ascii");
    const tradeDelegateAbi = fs.readFileSync(ABIPath + "ITradeDelegate.abi", "ascii");
    const brokerRegistryAbi = fs.readFileSync(ABIPath + "IBrokerRegistry.abi", "ascii");
    const orderRegistryAbi = fs.readFileSync(ABIPath + "IOrderRegistry.abi", "ascii");
    const minerRegistryAbi = fs.readFileSync(ABIPath + "IMinerRegistry.abi", "ascii");

    this.ERC20Contract = web3.eth.contract(JSON.parse(erc20Abi));
    this.TokenRegistryContract = web3.eth.contract(JSON.parse(tokenRegistryAbi));
    this.TradeDelegateContract = web3.eth.contract(JSON.parse(tradeDelegateAbi));
    this.BrokerRegistryContract = web3.eth.contract(JSON.parse(brokerRegistryAbi));
    this.OrderRegistryContract = web3.eth.contract(JSON.parse(orderRegistryAbi));
    this.MinerRegistryContract = web3.eth.contract(JSON.parse(minerRegistryAbi));

    this.tokenRegistry = this.TokenRegistryContract.at(tokenRegistryAddress);
    this.tradeDelegate = this.TradeDelegateContract.at(tradeDelegateAddress);
    this.orderBrokerRegistry = this.BrokerRegistryContract.at(orderBrokerRegistryAddress);
    this.minerBrokerRegistry = this.BrokerRegistryContract.at(minerBrokerRegistryAddress);
    this.orderRegistry = this.TokenRegistryContract.at(orderRegistryAddress);
    this.minerRegistry = this.TokenRegistryContract.at(minerRegistryAddress);
  }

}
