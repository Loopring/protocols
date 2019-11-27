export class Artifacts {
  public MockContract: any;

  constructor(artifacts: any) {
    this.MockContract = artifacts.require("thirdparty/MockContract.sol");
  }
}
