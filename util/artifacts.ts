
export class Artifacts {
  public TokenRegistry: any;
  public LoopringProtocolImpl: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.LoopringProtocolImpl = artifacts.require('LoopringProtocolImpl');
    this.DummyToken = artifacts.require('test/DummyToken');
  }
}
