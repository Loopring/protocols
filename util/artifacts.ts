
export class Artifacts {
  public TokenRegistry: any;
  public SymbolRegistry: any;
  public Exchange: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public MinerRegistry: any;
  public DummyToken: any;
  public DummyAgency: any;
  public DummyBrokerInterceptor: any;
  public FeeHolder: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("impl/TokenRegistry");
    this.SymbolRegistry = artifacts.require("impl/SymbolRegistry");
    this.Exchange = artifacts.require("impl/Exchange");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.MinerRegistry = artifacts.require("impl/MinerRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.DummyAgency = artifacts.require("test/DummyAgency");
    this.DummyBrokerInterceptor = artifacts.require("test/DummyBrokerInterceptor");
    this.FeeHolder = artifacts.require("impl/FeeHolder");
  }
}
