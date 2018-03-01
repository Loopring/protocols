
export class Artifacts {
  public TokenRegistry: any;
  public LoopringProtocolImpl: any;
  public TokenTransferDelegate: any;
  public NameRegistry: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("TokenRegistry");
    this.LoopringProtocolImpl = artifacts.require("LoopringProtocolImpl");
    this.TokenTransferDelegate = artifacts.require("TokenTransferDelegate");
    this.NameRegistry = artifacts.require("NameRegistry");
    this.DummyToken = artifacts.require("test/DummyToken");
  }
}
