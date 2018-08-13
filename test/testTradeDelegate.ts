import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Artifacts } from "../util/artifacts";
import { Bitstream } from "../util/bitstream";
import { expectThrow } from "../util/expectThrow";

const {
  TradeDelegate,
  SymbolRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract("TradeDelegate", (accounts: string[]) => {

  const owner = accounts[0];
  const loopringProtocolV1 = accounts[1]; // mock loopring protocol V1 contract
  const orderOwner1 = accounts[5];
  const orderOwner2 = accounts[6];

  let tradeDelegate: any;
  let symbolRegistry: any;
  let lrcAddress: string;
  let eosAddress: string;
  let rdnAddress: string;
  let gtoAddress: string;

  const createSubmitableData = (owners: string[],
                                tradingPairs: number[],
                                validSince: number[],
                                hashes: number[]) => {
    const bitstream = new Bitstream();
    for (let i = 0; i < owners.length; i++) {
      bitstream.addAddress(owners[i], 32);
      bitstream.addNumber(hashes[i], 32);
      bitstream.addNumber(validSince[i], 32);
      // Padding is done on the RIGHT for bytes20 for some reason.
      // But addresses are padded on the left (even though they are both 20 bytes)...
      bitstream.addNumber(tradingPairs[i], 20);
      bitstream.addNumber(0, 12);
    }
    return bitstream.getBytes32Array();
  };

  before(async () => {
    tradeDelegate = await TradeDelegate.deployed();
    symbolRegistry = await SymbolRegistry.deployed();

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    eosAddress = await symbolRegistry.getAddressBySymbol("EOS");
    rdnAddress = await symbolRegistry.getAddressBySymbol("RDN");
    gtoAddress = await symbolRegistry.getAddressBySymbol("GTO");
  });

  beforeEach(async () => {
    tradeDelegate = await TradeDelegate.new(20);
    await tradeDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
    const authorized = await tradeDelegate.isAddressAuthorized(loopringProtocolV1);
    assert(authorized, "address is not authorized.");
  });

  /*it("contract owner should be able to authorize an address", async () => {
    await tradeDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
    const authorized = await tradeDelegate.isAddressAuthorized(loopringProtocolV1);
    assert(authorized, "address is not authorized.");
  });*/

  it("should be able to check if order cutoffs are valid", async () => {
    const owners = [orderOwner1];
    const tradingPairs = [456];
    const validSince = [1];
    const hashes = [123];
    const data = createSubmitableData(owners, tradingPairs, validSince, hashes);
    const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
    const bits = new BN(result.toString(16), 16);
    assert.equal(bits.testn(0), true, "Order cutoff should be valid");
  });

  it("should be able to cancel all orders of an owner address up to a set time", async () => {
    const owners = [orderOwner1, orderOwner1, orderOwner1, orderOwner2];
    const tradingPairs = [123, 456, 789, 123];
    const validSince = [1000, 2500, 1500, 1500];
    const hashes = [1, 2, 3, 4];
    const data = createSubmitableData(owners, tradingPairs, validSince, hashes);
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    await tradeDelegate.setCutoffs(orderOwner1, 2000, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), false, "Order should be cancelled");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
  });

  it("should be able to cancel all trading pair orders of an owner address up to a set time", async () => {
    const tradingPairToCancel = 666;
    const owners = [orderOwner1, orderOwner1, orderOwner1, orderOwner2];
    const tradingPairs = [tradingPairToCancel, tradingPairToCancel, 789, tradingPairToCancel];
    const validSince = [3000, 1000, 1000, 1000];
    const hashes = [1, 2, 3, 4];
    const data = createSubmitableData(owners, tradingPairs, validSince, hashes);
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    {
      const bitstream = new Bitstream();
      bitstream.addNumber(tradingPairToCancel, 20);
      await tradeDelegate.setTradingPairCutoffs(orderOwner1, bitstream.getData(), 2000, {from: loopringProtocolV1});
    }
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), false, "Order should be cancelled");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
  });

  it("should be able to cancel a single order", async () => {
    const orderHashOwner1ToCancel = 666;
    const orderHashOwner2ToCancel = 666;
    const owners = [orderOwner1, orderOwner1, orderOwner2, orderOwner2];
    const tradingPairs = [123, 426, 789, 123];
    const validSince = [3000, 1000, 1000, 1000];
    const hashes = [orderHashOwner1ToCancel, 2, orderHashOwner2ToCancel, 4];
    const data = createSubmitableData(owners, tradingPairs, validSince, hashes);
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    {
      const bitstream = new Bitstream();
      bitstream.addNumber(orderHashOwner2ToCancel, 32);
      await tradeDelegate.setCancelled(orderOwner2, bitstream.getData(), {from: loopringProtocolV1});
    }
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be invalid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    {
      const bitstream = new Bitstream();
      bitstream.addNumber(orderHashOwner1ToCancel, 32);
      await tradeDelegate.setCancelled(orderOwner1, bitstream.getData(), {from: loopringProtocolV1});
    }
    {
      const result = await tradeDelegate.batchCheckCutoffsAndCancelled(data, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), false, "Order should be cancelled");
      assert.equal(bits.testn(1), true, "Order should be invalid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
  });

});
