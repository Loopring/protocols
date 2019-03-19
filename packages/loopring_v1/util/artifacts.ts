
export class Artifacts {
  public TokenRegistry: any;
  public LoopringProtocolImpl: any;
  public TokenTransferDelegate: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require("TokenRegistryImpl");
    this.LoopringProtocolImpl = artifacts.require("LoopringProtocolImpl");
    this.TokenTransferDelegate = artifacts.require("TokenTransferDelegateImpl");
    this.DummyToken = artifacts.require("test/DummyToken");
  }
}
