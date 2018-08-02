import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Artifacts } from "../util/artifacts";
import { expectThrow } from "../util/expectThrow";

const {
  TradeDelegate,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract("TradeDelegate", (accounts: string[]) => {

  const owner = accounts[0];
  const loopringProtocolV1 = accounts[1]; // mock loopring protocol V1 contract
  const orderOwner1 = accounts[5];
  const orderOwner2 = accounts[6];

  let tradeDelegate: any;
  let tokenRegistry: any;
  let lrcAddress: string;
  let eosAddress: string;
  let rdnAddress: string;
  let gtoAddress: string;

  before(async () => {
    tradeDelegate = await TradeDelegate.deployed();
    tokenRegistry = await TokenRegistry.deployed();

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    rdnAddress = await tokenRegistry.getAddressBySymbol("RDN");
    gtoAddress = await tokenRegistry.getAddressBySymbol("GTO");
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
    const tradingPairs = [new Buffer("123", "hex")];
    const validSince = [1];
    const hashes = [123];
    const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
      owners, tradingPairs, validSince, hashes, {from: owner});
    const bits = new BN(result.toString(16), 16);
    assert.equal(bits.testn(0), true, "Order cutoff should be valid");
  });

  it("should be able to cancel all orders of an owner address up to a set time", async () => {
    const owners = [orderOwner1, orderOwner1, orderOwner1, orderOwner2];
    const tradingPairs = [new BigNumber("123"), new BigNumber("456"), new BigNumber("789"), new BigNumber("123")];
    const validSince = [1000, 2500, 1500, 1500];
    const hashes = [1, 2, 3, 4];
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    await tradeDelegate.setCutoffs(orderOwner1, 2000, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), false, "Order should be cancelled");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
  });

  it("should be able to cancel all trading pair orders of an owner address up to a set time", async () => {
    const tradingPairToCancel = new BigNumber("666");
    const owners = [orderOwner1, orderOwner1, orderOwner1, orderOwner2];
    const tradingPairs = [tradingPairToCancel, tradingPairToCancel, new BigNumber("789"), tradingPairToCancel];
    const validSince = [3000, 1000, 1000, 1000];
    const hashes = [1, 2, 3, 4];
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    await tradeDelegate.setTradingPairCutoffs(orderOwner1, tradingPairToCancel, 2000, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
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
    const tradingPairs = [new BigNumber("123"), new BigNumber("426"), new BigNumber("789"), new BigNumber("123")];
    const validSince = [3000, 1000, 1000, 1000];
    const hashes = [orderHashOwner1ToCancel, 2, orderHashOwner2ToCancel, 4];
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be valid");
      assert.equal(bits.testn(2), true, "Order should be valid");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    await tradeDelegate.setCancelled(orderOwner2, orderHashOwner2ToCancel, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
      assert.equal(bits.testn(1), true, "Order should be invalid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
    await tradeDelegate.setCancelled(orderOwner1, orderHashOwner1ToCancel, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.checkCutoffsAndCancelledBatch(
        owners, tradingPairs, validSince, hashes, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), false, "Order should be cancelled");
      assert.equal(bits.testn(1), true, "Order should be invalid");
      assert.equal(bits.testn(2), false, "Order should be cancelled");
      assert.equal(bits.testn(3), true, "Order should be valid");
    }
  });

});
