import * as _ from "lodash";
import { Artifacts } from "../util/artifacts";
import { Ring } from "../util/ring";
import { RingFactory } from "../util/ring_factory";

const {
  LoopringProtocolImpl,
  RinghashRegistry,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract("RinghashRegistry", (accounts: string[]) => {
  const owner = accounts[0];
  const ringOwner = accounts[0];
  const order1Owner = accounts[1];
  const order2Owner = accounts[2];
  const feeRecepient = accounts[6];

  let ringhashRegistry: any;
  let tokenRegistry: any;
  let loopringProtocolImpl: any;
  let eosAddress: string;
  let neoAddress: string;
  let lrcAddress: string;
  let qtumAddress: string;
  let ringFactory: RingFactory;
  let blocksToLive: number;

  const advanceBlocks = async (count: number) => {
    for (let i = 0; i < count; i++) {
      await web3.eth.sendTransaction({from: owner, to: feeRecepient, value: 1, gas: 30000});
    }
  };

  before(async () => {
    [loopringProtocolImpl, tokenRegistry, ringhashRegistry] = await Promise.all([
      LoopringProtocolImpl.deployed(),
      TokenRegistry.deployed(),
      RinghashRegistry.deployed(),
    ]);

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    neoAddress = await tokenRegistry.getAddressBySymbol("NEO");
    qtumAddress = await tokenRegistry.getAddressBySymbol("QTUM");

    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    ringFactory = new RingFactory(LoopringProtocolImpl.address,
                                  eosAddress,
                                  neoAddress,
                                  lrcAddress,
                                  qtumAddress,
                                  currBlockTimeStamp);
    const blocksToLiveBN = await ringhashRegistry.blocksToLive();
    blocksToLive = blocksToLiveBN.toNumber();
    // console.log("blocksToLive:", blocksToLive);
  });

  describe("submitRinghash", () => {

    it("should be able to submit a ring hash", async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);
      const ringHash = ring.getRingHashHex();
      const tx = await ringhashRegistry.submitRinghash(ringOwner, ringHash);

      const isReserved = await ringhashRegistry.isReserved(ringHash, ringOwner);
      assert.equal(isReserved, true, "ring hash not found after summitted");
    });

    it("should be able to submit the same ring hash again by same ringminer", async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const ringHash = ring.getRingHashHex();
      const canSubmit1 = await ringhashRegistry.canSubmit(ringHash, ringOwner, {from: owner});
      assert.equal(canSubmit1, true, "can not submit again after summitted by same address");
    });

    it("should not be able to submit the same ring hash again by another address", async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const ringHash = ring.getRingHashHex();
      const canSubmit2 = await ringhashRegistry.canSubmit(ringHash, order1Owner, {from: owner});
      assert.equal(canSubmit2, false, "can submit again after summitted by another address");
    });

    it("should be able to submit ringhash again by others after 100 blocks.", async () => {
      await advanceBlocks(blocksToLive + 1);

      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const ringHash = ring.getRingHashHex();
      const canSubmit2 = await ringhashRegistry.canSubmit(ringHash, order1Owner, {from: owner});
      assert.equal(canSubmit2, true, "can submit again by another address after N blocks.");

      await ringhashRegistry.submitRinghash(order1Owner, ringHash);
      const isReserved = await ringhashRegistry.isReserved(ringHash, order1Owner);
      assert.equal(isReserved, true, "ring hash not found after summitted");
    });

    it("should be able to submit ringhashs in batch", async () => {
      const ringminerList = [accounts[0], accounts[2], accounts[3]];
      const ringhashList = ["0xabc", "0x12ab", "0xcb4d3"]; // mock ringhashList.
      const tx = await ringhashRegistry.batchSubmitRinghash(ringminerList, ringhashList);

      for (let i = 0; i < ringminerList.length; i++) {
        const isReserved = await ringhashRegistry.isReserved(ringhashList[i], ringminerList[i]);
        assert.equal(isReserved, true, "ring hash not found after summitted");
      }
    });

    it(`should not be able to submit a ring hash by a different ringminer
        if the same hash has submmitted within 100 blocks`, async () => {
      try {
        const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
        const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);
        const ringHash = ring.getRingHashHex();

        const tx = await ringhashRegistry.submitRinghash(ringOwner, ringHash);
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
               `Expected contract to throw, got: ${err}`);
      }

    });

  });

});
