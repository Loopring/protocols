import { Artifacts, expectThrow } from "protocol2-js";

const {
  SymbolRegistry,
} = new Artifacts(artifacts);

contract("SymbolRegistry", (accounts: string[]) => {

  const owner = accounts[0];
  const user = accounts[1];
  const emptyAddr = "0x0000000000000000000000000000000000000000";

  let symbolRegistry: any;
  const token1 = "0x" + "1".repeat(40);
  const token2 = "0x" + "2".repeat(40);
  const token3 = "0x" + "3".repeat(40);
  const symbol1 = "SYM1";
  const symbol2 = "SYM2";
  const symbol3 = "SYM3";

  const registerSymbolChecked = async (address: string, symbol: string, transactionOrigin: string) => {
    await symbolRegistry.registerSymbol(address, symbol, {from: transactionOrigin});
    await assertSymbolRegistered(address, symbol);
  };

  const unregisterSymbolChecked = async (address: string, symbol: string, transactionOrigin: string) => {
    await symbolRegistry.unregisterSymbol(address, {from: transactionOrigin});
    await assertSymbolUnregistered(address, symbol);
  };

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

  beforeEach(async () => {
    // Fresh SymbolRegistry for each test
    symbolRegistry = await SymbolRegistry.new();
  });

  describe("owner", () => {

    it("should be able to register a symbol", async () => {
      await registerSymbolChecked(token1, symbol1, owner);
      await registerSymbolChecked(token2, symbol2, owner);
      await registerSymbolChecked(token3, symbol3, owner);
    });

    it("should not be able to register the same symbol twice", async () => {
      await registerSymbolChecked(token1, symbol1, owner);

      // Same address and symbol
      await expectThrow(symbolRegistry.registerSymbol(token1, symbol1, {from: owner}));
      // Only the same address
      await expectThrow(symbolRegistry.registerSymbol(token1, symbol2, {from: owner}));
      // Only the same symbol
      await expectThrow(symbolRegistry.registerSymbol(token2, symbol1, {from: owner}));
    });

    it("should not be able to register an empty symbol", async () => {
      await expectThrow(symbolRegistry.registerSymbol(token1, "", {from: owner}));
    });

    it("should not be able to register a symbol for an invalid token", async () => {
      await expectThrow(symbolRegistry.registerSymbol(emptyAddr, symbol1, {from: owner}));
    });

    it("should be able to unregister a symbol", async () => {
      await registerSymbolChecked(token1, symbol1, owner);
      await registerSymbolChecked(token2, symbol2, owner);
      await registerSymbolChecked(token3, symbol3, owner);
      await unregisterSymbolChecked(token2, symbol2, owner);
      await assertSymbolRegistered(token1, symbol1);
      await assertSymbolRegistered(token3, symbol3);
      await unregisterSymbolChecked(token1, symbol1, owner);
      await assertSymbolRegistered(token3, symbol3);
      await unregisterSymbolChecked(token3, symbol3, owner);
    });

    it("should not be able to unregister a symbol for an unregistered token", async () => {
      await registerSymbolChecked(token1, symbol1, owner);
      await expectThrow(symbolRegistry.unregisterSymbol(emptyAddr, {from: owner}));
      await expectThrow(symbolRegistry.unregisterSymbol(token2, {from: owner}));
    });

  });

  describe("other users", () => {

    it("should not be able to register a symbol", async () => {
      await expectThrow(symbolRegistry.registerSymbol(token1, symbol1, {from: user}));
    });

    it("should not be able to unregister a symbol", async () => {
      await registerSymbolChecked(token1, symbol1, owner);
      await expectThrow(symbolRegistry.registerSymbol(token1, symbol1, {from: user}));
    });

  });

});
