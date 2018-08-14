import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  FeeHolder,
  SymbolRegistry,
  TradeDelegate,
} = new Artifacts(artifacts);

contract("FeeHolder", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];

  let symbolRegistry: any;
  let feeHolder: any;
  let tradeDelegate: any;

  let lrcAddress: string;
  let gtoAddress: string;

  before(async () => {
    symbolRegistry = await SymbolRegistry.deployed();
    feeHolder = await FeeHolder.deployed();
    tradeDelegate = await TradeDelegate.deployed();

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    gtoAddress = await symbolRegistry.getAddressBySymbol("GTO");

    await tradeDelegate.authorizeAddress(mockedExchangeAddress, {from: deployer});
  });

  const numberToBytes32Str = (n: number) => {
    const encoded = abi.rawEncode(["uint256"], [new BN(n.toString(10), 10)]);
    return "0x" + encoded.toString("hex");
  };

  const addressToBytes32Str = (addr: string) => {
    const encoded = abi.rawEncode(["address"], [addr]);
    return "0x" + encoded.toString("hex");
  };

  describe("protocol", () => {
    it("should be able to add fee balances in batch", async () => {
      const batch: string[] = [];
      const token1 = lrcAddress;
      const user1 = accounts[9];
      const value1 = 1.23 * 1e18;

      const token2 = gtoAddress;
      const user2 = accounts[8];
      const value2 = 3.21 * 1e19;

      batch.push(addressToBytes32Str(token1));
      batch.push(addressToBytes32Str(user1));
      batch.push(numberToBytes32Str(value1));
      batch.push(addressToBytes32Str(token2));
      batch.push(addressToBytes32Str(user2));
      batch.push(numberToBytes32Str(value2));

      const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(mockedExchangeAddress);
      assert.equal(isAuthorizedInDelegate, true, "exchange not authorized.");

      await feeHolder.batchAddFeeBalances(batch, {from: mockedExchangeAddress});
      const value1FromFeeHolderBN = await feeHolder.feeBalances(token1, user1);
      const value1FromFeeHolder = value1FromFeeHolderBN.toNumber();
      assert.equal(value1FromFeeHolder, value1, "fee calculating error.");
    });
  });

  describe("other users", () => {
    it("should not be able to add fee balances", async () => {
      const batch: string[] = [];
      const token1 = lrcAddress;
      const user1 = accounts[9];
      const value1 = 1.23 * 1e18;

      const token2 = gtoAddress;
      const user2 = accounts[8];
      const value2 = 3.21 * 1e19;

      batch.push(addressToBytes32Str(token1));
      batch.push(addressToBytes32Str(user1));
      batch.push(numberToBytes32Str(value1));
      batch.push(addressToBytes32Str(token2));
      batch.push(addressToBytes32Str(user2));
      batch.push(numberToBytes32Str(value2));

      expectThrow( feeHolder.batchAddFeeBalances(batch, {from: user1}));
    });

  });

  describe("any user", () => {
    it("can withdraw token of its own", async () => {
      // TODO
    });

  });

});
