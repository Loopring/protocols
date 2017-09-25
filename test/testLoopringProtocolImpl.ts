import * as BigNumber from 'bignumber.js';
import { Artifacts } from '../util/artifacts';
import { OrderParams } from '../util/types';
import { Order } from '../util/order';

const {
  LoopringProtocolImpl,
  TokenRegistry,
  DummyToken,
} = new Artifacts(artifacts);

contract('LoopringProtocolImpl', (accounts: string[])=>{

  const owner = accounts[0];
  let loopringProtocolImpl: any;
  let tokenRegistry: any;
  let order1: Order;
  let order2: Order;
  let lrcAddress: string;

  before( async () => {
    [loopringProtocolImpl, tokenRegistry] = await Promise.all([
      LoopringProtocolImpl.deployed(),
      TokenRegistry.deployed(),
    ]);

    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    const eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    const neoAddress = await tokenRegistry.getAddressBySymbol("NEO");

    const orderPrams1 = {
      loopringProtocol: LoopringProtocolImpl.address,
      tokenS: eosAddress,
      tokenB: neoAddress,
      amountS: new BigNumber(1000),
      amountB: new BigNumber(100),
      expiration: currBlockTimeStamp + 360000,
      rand: 1234,
      lrcFee: new BigNumber(10),
      buyNoMoreThanAmountB: false,
      savingSharePercentage: 0,
      v: 0,
      r: "",
      s: "",
    };

    const orderPrams2 = {
      loopringProtocol: LoopringProtocolImpl.address,
      tokenS: neoAddress,
      tokenB: eosAddress,
      amountS: new BigNumber(100),
      amountB: new BigNumber(1000),
      expiration: currBlockTimeStamp + 360000,
      rand: 4321,
      lrcFee: new BigNumber(10),
      buyNoMoreThanAmountB: false,
      savingSharePercentage: 0,
      v: 0,
      r: "",
      s: "",
    };

    order1 = new Order(owner, orderPrams1);
    order2 = new Order(owner, orderPrams2);

    await order1.signAsync();
    await order2.signAsync();

  });

  describe('submitRing', () => {
    let rateAmountS1 : BigNumber.BigNumber;
    let rateAmountS2 : BigNumber.BigNumber;

    it('should be able to fill orders.', async () => {
      const tokenSList = [order1.params.tokenS, order2.params.tokenS];
      const uintArgsList = [
        [order1.params.amountS,
         order1.params.amountB,
         order1.params.expiration,
         order1.params.rand,
         order1.params.lrcFee,
         order1.params.amountS
        ],
        [order2.params.amountS,
         order2.params.amountB,
         order2.params.expiration,
         order2.params.rand,
         order2.params.lrcFee,
         order2.params.amountS,
        ]
      ];

      const uint8ArgsList = [
        [order1.params.savingSharePercentage,
         0
        ],
        [order2.params.savingSharePercentage,
         0
        ]
      ];

      const buyNoMoreThanAmountBList = [true, true];
      const vList = [order1.params.v, order2.params.v];
      const sList = [order1.params.s, order2.params.s];
      const rList = [order1.params.r, order2.params.r];

      const feeRecepient = accounts[1];
      const throwIfLRCIsInsuffcient = true;

      await loopringProtocolImpl.submitRing(tokenSList,
                                            uintArgsList,
                                            uint8ArgsList,
                                            buyNoMoreThanAmountBList,
                                            vList,
                                            sList,
                                            rList,
                                            feeRecepient,
                                            throwIfLRCIsInsuffcient
                                           );

    });


  });

})
