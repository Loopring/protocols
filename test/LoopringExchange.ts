import { Artifacts } from '../util/artifacts';

const {
  LoopringExchange,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('LoopringExchange', (accounts: string[])=>{

  let loopringExchange: any;
  let tokenRegistry: any;
  let dummyToken: any;

  before( async () => {
    loopringExchange = await LoopringExchange.deployed();
    tokenRegistry = await TokenRegistry.deployed();
    dummyToken = await DummyToken.deployed();
  });

  describe('fillRing', () => {
    it('should be able to check signatures before transaction', async () => {
      assert.equal(true, true);
    });
  });

})
