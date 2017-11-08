import * as _ from 'lodash';
import { Artifacts } from '../util/artifacts';
import { Ring } from '../util/ring';
import { RingFactory } from '../util/ring_factory';

const {
  LoopringProtocolImpl,
  RinghashRegistry,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('RinghashRegistry', (accounts: string[])=>{
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
    //console.log("blocksToLive:", blocksToLive);
  });

  describe('submitRinghash', () => {

    it('should be able to submit a ring hash', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);

      const tx = await ringhashRegistry.submitRinghash(2,
                                                       ringOwner,
                                                       p.vList,
                                                       p.rList,
                                                       p.sList);

      const ringHash = ring.getRingHashHex();
      const isReserved = await ringhashRegistry.isReserved(ringHash, ringOwner);
      assert.equal(isReserved, true, "ring hash not found after summitted");
    });

    it('should be able to submit the same ring hash again by same ringminer', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const ringHash = ring.getRingHashHex();
      const canSubmit1 = await ringhashRegistry.canSubmit(ringHash, ringOwner, {from: owner});
      assert.equal(canSubmit1, true, "can not submit again after summitted by same address");
    });

    it('should not be able to submit the same ring hash again by another address', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const ringHash = ring.getRingHashHex();
      const canSubmit2 = await ringhashRegistry.canSubmit(ringHash, order1Owner, {from: owner});
      assert.equal(canSubmit2, false, "can submit again after summitted by another address");
    });

    it('should not be able to submit a ring hash by a different ringminer if the same hash has submmitted within 100 blocks', async () => {
      try {
        const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
        const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);

        const tx = await ringhashRegistry.submitRinghash(2,
                                                         ringOwner,
                                                         p.vList,
                                                         p.rList,
                                                         p.sList);
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, 'Error: VM Exception while processing transaction: revert'), `Expected contract to throw, got: ${err}`);
      }

    });

  });

});
