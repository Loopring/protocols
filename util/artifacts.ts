
export class Artifacts {
  public TokenRegistry: any;
  public Exchange: any;
  public TradeDelegate: any;
  public DummyToken: any;
  public RingSpecs: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("impl/TokenRegistry");
    this.Exchange = artifacts.require("impl/Exchange");
    this.TradeDelegate = artifacts.require("impl/TradeDelegate");
    this.DummyToken = artifacts.require("test/DummyToken");
    this.RingSpecs = artifacts.require("spec/RingSpecs");
  }
}
