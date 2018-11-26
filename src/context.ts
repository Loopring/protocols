import fs = require("fs");
import Web3 = require("web3");

export class Context {

  public blockNumber: number;
  public blockTimestamp: number;
  public lrcAddress: string;
  public feePercentageBase: number;
  public ringIndex: number;

  public ERC20Contract: any;
  public TradeDelegateContract: any;
  public TradeHistoryContract: any;
  public BrokerRegistryContract: any;
  public OrderRegistryContract: any;
  public BrokerInterceptorContract: any;
  public FeeHolderContract: any;
  public OrderBookContract: any;
  public BurnRateTableContract: any;

  public tradeDelegate: any;
  public tradeHistory: any;
  public orderBrokerRegistry: any;
  public minerBrokerRegistry: any;
  public orderRegistry: any;
  public minerRegistry: any;
  public feeHolder: any;
  public orderBook: any;
  public burnRateTable: any;

  constructor(blockNumber: number,
              blockTimestamp: number,
              tradeDelegateAddress: string,
              tradeHistoryAddress: string,
              orderBrokerRegistryAddress: string,
              orderRegistryAddress: string,
              feeHolderAddress: string,
              orderBookAddress: string,
              burnRateTableAddress: string,
              lrcAddress: string,
              feePercentageBase: number,
              ringIndex: number) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = blockTimestamp;
    this.lrcAddress = lrcAddress;
    this.feePercentageBase = feePercentageBase;
    this.ringIndex = ringIndex;

    const ABIPath = "ABI/latest/";
    const erc20Abi = fs.readFileSync(ABIPath + "ERC20.abi", "ascii");
    const tradeDelegateAbi = fs.readFileSync(ABIPath + "ITradeDelegate.abi", "ascii");
    const tradeHistoryAbi = fs.readFileSync(ABIPath + "ITradeHistory.abi", "ascii");
    const brokerRegistryAbi = fs.readFileSync(ABIPath + "IBrokerRegistry.abi", "ascii");
    const orderRegistryAbi = fs.readFileSync(ABIPath + "IOrderRegistry.abi", "ascii");
    const brokerInterceptorAbi = fs.readFileSync(ABIPath + "IBrokerInterceptor.abi", "ascii");
    const feeHolderAbi = fs.readFileSync(ABIPath + "IFeeHolder.abi", "ascii");
    const orderBookAbi = fs.readFileSync(ABIPath + "IOrderBook.abi", "ascii");
    const burnRateTableAbi = fs.readFileSync(ABIPath + "IBurnRateTable.abi", "ascii");

    if (!web3) {
      web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    }

    this.ERC20Contract = web3.eth.contract(JSON.parse(erc20Abi));
    this.TradeDelegateContract = web3.eth.contract(JSON.parse(tradeDelegateAbi));
    this.TradeHistoryContract = web3.eth.contract(JSON.parse(tradeHistoryAbi));
    this.BrokerRegistryContract = web3.eth.contract(JSON.parse(brokerRegistryAbi));
    this.OrderRegistryContract = web3.eth.contract(JSON.parse(orderRegistryAbi));
    this.FeeHolderContract = web3.eth.contract(JSON.parse(feeHolderAbi));
    this.OrderBookContract = web3.eth.contract(JSON.parse(orderBookAbi));
    this.BrokerInterceptorContract = web3.eth.contract(JSON.parse(brokerInterceptorAbi));
    this.BurnRateTableContract = web3.eth.contract(JSON.parse(burnRateTableAbi));

    this.tradeDelegate = this.TradeHistoryContract.at(tradeDelegateAddress);
    this.tradeHistory = this.TradeHistoryContract.at(tradeHistoryAddress);
    this.orderBrokerRegistry = this.BrokerRegistryContract.at(orderBrokerRegistryAddress);
    this.orderRegistry = this.OrderRegistryContract.at(orderRegistryAddress);
    this.feeHolder = this.FeeHolderContract.at(feeHolderAddress);
    this.orderBook = this.OrderBookContract.at(orderBookAddress);
    this.burnRateTable = this.BurnRateTableContract.at(burnRateTableAddress);
  }

}
