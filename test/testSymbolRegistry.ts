import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  SymbolRegistry,
} = new Artifacts(artifacts);

contract("SymbolRegistry", (accounts: string[]) => {

  const owner = accounts[0];
  const user = accounts[1];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let symbolRegistry: any;
  let testTokenAddr: string;
  let testTokenSymbol: string;

  const assertSymbolRegistered = async (address: string, symbol: string) => {
    const symbolByAddress = await symbolRegistry.getSymbolByAddress(address);
    const addressBySymbol = await symbolRegistry.getAddressBySymbol(symbol);
    assert.equal(symbolByAddress, symbol, "token symbol should be registered");
    assert.equal(addressBySymbol, address, "token address should match symbol");
  };

  const assertSymbolUnregistered = async (address: string, symbol: string) => {
    const symbolByAddress = await symbolRegistry.getSymbolByAddress(address);
    const addressBySymbol = await symbolRegistry.getAddressBySymbol(symbol);
    assert.notEqual(symbolByAddress, symbol, "token symbol should not be registered");
    assert.notEqual(addressBySymbol, address, "token address should not have a matching symbol");
  };

  before(async () => {
    testTokenAddr = "0x8d01f9bcca92e63a1b2752b22d16e1962aa3c920";
    testTokenSymbol = "TEST";
  });

  beforeEach(async () => {
    // Fresh SymbolRegistry for each test
    symbolRegistry = await SymbolRegistry.new();
  });

  describe("owner", () => {

    it("should be able to register a symbol", async () => {
      await symbolRegistry.registerSymbol(testTokenAddr, testTokenSymbol, {from: owner});
      await assertSymbolRegistered(testTokenAddr, testTokenSymbol);
    });

    it("should not be able to register the same symbol twice", async () => {
      await symbolRegistry.registerSymbol(testTokenAddr, testTokenSymbol, {from: owner});
      await assertSymbolRegistered(testTokenAddr, testTokenSymbol);

      // Same address and symbol
      await expectThrow(symbolRegistry.registerSymbol(testTokenAddr, testTokenSymbol, {from: owner}));
      // Only the same address
      await expectThrow(symbolRegistry.registerSymbol(testTokenAddr, "XXX", {from: owner}));
      // Only the same symbol
      await expectThrow(symbolRegistry.registerSymbol(user, "TEST", {from: owner}));
    });

    it("should be able to unregister a symbol", async () => {
      await symbolRegistry.registerSymbol(testTokenAddr, testTokenSymbol, {from: owner});
      await assertSymbolRegistered(testTokenAddr, testTokenSymbol);

      await symbolRegistry.unregisterSymbol(testTokenAddr, {from: owner});
      await assertSymbolUnregistered(testTokenAddr, testTokenSymbol);
    });

  });

  describe("other users", () => {

    it("should not be able to register a symbol", async () => {
      await expectThrow(symbolRegistry.registerSymbol(testTokenAddr, testTokenSymbol, {from: user}));
    });

  });

});
