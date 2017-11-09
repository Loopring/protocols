
export class Artifacts {
  public TokenRegistry: any;
  public RinghashRegistry: any;
  public LoopringProtocolImpl: any;
  public TokenTransferDelegate: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("TokenRegistry");
    this.RinghashRegistry = artifacts.require("RinghashRegistry");
    this.LoopringProtocolImpl = artifacts.require("LoopringProtocolImpl");
    this.TokenTransferDelegate = artifacts.require("TokenTransferDelegate");
    this.DummyToken = artifacts.require("test/DummyToken");
  }
}
