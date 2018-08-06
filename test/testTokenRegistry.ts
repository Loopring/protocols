import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  TokenRegistry,
  SymbolRegistry,
  DummyToken,
  DummyAgency,
} = new Artifacts(artifacts);

contract("TokenRegistry", (accounts: string[]) => {

  const owner = accounts[0];
  const user = accounts[1];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let tokenRegistry: any;
  let symbolRegistry: any;
  let dummyAgency: any;
  let testTokenAddr: string;
  let lrcAddress: string;
  let eosAddress: string;
  let rdnAddress: string;
  let gtoAddress: string;

  before(async () => {
    tokenRegistry = await TokenRegistry.deployed();
    symbolRegistry = await SymbolRegistry.deployed();
    dummyAgency = await DummyAgency.deployed();
    testTokenAddr = "0x8d01f9bcca92e63a1b2752b22d16e1962aa3c920";

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    eosAddress = await symbolRegistry.getAddressBySymbol("EOS");
    rdnAddress = await symbolRegistry.getAddressBySymbol("RDN");
    gtoAddress = await symbolRegistry.getAddressBySymbol("GTO");
  });

  describe("owner", () => {

    it("should be able to register a token", async () => {
      await tokenRegistry.registerToken(testTokenAddr, {from: owner});
      const isRegistered = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegistered, true, "token should be registered");
    });

    it("should not be able to register the same token twice", async () => {
      const isRegistered = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegistered, true, "token should be registered");
      await expectThrow(tokenRegistry.registerToken(testTokenAddr, {from: owner}));
    });

    it("should be able to unregister a token", async () => {
      let isRegistered = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegistered, true, "token should be registered on start");

      await tokenRegistry.unregisterToken(testTokenAddr, {from: owner});
      isRegistered = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegistered, false, "token should be unregistered");
    });

    it("should be able to check all tokens registered in array", async () => {
      const tokenList = [lrcAddress, rdnAddress, eosAddress, gtoAddress];
      const allRegistered = await tokenRegistry.areAllTokensRegistered(tokenList);
      assert.equal(allRegistered, true, "all token registered in migration script.");

      tokenList.push(testTokenAddr);
      const allRegistered2 = await tokenRegistry.areAllTokensRegistered(tokenList);
      assert.equal(allRegistered2, false, "not all token registered");
    });

    it("should be able to register an agency", async () => {
      await expectThrow(tokenRegistry.agencies(0));
      await tokenRegistry.registerAgency(dummyAgency.address, {from: owner});
      const registeredAgency = await tokenRegistry.agencies(0);
      assert.equal(registeredAgency, dummyAgency.address, "agency address should be added to agencies array");
    });

    it("should be able to unregister an agency", async () => {
      const registeredAgency = await tokenRegistry.agencies(0);
      assert.equal(registeredAgency, dummyAgency.address, "agency should be registered on start");
      await tokenRegistry.unregisterAgency(registeredAgency, {from: owner});
      await expectThrow(tokenRegistry.agencies(0));
    });

    it("should be able to unregister all agencies", async () => {
      await tokenRegistry.registerAgency(dummyAgency.address, {from: owner});
      const registeredAgency = await tokenRegistry.agencies(0);
      assert.equal(registeredAgency, dummyAgency.address, "agency address should be added to agencies array");

      await tokenRegistry.unregisterAllAgencies({from: owner});
      await expectThrow(tokenRegistry.agencies(0));
    });

    it("should not be able to register an agency that is not a contract", async () => {
      await expectThrow(tokenRegistry.registerAgency(user, {from: owner}));
    });

  });

  describe("agency", () => {

    it("should not be able to register a token if not registered", async () => {
      const isRegisteredBefore = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegisteredBefore, false, "token should not be registered");
      await expectThrow(tokenRegistry.agencies(0));
      await expectThrow(dummyAgency.registerToken(testTokenAddr, {from: user}));
    });

    it("should be able to register a token if registered", async () => {
      await tokenRegistry.registerAgency(dummyAgency.address, {from: owner});
      const registeredAgency = await tokenRegistry.agencies(0);
      assert.equal(registeredAgency, dummyAgency.address, "agency address should be added to agencies array");

      await dummyAgency.registerToken(testTokenAddr, {from: user});
      const isRegisteredAfter = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegisteredAfter, true, "token should be registered");
    });

    it("should not be allowed to unregister a token even if registered", async () => {
      await expectThrow(dummyAgency.unregisterToken(testTokenAddr, {from: user}));
      await tokenRegistry.unregisterToken(testTokenAddr, {from: owner});
    });

    // TODO: more tests

  });

  describe("other users", () => {
    it("should not be able to register a token", async () => {
      const isRegisteredBefore = await tokenRegistry.areAllTokensRegistered([testTokenAddr]);
      assert.equal(isRegisteredBefore, false, "token should not be registered");
      await expectThrow(tokenRegistry.registerToken(testTokenAddr, {from: user}));
    });

    it("should not be able to register an agency", async () => {
      await tokenRegistry.unregisterAllAgencies({from: owner});
      await expectThrow(tokenRegistry.registerAgency(dummyAgency.address, {from: user}));
    });

    // TODO: more tests

  });

});
