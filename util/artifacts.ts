
export class Artifacts {
  public TokenRegistry: any;
  public Exchange: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public OrderRegistry: any;
  public MinerRegistry: any;
  public DummyToken: any;
  public DummyAgency: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("impl/TokenRegistry");
    this.Exchange = artifacts.require("impl/Exchange");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.OrderRegistry = artifacts.require("impl/OrderRegistry");
    this.MinerRegistry = artifacts.require("impl/MinerRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.DummyAgency = artifacts.require("test/DummyAgency");
  }
}
