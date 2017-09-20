import { Artifacts } from '../util/artifacts';

const {
  LoopringProtocolImpl,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('LoopringProtocolImpl', (accounts: string[])=>{

  let loopringProtocolImpl: any;
  let tokenRegistry: any;
  let dummyToken: any;

  before( async () => {
    loopringProtocolImpl = await LoopringProtocolImpl.deployed();
    tokenRegistry = await TokenRegistry.deployed();
    dummyToken = await DummyToken.deployed();
  });

  describe('fillRing', () => {

    it('should be able to check signatures before transaction', async () => {

      //assert.equal(true, true);
    });


  });

})
