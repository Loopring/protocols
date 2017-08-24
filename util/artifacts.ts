

export class Artifacts {
  public Migrations: any;
  public TokenRegistry: any;
  public LoopringExchange: any;
  public DummyToken: any;
  constructor(artifacts: any) {
    this.Migrations = artifacts.require('Migrations');
    this.TokenRegistry = artifacts.require('TokenRegistry');
    this.LoopringExchange = artifacts.require('LoopringExchange');
    this.DummyToken = artifacts.require('DummyToken');
  }
}
