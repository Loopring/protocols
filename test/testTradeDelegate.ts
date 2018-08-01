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
  const orderOwner = accounts[5];

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

  it("contract owner should be able to authorize an address", async () => {
    await tradeDelegate.authorizeAddress(loopringProtocolV1, {from: owner});
    const authorized = await tradeDelegate.isAddressAuthorized(loopringProtocolV1);
    assert(authorized, "address is not authorized.");
  });

  it("should be able to check if order cutoffs are valid", async () => {
    const owners = [orderOwner];
    const tradingPairs = [new Buffer("123", "hex")];
    const validSince = [1];
    const result = await tradeDelegate.checkCutoffsBatch(owners, tradingPairs, validSince, {from: owner});
    const bits = new BN(result.toString(16), 16);
    assert.equal(bits.testn(0), true, "Order cutoff should be valid");
  });

  it("protocol contract should be able to cancel all orders of an owner address up to a set time", async () => {
    const owners = [orderOwner];
    const tradingPairs = [new Buffer("123", "hex")];
    const validSince = [1000];
    {
      const result = await tradeDelegate.checkCutoffsBatch(owners, tradingPairs, validSince, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), true, "Order should be valid");
    }
    await tradeDelegate.setCutoffs(orderOwner, 2000, {from: loopringProtocolV1});
    {
      const result = await tradeDelegate.checkCutoffsBatch(owners, tradingPairs, validSince, {from: owner});
      const bits = new BN(result.toString(16), 16);
      assert.equal(bits.testn(0), false, "Order should be invalid");
    }
  });

});
