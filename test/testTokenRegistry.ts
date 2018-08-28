import { Artifacts, expectThrow } from "protocol2-js";

const {
  TokenRegistry,
  DummyAgency,
} = new Artifacts(artifacts);

contract("TokenRegistry", (accounts: string[]) => {

  const owner = accounts[0];
  const user = accounts[1];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let tokenRegistry: any;
  let dummyAgency1: any;
  let dummyAgency2: any;
  let dummyAgency3: any;
  const token1 = "0x" + "1".repeat(40);
  const token2 = "0x" + "2".repeat(40);
  const token3 = "0x" + "3".repeat(40);
  const token4 = "0x" + "4".repeat(40);

  const registerTokenChecked = async (token: string, transactionOrigin: string) => {
    await tokenRegistry.registerToken(token, {from: transactionOrigin});
    await assertTokenRegistered(token);
  };

  const unregisterTokenChecked = async (token: string, transactionOrigin: string) => {
    await tokenRegistry.unregisterToken(token, {from: transactionOrigin});
    assertTokenNotRegistered(token);
  };

  const assertTokenRegistered = async (token: string) => {
    const isRegistered = await tokenRegistry.areAllTokensRegistered([token]);
    assert.equal(isRegistered, true, "token should be registered");
  };

  const assertTokenNotRegistered = async (token: string) => {
    const isRegistered = await tokenRegistry.areAllTokensRegistered([token]);
    assert.equal(isRegistered, false, "token should not be registered");
  };

  const areAllTokensRegisteredChecked = async (tokens: string[], allRegistered: boolean) => {
    const isRegistered = await tokenRegistry.areAllTokensRegistered(tokens);
    assert.equal(isRegistered, allRegistered, "Registered should match expected value");
  };

  const registerAgencyChecked = async (agency: string, transactionOrigin: string, index: number) => {
    await tokenRegistry.registerAgency(agency, {from: transactionOrigin});
    await assertAgencyRegistered(agency, index);
  };

  const unregisterAgencyChecked = async (token: string, transactionOrigin: string, index: number) => {
    await tokenRegistry.unregisterAgency(token, {from: transactionOrigin});
    assertAgencyNotRegistered(token, index);
  };

  const assertAgencyRegistered = async (agency: string, index: number) => {
    const registeredAgency = await tokenRegistry.agencies(index);
    assert.equal(registeredAgency, agency, "agency address should be added to agencies array");
  };

  const assertAgencyNotRegistered = async (agency: string, index: number) => {
    await expectThrow(tokenRegistry.agencies(index));
  };

  beforeEach(async () => {
    // Fresh TokenRegistry for each test
    tokenRegistry = await TokenRegistry.new();
    dummyAgency1 = await DummyAgency.new(tokenRegistry.address);
    dummyAgency2 = await DummyAgency.new(tokenRegistry.address);
    dummyAgency3 = await DummyAgency.new(tokenRegistry.address);
  });

  describe("owner", () => {

    it("should be able to register a token", async () => {
      await registerTokenChecked(token1, owner);
    });

    it("should not be able to register the same token twice", async () => {
      await registerTokenChecked(token1, owner);
      await expectThrow(tokenRegistry.registerToken(token1, {from: owner}));
    });

    it("should be able to unregister a token", async () => {
      await registerTokenChecked(token1, owner);
      await registerTokenChecked(token2, owner);
      await registerTokenChecked(token3, owner);
      await areAllTokensRegisteredChecked([token1, token3, token2], true);
      await unregisterTokenChecked(token2, owner);
      await areAllTokensRegisteredChecked([token1, token3], true);
      await unregisterTokenChecked(token1, owner);
      await areAllTokensRegisteredChecked([token3], true);
      await unregisterTokenChecked(token3, owner);
    });

    it("should be able to check all tokens registered in array", async () => {
      await registerTokenChecked(token1, owner);
      await registerTokenChecked(token2, owner);
      await areAllTokensRegisteredChecked([token1, token2], true);
      await registerTokenChecked(token3, owner);
      await areAllTokensRegisteredChecked([token1, token3, token2], true);
      // token4 is not registered
      await areAllTokensRegisteredChecked([token3, token4, token1], false);
    });

    it("should be able to register an agency", async () => {
      await registerAgencyChecked(dummyAgency1.address, owner, 0);
    });

    it("should be able to unregister an agency", async () => {
      await registerAgencyChecked(dummyAgency1.address, owner, 0);
      await registerAgencyChecked(dummyAgency2.address, owner, 1);
      await registerAgencyChecked(dummyAgency3.address, owner, 2);
      await unregisterAgencyChecked(dummyAgency2.address, owner, 2);
      await unregisterAgencyChecked(dummyAgency3.address, owner, 1);
      await unregisterAgencyChecked(dummyAgency1.address, owner, 0);
    });

    it("should be able to unregister all agencies", async () => {
      await registerAgencyChecked(dummyAgency1.address, owner, 0);
      await registerAgencyChecked(dummyAgency2.address, owner, 1);
      await registerAgencyChecked(dummyAgency3.address, owner, 2);
      await tokenRegistry.unregisterAllAgencies({from: owner});
      await expectThrow(tokenRegistry.agencies(2));
      await expectThrow(tokenRegistry.agencies(1));
      await expectThrow(tokenRegistry.agencies(0));
    });

    it("should not be able to register an agency that is not a contract", async () => {
      await expectThrow(tokenRegistry.registerAgency(emptyAddr, {from: owner}));
      await expectThrow(tokenRegistry.registerAgency(user, {from: owner}));
    });

  });

  describe("agency", () => {

    it("should not be able to register a token if not registered", async () => {
      await expectThrow(dummyAgency1.registerToken(token1, {from: user}));
    });

    it("should be able to register a token if registered", async () => {
      await registerAgencyChecked(dummyAgency1.address, owner, 0);
      await dummyAgency1.registerToken(token1, {from: user});
      await areAllTokensRegisteredChecked([token1], true);
    });

    it("should not be allowed to unregister a token even if registered", async () => {
      await registerTokenChecked(token1, owner);
      await expectThrow(dummyAgency1.unregisterToken(token1, {from: user}));
      await unregisterTokenChecked(token1, owner);
    });

    // TODO: more tests

  });

  describe("other users", () => {
    it("should not be able to register a token", async () => {
      await expectThrow(tokenRegistry.registerToken(token1, {from: user}));
    });

    it("should not be able to register an agency", async () => {
      await expectThrow(tokenRegistry.registerAgency(dummyAgency1.address, {from: user}));
    });

    // TODO: more tests

  });

});
