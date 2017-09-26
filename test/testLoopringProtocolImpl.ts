import * as BigNumber from 'bignumber.js';
import { Artifacts } from '../util/artifacts';
import { OrderParams } from '../util/types';
import { Order } from '../util/order';
import { Ring } from '../util/ring';

const {
  LoopringProtocolImpl,
  TokenRegistry,
  TokenTransferDelegate,
  DummyToken,
} = new Artifacts(artifacts);

contract('LoopringProtocolImpl', (accounts: string[])=>{

  const owner = accounts[0];
  const order1Owner = accounts[1];
  const order2Owner = accounts[2];
  const ringOwner = accounts[3];
  let loopringProtocolImpl: any;
  let tokenRegistry: any;
  let tokenTransferDelegate: any;
  let order1: Order;
  let order2: Order;
  let ring: Ring;
  let lrcAddress: string;

  let lrc: any;
  let eos: any;
  let neo: any;

  before( async () => {
    [loopringProtocolImpl, tokenRegistry, tokenTransferDelegate] = await Promise.all([
      LoopringProtocolImpl.deployed(),
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    const eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    const neoAddress = await tokenRegistry.getAddressBySymbol("NEO");

    tokenTransferDelegate.addVersion(LoopringProtocolImpl.address);

    var delegateAddr = TokenTransferDelegate.address;

    [lrc, eos, neo] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(neoAddress),
    ]);

    await lrc.approve(delegateAddr, web3.toWei(100000), {from: order1Owner});
    await eos.approve(delegateAddr, web3.toWei(100000), {from: order1Owner});
    await neo.approve(delegateAddr, web3.toWei(100000), {from: order1Owner});

    await lrc.approve(delegateAddr, web3.toWei(100000), {from: order2Owner});
    await eos.approve(delegateAddr, web3.toWei(100000), {from: order2Owner});
    await neo.approve(delegateAddr, web3.toWei(100000), {from: order2Owner});

    const orderPrams1 = {
      loopringProtocol: LoopringProtocolImpl.address,
      tokenS: eosAddress,
      tokenB: neoAddress,
      amountS: new BigNumber(1000),
      amountB: new BigNumber(100),
      timestamp: currBlockTimeStamp,
      expiration: currBlockTimeStamp + 360000,
      rand: 1234,
      lrcFee: new BigNumber(10),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    const orderPrams2 = {
      loopringProtocol: LoopringProtocolImpl.address,
      tokenS: neoAddress,
      tokenB: eosAddress,
      amountS: new BigNumber(100),
      amountB: new BigNumber(1000),
      timestamp: currBlockTimeStamp,
      expiration: currBlockTimeStamp + 360000,
      rand: 4321,
      lrcFee: new BigNumber(10),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    order1 = new Order(order1Owner, orderPrams1);
    order2 = new Order(order2Owner, orderPrams2);

    await order1.signAsync();
    await order2.signAsync();

    ring = new Ring(ringOwner, [order1, order2]);
    // console.log("order 1:", order1);
    // console.log("order 2:", order2);

    await ring.signAsync();
  });

  describe('submitRing', () => {
    let rateAmountS1 : BigNumber.BigNumber;
    let rateAmountS2 : BigNumber.BigNumber;

    it('should be able to fill orders.', async () => {
      const tokenSList = [order1.params.tokenS, order2.params.tokenS];
      const uintArgsList = [
        [order1.params.amountS,
         order1.params.amountB,
         order1.params.timestamp,
         order1.params.expiration,
         order1.params.rand,
         order1.params.lrcFee,
         order1.params.amountS
        ],
        [order2.params.amountS,
         order2.params.amountB,
         order2.params.timestamp,
         order2.params.expiration,
         order2.params.rand,
         order2.params.lrcFee,
         order2.params.amountS,
        ]
      ];

      const uint8ArgsList = [
        [0, 0],
        [0, 0],
      ];

      const buyNoMoreThanAmountBList = [true, true];
      const vList = [order1.params.v, order2.params.v, ring.v];
      const sList = [order1.params.s, order2.params.s, ring.s];
      const rList = [order1.params.r, order2.params.r, ring.r];

      const feeRecepient = accounts[1];
      const throwIfLRCIsInsuffcient = true;

      const tx =  await loopringProtocolImpl.submitRing(tokenSList,
                                                        uintArgsList,
                                                        uint8ArgsList,
                                                        buyNoMoreThanAmountBList,
                                                        vList,
                                                        sList,
                                                        rList,
                                                        feeRecepient,
                                                        throwIfLRCIsInsuffcient
                                                       );

      console.log("tx:", tx);

    });


  });

})
