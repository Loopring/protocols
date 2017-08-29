
export class Artifacts {
  public TokenRegistry: any;
  public LoopringExchange: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.LoopringExchange = artifacts.require('LoopringExchange');
    this.DummyToken = artifacts.require('test/DummyToken');
  }
}
