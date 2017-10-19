import { BigNumber } from 'bignumber.js';
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
  });

  describe('submitRinghash', () => {

    it('should be able to submit a ring hash', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient, true);

      const tx = await ringhashRegistry.submitRinghash(2,
                                                       ringOwner,
                                                       p.vList,
                                                       p.rList,
                                                       p.sList);

      const ringHash = ring.getRingHashHex();
      const canSubmit = await ringhashRegistry.canSubmit(ringHash, ringOwner, {from: owner});
      assert(canSubmit, false, "can submit again after summitted.");

      const ringhashFound = await ringhashRegistry.ringhashFound(ringHash);
      assert(ringhashFound, true, "ring hash not found after summitted.");
    });

  });

});
