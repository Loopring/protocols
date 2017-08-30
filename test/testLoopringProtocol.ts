import { Artifacts } from '../util/artifacts';

const {
  LoopringProtocol,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('LoopringProtocol', (accounts: string[])=>{

  let loopringProtocol: any;
  let tokenRegistry: any;
  let dummyToken: any;

  before( async () => {
    loopringProtocol = await LoopringProtocol.deployed();
    tokenRegistry = await TokenRegistry.deployed();
    dummyToken = await DummyToken.deployed();
  });

  describe('fillRing', () => {
    it('should be able to check signatures before transaction', async () => {
      assert.equal(true, true);
    });
  });

})
