import fs = require("fs");

export class Context {

  public blockNumber: number;
  public blockTimestamp: number;
  public lrcAddress: string;
  public feePercentageBase: number;

  public ERC20Contract: any;
  public TradeDelegateContract: any;
  public BrokerRegistryContract: any;
  public OrderRegistryContract: any;
  public BrokerInterceptorContract: any;
  public FeeHolderContract: any;
  public OrderBookContract: any;
  public TaxTableContract: any;

  public tradeDelegate: any;
  public orderBrokerRegistry: any;
  public minerBrokerRegistry: any;
  public orderRegistry: any;
  public minerRegistry: any;
  public feeHolder: any;
  public orderBook: any;
  public taxTable: any;

  constructor(blockNumber: number,
              blockTimestamp: number,
              tradeDelegateAddress: string,
              orderBrokerRegistryAddress: string,
              minerBrokerRegistryAddress: string,
              orderRegistryAddress: string,
              feeHolderAddress: string,
              orderBookAddress: string,
              taxTableAddress: string,
              lrcAddress: string,
              feePercentageBase: number) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = blockTimestamp;
    this.lrcAddress = lrcAddress;
    this.feePercentageBase = feePercentageBase;

    const ABIPath = "ABI/latest/";
    const erc20Abi = fs.readFileSync(ABIPath + "ERC20.abi", "ascii");
    const tradeDelegateAbi = fs.readFileSync(ABIPath + "ITradeDelegate.abi", "ascii");
    const brokerRegistryAbi = fs.readFileSync(ABIPath + "IBrokerRegistry.abi", "ascii");
    const orderRegistryAbi = fs.readFileSync(ABIPath + "IOrderRegistry.abi", "ascii");
    const brokerInterceptorAbi = fs.readFileSync(ABIPath + "IBrokerInterceptor.abi", "ascii");
    const feeHolderAbi = fs.readFileSync(ABIPath + "IFeeHolder.abi", "ascii");
    const orderBookAbi = fs.readFileSync(ABIPath + "IOrderBook.abi", "ascii");
    const taxTableAbi = fs.readFileSync(ABIPath + "ITaxTable.abi", "ascii");

    this.ERC20Contract = web3.eth.contract(JSON.parse(erc20Abi));
    this.TradeDelegateContract = web3.eth.contract(JSON.parse(tradeDelegateAbi));
    this.BrokerRegistryContract = web3.eth.contract(JSON.parse(brokerRegistryAbi));
    this.OrderRegistryContract = web3.eth.contract(JSON.parse(orderRegistryAbi));
    this.FeeHolderContract = web3.eth.contract(JSON.parse(feeHolderAbi));
    this.OrderBookContract = web3.eth.contract(JSON.parse(orderBookAbi));
    this.BrokerInterceptorContract = web3.eth.contract(JSON.parse(brokerInterceptorAbi));
    this.TaxTableContract = web3.eth.contract(JSON.parse(taxTableAbi));

    this.tradeDelegate = this.TradeDelegateContract.at(tradeDelegateAddress);
    this.orderBrokerRegistry = this.BrokerRegistryContract.at(orderBrokerRegistryAddress);
    this.minerBrokerRegistry = this.BrokerRegistryContract.at(minerBrokerRegistryAddress);
    this.orderRegistry = this.OrderRegistryContract.at(orderRegistryAddress);
    this.feeHolder = this.FeeHolderContract.at(feeHolderAddress);
    this.orderBook = this.OrderBookContract.at(orderBookAddress);
    this.taxTable = this.TaxTableContract.at(taxTableAddress);
  }

}
