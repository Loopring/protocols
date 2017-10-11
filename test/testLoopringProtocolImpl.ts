import { BigNumber } from 'bignumber.js';
import { Artifacts } from '../util/artifacts';
import { OrderParams } from '../util/types';
import { Order } from '../util/order';
import { Ring } from '../util/ring';
import promisify = require('es6-promisify');

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
  const order3Owner = accounts[3];
  const ringOwner = accounts[0];
  const feeRecepient = accounts[6];
  let loopringProtocolImpl: any;
  let tokenRegistry: any;
  let tokenTransferDelegate: any;
  let order1: Order;
  let order2: Order;
  let ring: Ring;
  let lrcAddress: string;
  let eosAddress: string;
  let neoAddress: string;

  let lrc: any;
  let eos: any;
  let neo: any;

  const getTokenBalanceAsync = async (token: any, addr: string) => {
    const tokenBalanceStr = await token.balanceOf(addr);
    const balance = new BigNumber(tokenBalanceStr);
    return balance;
  }

  const getEthBalanceAsync = async (addr: string) => {
    const balanceStr = await promisify(web3.eth.getBalance)(addr);
    const balance = new BigNumber(balanceStr);
    return balance;
  };

  before( async () => {
    [loopringProtocolImpl, tokenRegistry, tokenTransferDelegate] = await Promise.all([
      LoopringProtocolImpl.deployed(),
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    neoAddress = await tokenRegistry.getAddressBySymbol("NEO");

    tokenTransferDelegate.addVersion(LoopringProtocolImpl.address);

    [lrc, eos, neo] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(neoAddress),
    ]);

  });

  describe('submitRing', () => {
    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    it('should be able to fill orders.', async () => {
      await lrc.setBalance(order1Owner, web3.toWei(100),   {from: owner});
      await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(100),   {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});
      await lrc.setBalance(feeRecepient, 0, {from: owner});

      const delegateAddr = TokenTransferDelegate.address;
      await lrc.approve(delegateAddr, web3.toWei(100000), {from: order1Owner});
      await eos.approve(delegateAddr, web3.toWei(100000), {from: order1Owner});
      await lrc.approve(delegateAddr, web3.toWei(100000), {from: order2Owner});
      await neo.approve(delegateAddr, web3.toWei(100000), {from: order2Owner});

      const orderPrams1 = {
        loopringProtocol: LoopringProtocolImpl.address,
        tokenS: eosAddress,
        tokenB: neoAddress,
        amountS: new BigNumber(1000e18),
        amountB: new BigNumber(100e18),
        timestamp: new BigNumber(currBlockTimeStamp),
        ttl: new BigNumber(360000),
        salt: new BigNumber(1234),
        lrcFee: new BigNumber(10e18),
        buyNoMoreThanAmountB: false,
        marginSplitPercentage: 0,
      };

      const orderPrams2 = {
        loopringProtocol: LoopringProtocolImpl.address,
        tokenS: neoAddress,
        tokenB: eosAddress,
        amountS: new BigNumber(100e18),
        amountB: new BigNumber(1000e18),
        timestamp: new BigNumber(currBlockTimeStamp),
        ttl: new BigNumber(360000),
        salt: new BigNumber(4321),
        lrcFee: new BigNumber(10e18),
        buyNoMoreThanAmountB: false,
        marginSplitPercentage: 0,
      };

      order1 = new Order(order1Owner, orderPrams1);
      order2 = new Order(order2Owner, orderPrams2);
      await order1.signAsync();
      await order2.signAsync();

      ring = new Ring(ringOwner, [order1, order2]);
      await ring.signAsync();

      assert(order1.isValidSignature());
      assert(order2.isValidSignature());
      assert(ring.isValidSignature());

      const addressList = [
        [order1Owner, order1.params.tokenS],
        [order2Owner, order2.params.tokenS]
      ];

      const uintArgsList = [
        [order1.params.amountS,
         order1.params.amountB,
         order1.params.timestamp,
         order1.params.ttl,
         order1.params.salt,
         order1.params.lrcFee,
         order1.params.amountS
        ],
        [order2.params.amountS,
         order2.params.amountB,
         order2.params.timestamp,
         order2.params.ttl,
         order2.params.salt,
         order2.params.lrcFee,
         order2.params.amountS,
        ]
      ];

      const uint8ArgsList = [
        [0, 0],
        [0, 0],
      ];

      const buyNoMoreThanAmountBList = [order1.params.buyNoMoreThanAmountB,
                                        order1.params.buyNoMoreThanAmountB];
      const vList = [order1.params.v, order2.params.v, ring.v];
      const rList = [order1.params.r, order2.params.r, ring.r];
      const sList = [order1.params.s, order2.params.s, ring.s];

      const throwIfLRCIsInsuffcient = true;

      // const lrcBalance11 = await getTokenBalanceAsync(lrc, order1Owner);
      // const eosBalance11 = await getTokenBalanceAsync(eos, order1Owner);

      // const lrcBalance12 = await getTokenBalanceAsync(lrc, order2Owner);
      // const neoBalance12 = await getTokenBalanceAsync(neo, order2Owner);
      // console.log(lrcBalance11, eosBalance11, lrcBalance12, neoBalance12);

      // console.log(addressList);
      // console.log(order1);
      // console.log(order2);

      //console.log("is valid signature:", order1.isValidSignature())

      const ethOfOwnerBefore = await getEthBalanceAsync(owner);

      const tx =  await loopringProtocolImpl.submitRing(addressList,
                                                        uintArgsList,
                                                        uint8ArgsList,
                                                        buyNoMoreThanAmountBList,
                                                        vList,
                                                        rList,
                                                        sList,
                                                        ringOwner,
                                                        feeRecepient,
                                                        throwIfLRCIsInsuffcient,
                                                        {from: owner}
                                                       );

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      console.log("all gas cost(ether):", allGas);

      //console.log(tx.receipt.logs);

      const lrcBalance21 = await getTokenBalanceAsync(lrc, order1Owner);
      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const lrcBalance22 = await getTokenBalanceAsync(lrc, order2Owner);
      const eosBalance22 = await getTokenBalanceAsync(eos, order2Owner);
      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);

      const lrcBalance23 = await getTokenBalanceAsync(lrc, feeRecepient);

      assert.equal(lrcBalance21.toNumber(), 90e18, "lrc balance not match for order1Owner.");
      assert.equal(eosBalance21.toNumber(), 9000e18, "eos balance not match for order1Owner.");
      assert.equal(neoBalance21.toNumber(), 100e18, "neo balance not match for order1Owner.");

      assert.equal(lrcBalance22.toNumber(), 90e18, "lrc balance not match for order2Owner.");
      assert.equal(eosBalance22.toNumber(), 1000e18, "neo balance not match for order2Owner.");
      assert.equal(neoBalance22.toNumber(), 900e18, "neo balance not match for order2Owner.");

      assert.equal(lrcBalance23.toNumber(), 20e18, "lrc balance not match for feeRecepient.");




    });

  });

})
