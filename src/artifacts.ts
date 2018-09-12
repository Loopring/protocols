
export class Artifacts {
  public RingSubmitter: any;
  public RingCanceller: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public MinerRegistry: any;
  public DummyToken: any;
  public DummyBrokerInterceptor: any;
  public DummyExchange: any;
  public FeeHolder: any;
  public OrderBook: any;
  public TaxTable: any;
  constructor(artifacts: any) {
    this.RingSubmitter = artifacts.require("impl/RingSubmitter");
    this.RingCanceller = artifacts.require("impl/RingCanceller");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.MinerRegistry = artifacts.require("impl/MinerRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.DummyBrokerInterceptor = artifacts.require("test/DummyBrokerInterceptor");
    this.DummyExchange = artifacts.require("test/DummyExchange");
    this.FeeHolder = artifacts.require("impl/FeeHolder");
    this.OrderBook = artifacts.require("impl/OrderBook");
    this.TaxTable = artifacts.require("impl/TaxTable");
  }
}
