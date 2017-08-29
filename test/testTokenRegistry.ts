import { Artifacts } from '../util/artifacts';

const {
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('TokenRegistry', (accounts: string[])=>{

  const owner = accounts[0];
  const user = accounts[1];

  let tokenRegistry: any;
  let dummyToken: any;
  let dummyTokenAddr: string;

  before(async () => {
    tokenRegistry = await TokenRegistry.deployed();
    dummyToken = await DummyToken.deployed();

    dummyTokenAddr = dummyToken.address;
  });

  describe('owner', () => {
    it('should be able to register a token', async () => {
      await tokenRegistry.registerToken(dummyTokenAddr, {from: owner});
      const isRegistered = await tokenRegistry.isTokenRegistered(dummyTokenAddr);
      assert.equal(isRegistered, true, 'dummy token should be registered');
    });

    it('should be able to unregister a token', async () => {
      await tokenRegistry.unregisterToken(dummyTokenAddr, {from: owner});
      const isRegistered = await tokenRegistry.isTokenRegistered(dummyTokenAddr);
      assert.equal(isRegistered, false, 'dummy token should be unregistered');
    });

  });

  describe('any user', () => {
    it('should be able to check a token registered or not', async () => {
      const isRegistered = await tokenRegistry.isTokenRegistered(dummyTokenAddr, {from: user});
      assert.equal(isRegistered, isRegistered, 'any one should be able to check token registered or not ');
    });
  });

})
