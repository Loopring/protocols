
export class Artifacts {
  public TokenRegistry: any;
  public Exchange: any;
  public TradeDelegate: any;
  public BrokerRegistry: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("impl/TokenRegistry");
    this.Exchange = artifacts.require("impl/Exchange");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.BrokerRegistry = artifacts.require("impl/BrokerRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
  }
}
