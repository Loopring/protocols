
export class Artifacts {
  public TokenRegistry: any;
  public LoopringProtocol: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.LoopringProtocol = artifacts.require('LoopringProtocol');
    this.DummyToken = artifacts.require('test/DummyToken');
  }
}
