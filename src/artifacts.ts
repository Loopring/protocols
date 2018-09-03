
export class Artifacts {
  public TokenRegistry: any;
  public SymbolRegistry: any;
  public RingSubmitter: any;
  public RingCanceller: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public MinerRegistry: any;
  public DummyToken: any;
  public DummyAgency: any;
  public DummyBrokerInterceptor: any;
  public DummyExchange: any;
  public FeeHolder: any;
  public OrderBook: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("impl/TokenRegistry");
    this.SymbolRegistry = artifacts.require("impl/SymbolRegistry");
    this.RingSubmitter = artifacts.require("impl/RingSubmitter");
    this.RingCanceller = artifacts.require("impl/RingCanceller");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.MinerRegistry = artifacts.require("impl/MinerRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.DummyAgency = artifacts.require("test/DummyAgency");
    this.DummyBrokerInterceptor = artifacts.require("test/DummyBrokerInterceptor");
    this.DummyExchange = artifacts.require("test/DummyExchange");
    this.FeeHolder = artifacts.require("impl/FeeHolder");
    this.OrderBook = artifacts.require("impl/OrderBook");
  }
}
