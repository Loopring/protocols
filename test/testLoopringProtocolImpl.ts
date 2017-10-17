import * as _ from 'lodash';
import { BigNumber } from 'bignumber.js';
import { Artifacts } from '../util/artifacts';
import { OrderParams } from '../util/types';
import { Order } from '../util/order';
import { Ring } from '../util/ring';
import { RingFactory } from '../util/ring_factory';
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
  const order4Owner = accounts[4];
  const order5Owner = accounts[5];
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
  let delegateAddr: string;

  let lrc: any;
  let eos: any;
  let neo: any;

  let ringFactory: RingFactory;

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
    delegateAddr = TokenTransferDelegate.address;

    tokenTransferDelegate.addVersion(LoopringProtocolImpl.address);

    [lrc, eos, neo] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(neoAddress),
    ]);

    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    ringFactory = new RingFactory(LoopringProtocolImpl.address,
                                  eosAddress,
                                  neoAddress,
                                  lrcAddress,
                                  currBlockTimeStamp);

    // approve only once for all tests.
    await eos.approve(delegateAddr, web3.toWei(1000000), {from: order1Owner});
    await eos.approve(delegateAddr, web3.toWei(1000000), {from: order2Owner});

    await neo.approve(delegateAddr, web3.toWei(1000000), {from: order1Owner});
    await neo.approve(delegateAddr, web3.toWei(1000000), {from: order2Owner});

    await lrc.approve(delegateAddr, web3.toWei(1000000), {from: order1Owner});
    await lrc.approve(delegateAddr, web3.toWei(1000000), {from: order2Owner});

  });

  describe('submitRing', () => {
    it('should be able to fill orders.', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);

      await lrc.setBalance(order1Owner, web3.toWei(1),   {from: owner});
      await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(100),   {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});
      await lrc.setBalance(feeRecepient, 0, {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient, true);
      const ethOfOwnerBefore = await getEthBalanceAsync(owner);

      try {
        const tx1 =  await loopringProtocolImpl.submitRing(p.addressList,
                                                           p.uintArgsList,
                                                           p.uint8ArgsList,
                                                           p.buyNoMoreThanAmountBList,
                                                           p.vList,
                                                           p.rList,
                                                           p.sList,
                                                           p.ringOwner,
                                                           p.feeRecepient,
                                                           p.throwIfLRCIsInsuffcient,
                                                           {from: owner});
      } catch (err) {
        const errMsg = `${err}`;
        //console.log("errMsg:", errMsg);
        assert(_.includes(errMsg, 'invalid opcode'), `Expected contract to throw, got: ${err}`);
      }

      await lrc.setBalance(order1Owner, web3.toWei(100),   {from: owner});
      const tx2 = await loopringProtocolImpl.submitRing(p.addressList,
                                                        p.uintArgsList,
                                                        p.uint8ArgsList,
                                                        p.buyNoMoreThanAmountBList,
                                                        p.vList,
                                                        p.rList,
                                                        p.sList,
                                                        p.ringOwner,
                                                        p.feeRecepient,
                                                        p.throwIfLRCIsInsuffcient,
                                                        {from: owner});
      //console.log("tx:", tx2);
      //console.log(tx2.receipt.logs);

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost(ether):", allGas);

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
      assert.equal(eosBalance22.toNumber(), 1000e18, "eos balance not match for order2Owner.");
      assert.equal(neoBalance22.toNumber(), 900e18, "neo balance not match for order2Owner.");

      assert.equal(lrcBalance23.toNumber(), 20e18, "lrc balance not match for feeRecepient.");

      await eos.setBalance(order1Owner, 0, {from: owner});
      await eos.setBalance(order2Owner, 0, {from: owner});

      await neo.setBalance(order1Owner, 0, {from: owner});
      await neo.setBalance(order2Owner, 0, {from: owner});

      await lrc.setBalance(order1Owner, 0, {from: owner});
      await lrc.setBalance(order2Owner, 0, {from: owner});
      await lrc.setBalance(feeRecepient, 0, {from: owner});
    });

    it('should be able to fill orders where fee selection type is margin split.', async () => {
      const ring = await ringFactory.generateSize2Ring02(order1Owner, order2Owner, ringOwner);

      await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, [1, 1], feeRecepient, true);

      const ethOfOwnerBefore = await getEthBalanceAsync(owner);

      const tx = await loopringProtocolImpl.submitRing(p.addressList,
                                                        p.uintArgsList,
                                                        p.uint8ArgsList,
                                                        p.buyNoMoreThanAmountBList,
                                                        p.vList,
                                                        p.rList,
                                                        p.sList,
                                                        p.ringOwner,
                                                        p.feeRecepient,
                                                        p.throwIfLRCIsInsuffcient,
                                                        {from: owner});

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost(ether):", allGas);

      //const lrcBalance21 = await getTokenBalanceAsync(lrc, order1Owner);
      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      //const lrcBalance22 = await getTokenBalanceAsync(lrc, order2Owner);
      const eosBalance22 = await getTokenBalanceAsync(eos, order2Owner);
      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);

      const eosBalance23 = await getTokenBalanceAsync(eos, feeRecepient);
      const neoBalance23 = await getTokenBalanceAsync(neo, feeRecepient);

      console.log("eosBalance21:", eosBalance21, "neoBalance21:", neoBalance21);
      console.log("eosBalance22:", eosBalance22, "neoBalance22:", neoBalance22);
      console.log("eosBalance23:", eosBalance23, "neoBalance23:", neoBalance23);

      const rateAmountS = ringFactory.caculateRateAmountS(ring);

      const eosBalance21Expected = (10000e18 - rateAmountS[0].toNumber()).toPrecision(6);
      const neoBalance21Expected = rateAmountS[1].toNumber().toPrecision(6);

      const eosBalance22Expected = rateAmountS[0].toNumber().toPrecision(6);

      // assert.equal(lrcBalance21.toNumber(), 90e18, "lrc balance not match for order1Owner.");
      assert.equal(eosBalance21.toNumber().toPrecision(6), eosBalance21Expected, "eos balance not match for order1Owner.");
      assert.equal(neoBalance21.toNumber().toPrecision(6), neoBalance21Expected, "neo balance not match for order1Owner.");

      // assert.equal(lrcBalance22.toNumber(), 90e18, "lrc balance not match for order2Owner.");
      assert.equal(eosBalance22.toNumber().toPrecision(6), 900e18, "eos balance not match for order2Owner.");
      assert.equal(neoBalance22.toNumber().toPrecision(6), 900e18, "neo balance not match for order2Owner.");

      // assert.equal(lrcBalance23.toNumber(), 0, "lrc balance not match for feeRecepient.");
    });

  });

})
