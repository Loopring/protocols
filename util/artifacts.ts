
export class Artifacts {
  public TokenRegistry: any;
  public RinghashRegistry: any;
  public LoopringProtocolImpl: any;
  public DummyToken: any;
  public TestLrcToken: any;
  constructor(artifacts: any) {
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.RinghashRegistry = artifacts.require('RinghashRegistry');
    this.LoopringProtocolImpl = artifacts.require('LoopringProtocolImpl');
    this.DummyToken = artifacts.require('test/DummyToken');
    this.TestLrcToken = artifacts.require('test/TestLrcToken');
  }
}
