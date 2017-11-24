import { Artifacts } from "../util/artifacts";

const {
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract("TokenRegistry", (accounts: string[]) => {

  const owner = accounts[0];
  const user = accounts[1];

  let tokenRegistry: any;
  let testTokenAddr: string;
  let lrcAddress: string;
  let eosAddress: string;
  let neoAddress: string;
  let qtumAddress: string;

  before(async () => {
    tokenRegistry = await TokenRegistry.deployed();
    testTokenAddr = "0x8d01f9bcca92e63a1b2752b22d16e1962aa3c920";
    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    neoAddress = await tokenRegistry.getAddressBySymbol("NEO");
    qtumAddress = await tokenRegistry.getAddressBySymbol("QTUM");
  });

  describe("owner", () => {

    it("should be able to register a token", async () => {
      await tokenRegistry.registerToken(testTokenAddr, "TEST", {from: owner});
      const isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      assert.equal(isRegistered, true, "token should be registered");
    });

    it("should be able to unregister a token", async () => {
      let isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      let isRegisteredBySymbol = await tokenRegistry.isTokenRegisteredBySymbol("TEST");
      assert.equal(isRegistered, true, "token should be registered on start");
      assert.equal(isRegisteredBySymbol, true, "token should be registered on start");

      await tokenRegistry.unregisterToken(testTokenAddr, "TEST", {from: owner});
      isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr);
      isRegisteredBySymbol = await tokenRegistry.isTokenRegisteredBySymbol("TEST");
      assert.equal(isRegistered, false, "token should be unregistered");
      assert.equal(isRegisteredBySymbol, false, "token should be unregistered");
    });

    it("should be able to check all tokens registered in array", async () => {
      const tokenList = [lrcAddress, neoAddress, eosAddress, qtumAddress];
      const allRegistered = await tokenRegistry.areAllTokensRegistered(tokenList);
      assert.equal(allRegistered, true, "all token registered in migration script.");

      tokenList.push(testTokenAddr);
      const allRegistered2 = await tokenRegistry.areAllTokensRegistered(tokenList);
      assert.equal(allRegistered2, false, "not all token registered");
    });

    it("should be able to getTokens with start index and count", async () => {
      const allTokens = await  tokenRegistry.getTokens(0, 1000); // token length < 1000.
      // console.log("allTokens:", allTokens);

      const size = allTokens.length;
      const tokenSlice1 = await  tokenRegistry.getTokens(1, 2); // token length < 1000.
      const tokenSlice2 = await  tokenRegistry.getTokens(2, 2); // token length < 1000.

      assert.deepEqual(tokenSlice1, allTokens.slice(1, 3), "get tokens should return expected tokens");
      assert.deepEqual(tokenSlice2, allTokens.slice(2, 4), "get tokens should return expected tokens");
    });

  });

  describe("any user", () => {
    it("should be able to check a token registered or not", async () => {
      const isRegistered = await tokenRegistry.isTokenRegistered(testTokenAddr, {from: user});
      assert.equal(isRegistered, isRegistered, "any one should be able to check token registered or not ");
    });
  });

});
