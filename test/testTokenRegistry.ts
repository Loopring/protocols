import { Artifacts } from '../util/artifacts';

const {
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('TokenRegistry', (accounts: string[])=>{

  const owner = accounts[0];
  const user = accounts[1];

  let tokenRegistry: any;
  let lrcTokenAddr: string;

  before(async () => {
    tokenRegistry = await TokenRegistry.deployed();
    lrcTokenAddr = await tokenRegistry.getAddressBySymbol("LRC");
    //console.log("lrcTokenAddr", lrcTokenAddr);
  });

  describe('owner', () => {
    it('should be able to register a token', async () => {
      const isRegistered = await tokenRegistry.isTokenRegistered(lrcTokenAddr);
      assert.equal(isRegistered, true, 'token should be registered');
    });

    it('should be able to unregister a token', async () => {
      await tokenRegistry.unregisterToken(lrcTokenAddr, "LRC", {from: owner});
      const isRegistered = await tokenRegistry.isTokenRegistered(lrcTokenAddr);
      assert.equal(isRegistered, false, 'token should be unregistered');
    });

  });

  describe('any user', () => {
    it('should be able to check a token registered or not', async () => {
      const isRegistered = await tokenRegistry.isTokenRegistered(lrcTokenAddr, {from: user});
      assert.equal(isRegistered, isRegistered, 'any one should be able to check token registered or not ');
    });
  });

})
