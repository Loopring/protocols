import * as _ from 'lodash';
import { BigNumber } from 'bignumber.js';
import { Artifacts } from '../util/artifacts';
import { OrderParams } from '../util/types';
import { Order } from '../util/order';
import { Ring } from '../util/ring';
import { RingFactory } from '../util/ring_factory';
import { ProtocolSimulator } from '../util/protocol_simulator';
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
  let qtumAddress: string;
  let delegateAddr: string;

  let lrc: any;
  let eos: any;
  let neo: any;
  let qtum: any;

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

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = (n1/1e18).toFixed(precision);
    const numStr2 = (n2/1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  }

  const clear = async (tokens: any[], addresses: string[]) => {
    for (let i = 0; i < tokens.length; i ++) {
      for (let j = 0; j < addresses.length; j++) {
        await tokens[i].setBalance(addresses[j], 0, {from: owner});
      }
    }
  }

  const approve = async (tokens: any[], addresses: string[], amounts: number[]) => {
    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].approve(delegateAddr, 0, {from: addresses[i]});
      await tokens[i].approve(delegateAddr, amounts[i], {from: addresses[i]});
    }
  }

  before( async () => {
    [loopringProtocolImpl, tokenRegistry, tokenTransferDelegate] = await Promise.all([
      LoopringProtocolImpl.deployed(),
      TokenRegistry.deployed(),
      TokenTransferDelegate.deployed(),
    ]);

    lrcAddress = await tokenRegistry.getAddressBySymbol("LRC");
    eosAddress = await tokenRegistry.getAddressBySymbol("EOS");
    neoAddress = await tokenRegistry.getAddressBySymbol("NEO");
    qtumAddress = await tokenRegistry.getAddressBySymbol("QTUM");
    delegateAddr = TokenTransferDelegate.address;

    tokenTransferDelegate.addVersion(LoopringProtocolImpl.address);

    [lrc, eos, neo, qtum] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(neoAddress),
      DummyToken.at(qtumAddress),
    ]);

    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    ringFactory = new RingFactory(LoopringProtocolImpl.address,
                                  eosAddress,
                                  neoAddress,
                                  lrcAddress,
                                  qtumAddress,
                                  currBlockTimeStamp);

    // approve only once for all test cases.
    const allTokens = [lrc, eos, neo, qtum];
    const allAddresses = [order1Owner, order2Owner, order3Owner, feeRecepient];
    for (let i = 0; i < allTokens.length; i++) {
      for (let j = 0; j < allAddresses.length; j++) {
        await allTokens[i].approve(delegateAddr, web3.toWei(1000000), {from: allAddresses[j]});
      }
    }
  });

  describe('submitRing', () => {
    it('should be able to fill ring with 2 orders', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);

      await lrc.setBalance(order1Owner, web3.toWei(100),   {from: owner});
      await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(100),   {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});
      await lrc.setBalance(feeRecepient, 0, {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);

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
                                                        {from: owner});

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost for 2 orders 01(ether):", allGas);

      const lrcBalance21 = await getTokenBalanceAsync(lrc, order1Owner);
      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const lrcBalance22 = await getTokenBalanceAsync(lrc, order2Owner);
      const eosBalance22 = await getTokenBalanceAsync(eos, order2Owner);
      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);

      const lrcBalance23 = await getTokenBalanceAsync(lrc, feeRecepient);

      assert.equal(lrcBalance21.toNumber(), 90e18, "lrc balance not match for order1Owner");
      assert.equal(eosBalance21.toNumber(), 9000e18, "eos balance not match for order1Owner");
      assert.equal(neoBalance21.toNumber(), 100e18, "neo balance not match for order1Owner");

      assert.equal(lrcBalance22.toNumber(), 95e18, "lrc balance not match for order2Owner");
      assert.equal(eosBalance22.toNumber(), 1000e18, "eos balance not match for order2Owner");
      assert.equal(neoBalance22.toNumber(), 900e18, "neo balance not match for order2Owner");

      assert.equal(lrcBalance23.toNumber(), 15e18, "lrc balance not match for feeRecepient");

      await clear([eos, neo, lrc], [order1Owner, order2Owner, feeRecepient]);
    });

    it('should be able to fill ring with 2 orders where fee selection type is margin split', async () => {
      const ring = await ringFactory.generateSize2Ring02(order1Owner, order2Owner, ringOwner);
      const feeSelectionList = [1, 1];

      await eos.setBalance(order1Owner, web3.toWei(1000), {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(50),  {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, feeSelectionList, feeRecepient);

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
                                                       {from: owner});

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost for 2 orders 02(ether):", allGas);

      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const eosBalance22 = await getTokenBalanceAsync(eos, order2Owner);
      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);

      const eosBalance23 = await getTokenBalanceAsync(eos, feeRecepient);
      const neoBalance23 = await getTokenBalanceAsync(neo, feeRecepient);

      const simulator = new ProtocolSimulator(ring, lrcAddress, feeSelectionList);
      const feeAndBalanceExpected = simulator.caculateRingFeesAndBalances();

      // console.log("feeAndBalanceExpected:", feeAndBalanceExpected);
      // console.log("eosBalance21:", eosBalance21, "neoBalance21:", neoBalance21);
      // console.log("eosBalance22:", eosBalance22, "neoBalance22:", neoBalance22);
      // console.log("eosBalance23:", eosBalance23, "neoBalance23:", neoBalance23);

      assertNumberEqualsWithPrecision(eosBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceS);
      assertNumberEqualsWithPrecision(neoBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceB);
      assertNumberEqualsWithPrecision(neoBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceS);
      assertNumberEqualsWithPrecision(eosBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceB);

      assertNumberEqualsWithPrecision(eosBalance23.toNumber(), feeAndBalanceExpected.totalFees[eosAddress]);
      assertNumberEqualsWithPrecision(neoBalance23.toNumber(), feeAndBalanceExpected.totalFees[neoAddress]);

      await clear([eos, neo], [order1Owner, order2Owner, feeRecepient]);
    });

    it('should be able to fill orders where fee selection type is margin split and lrc', async () => {
      const ring = await ringFactory.generateSize2Ring03(order1Owner, order2Owner, ringOwner);

      const feeSelectionList = [1, 0];

      await eos.setBalance(order1Owner, web3.toWei(1000), {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(50),  {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(20),  {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, feeSelectionList, feeRecepient);
      // const p = ringFactory.ringToSubmitableParams(ring, feeSelectionList, feeRecepient, true);

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
                                                       {from: owner});
      //console.log(tx.receipt.logs);

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost(ether):", allGas);

      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const eosBalance22 = await getTokenBalanceAsync(eos, order2Owner);
      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);

      const eosBalance23 = await getTokenBalanceAsync(eos, feeRecepient);
      const neoBalance23 = await getTokenBalanceAsync(neo, feeRecepient);
      const lrcBalance23 = await getTokenBalanceAsync(lrc, feeRecepient);

      const simulator = new ProtocolSimulator(ring, lrcAddress, feeSelectionList);
      const feeAndBalanceExpected = simulator.caculateRingFeesAndBalances();

      assertNumberEqualsWithPrecision(eosBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceS);
      assertNumberEqualsWithPrecision(neoBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceB);
      assertNumberEqualsWithPrecision(neoBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceS);
      assertNumberEqualsWithPrecision(eosBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceB);
      assertNumberEqualsWithPrecision(eosBalance23.toNumber(), feeAndBalanceExpected.totalFees[eosAddress]);
      assertNumberEqualsWithPrecision(neoBalance23.toNumber(), feeAndBalanceExpected.totalFees[neoAddress]);
      assertNumberEqualsWithPrecision(lrcBalance23.toNumber(), feeAndBalanceExpected.totalFees[lrcAddress]);

      await clear([eos, neo, lrc], [order1Owner, order2Owner, feeRecepient]);
    });

    it('should be able to fill ring with 3 orders', async () => {
      const ring = await ringFactory.generateSize3Ring01(order1Owner, order2Owner, order3Owner, ringOwner);

      assert(ring.orders[0].isValidSignature(), "invalid signature");
      assert(ring.orders[1].isValidSignature(), "invalid signature");
      assert(ring.orders[2].isValidSignature(), "invalid signature");

      const feeSelectionList = [1, 0, 1];

      await eos.setBalance(order1Owner, web3.toWei(80000), {from: owner});
      await neo.setBalance(order2Owner, web3.toWei(234),  {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(5),  {from: owner}); // insuffcient lrc balance.
      await qtum.setBalance(order3Owner, web3.toWei(6780),  {from: owner});

      const p = ringFactory.ringToSubmitableParams(ring, feeSelectionList, feeRecepient);

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
                                                       {from: owner});

      //console.log(tx.receipt.logs);
      console.log("cumulativeGasUsed for a ring of 3 orders: " + tx.receipt.gasUsed);

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost for 3 orders(ether):", allGas);

      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);
      const qtumBalance22 = await getTokenBalanceAsync(qtum, order2Owner);

      const qtumBalance23 = await getTokenBalanceAsync(qtum, order3Owner);
      const eosBalance23 = await getTokenBalanceAsync(eos, order3Owner);

      const eosBalance24 = await getTokenBalanceAsync(eos, feeRecepient);
      const neoBalance24 = await getTokenBalanceAsync(neo, feeRecepient);
      const qtumBalance24 = await getTokenBalanceAsync(qtum, feeRecepient);
      const lrcBalance24 = await getTokenBalanceAsync(lrc, feeRecepient);

      // console.log("feeAndBalanceExpected", feeAndBalanceExpected);

      // console.log("eosBalance21:", eosBalance21);
      // console.log("neoBalance21:", neoBalance21);
      // console.log("neoBalance22:", neoBalance22);
      // console.log("qtumBalance22:", qtumBalance22);
      // console.log("qtumBalance23:", qtumBalance23);
      // console.log("eosBalance23:", eosBalance23);
      // console.log("eosBalance24:", eosBalance24);
      // console.log("neoBalance24:", neoBalance24);
      // console.log("qtumBalance24:", qtumBalance24);
      // console.log("lrcBalance24:", lrcBalance24);

      const simulator = new ProtocolSimulator(ring, lrcAddress, feeSelectionList);
      const feeAndBalanceExpected = simulator.caculateRingFeesAndBalances();

      assertNumberEqualsWithPrecision(eosBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceS);
      assertNumberEqualsWithPrecision(neoBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceB);
      assertNumberEqualsWithPrecision(neoBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceS);
      assertNumberEqualsWithPrecision(qtumBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceB);

      assertNumberEqualsWithPrecision(qtumBalance23.toNumber(), feeAndBalanceExpected.balances[2].balanceS);
      assertNumberEqualsWithPrecision(eosBalance23.toNumber(), feeAndBalanceExpected.balances[2].balanceB);

      assertNumberEqualsWithPrecision(eosBalance24.toNumber(), feeAndBalanceExpected.totalFees[eosAddress]);
      assertNumberEqualsWithPrecision(neoBalance24.toNumber(), feeAndBalanceExpected.totalFees[neoAddress]);
      assertNumberEqualsWithPrecision(qtumBalance24.toNumber(), feeAndBalanceExpected.totalFees[qtumAddress]);
      assertNumberEqualsWithPrecision(lrcBalance24.toNumber(), 5e18);

      await clear([eos, neo, lrc, qtum], [order1Owner, order2Owner, order3Owner, feeRecepient]);
    });

    it('should be able to partial fill ring with 3 orders', async () => {
      const ring = await ringFactory.generateSize3Ring02(order1Owner, order2Owner, order3Owner, ringOwner);

      assert(ring.orders[0].isValidSignature(), "invalid signature");
      assert(ring.orders[1].isValidSignature(), "invalid signature");
      assert(ring.orders[2].isValidSignature(), "invalid signature");

      const feeSelectionList = [1, 0, 1];

      const availableAmountSList = [10000e18, 100e18, 10000e18];
      const balanceSList = [ring.orders[0].params.amountS.toNumber(),
                            ring.orders[1].params.amountS.toNumber(),
                            ring.orders[2].params.amountS.toNumber()];

      await eos.setBalance(order1Owner, balanceSList[0], {from: owner});
      await neo.setBalance(order2Owner, balanceSList[1],  {from: owner});
      await lrc.setBalance(order2Owner, web3.toWei(15),  {from: owner});
      await qtum.setBalance(order3Owner, balanceSList[2],  {from: owner});

      await approve([eos, neo, qtum], [order1Owner, order2Owner, order3Owner], availableAmountSList);

      const p = ringFactory.ringToSubmitableParams(ring, feeSelectionList, feeRecepient);

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
                                                       {from: owner});

      const ethOfOwnerAfter = await getEthBalanceAsync(owner);
      const allGas = (ethOfOwnerBefore.toNumber() - ethOfOwnerAfter.toNumber())/1e18;
      //console.log("all gas cost(ether):", allGas);

      const eosBalance21 = await getTokenBalanceAsync(eos, order1Owner);
      const neoBalance21 = await getTokenBalanceAsync(neo, order1Owner);

      const neoBalance22 = await getTokenBalanceAsync(neo, order2Owner);
      const qtumBalance22 = await getTokenBalanceAsync(qtum, order2Owner);

      const qtumBalance23 = await getTokenBalanceAsync(qtum, order3Owner);
      const eosBalance23 = await getTokenBalanceAsync(eos, order3Owner);

      const eosBalance24 = await getTokenBalanceAsync(eos, feeRecepient);
      const neoBalance24 = await getTokenBalanceAsync(neo, feeRecepient);
      const qtumBalance24 = await getTokenBalanceAsync(qtum, feeRecepient);
      const lrcBalance24 = await getTokenBalanceAsync(lrc, feeRecepient);

      const simulator = new ProtocolSimulator(ring, lrcAddress, feeSelectionList);
      simulator.availableAmountSList = availableAmountSList;
      const feeAndBalanceExpected = simulator.caculateRingFeesAndBalances();

      // console.log("feeAndBalanceExpected", feeAndBalanceExpected);

      // console.log("eosBalance21:", eosBalance21);
      // console.log("neoBalance21:", neoBalance21);
      // console.log("neoBalance22:", neoBalance22);
      // console.log("qtumBalance22:", qtumBalance22);
      // console.log("qtumBalance23:", qtumBalance23);
      // console.log("eosBalance23:", eosBalance23);
      // console.log("eosBalance24:", eosBalance24);
      // console.log("neoBalance24:", neoBalance24);
      // console.log("qtumBalance24:", qtumBalance24);
      // console.log("lrcBalance24:", lrcBalance24);

      assertNumberEqualsWithPrecision(eosBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceS, 6);
      assertNumberEqualsWithPrecision(neoBalance21.toNumber(), feeAndBalanceExpected.balances[0].balanceB);
      assertNumberEqualsWithPrecision(neoBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceS);
      assertNumberEqualsWithPrecision(qtumBalance22.toNumber(), feeAndBalanceExpected.balances[1].balanceB);

      assertNumberEqualsWithPrecision(qtumBalance23.toNumber(), feeAndBalanceExpected.balances[2].balanceS);
      assertNumberEqualsWithPrecision(eosBalance23.toNumber(), feeAndBalanceExpected.balances[2].balanceB);

      assertNumberEqualsWithPrecision(eosBalance24.toNumber(), feeAndBalanceExpected.totalFees[eosAddress]);
      assertNumberEqualsWithPrecision(neoBalance24.toNumber(), feeAndBalanceExpected.totalFees[neoAddress]);
      assertNumberEqualsWithPrecision(qtumBalance24.toNumber(), feeAndBalanceExpected.totalFees[qtumAddress]);
      assertNumberEqualsWithPrecision(lrcBalance24.toNumber(), feeAndBalanceExpected.totalFees[lrcAddress]);

      await clear([eos, neo, lrc, qtum], [order1Owner, order2Owner, order3Owner, feeRecepient]);
    });

  });


  describe('cancelOrder', () => {
    it('should be able to set order cancelled amount by order owner', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const order = ring.orders[0];
      const cancelAmount = new BigNumber(100e18);

      const addresses = [order.owner, order.params.tokenS, order.params.tokenB];
      const orderValues = [order.params.amountS,
                           order.params.amountB,
                           order.params.timestamp,
                           order.params.ttl,
                           order.params.salt,
                           order.params.lrcFee,
                           cancelAmount];

      const cancelledOrFilledAmount0 = await loopringProtocolImpl.cancelledOrFilled(order.params.orderHashHex);
      const tx = await loopringProtocolImpl.cancelOrder(addresses,
                                                        orderValues,
                                                        order.params.buyNoMoreThanAmountB,
                                                        order.params.marginSplitPercentage,
                                                        order.params.v,
                                                        order.params.r,
                                                        order.params.s,
                                                        {from: order.owner});

      const cancelledOrFilledAmount1 = await loopringProtocolImpl.cancelledOrFilled(order.params.orderHashHex);
      assert.equal(cancelledOrFilledAmount1.minus(cancelledOrFilledAmount0).toNumber(),
        cancelAmount.toNumber(), "cancelled amount not match");
    });

    it('should not be able to cancell order by other address', async () => {
      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const order = ring.orders[0];
      const cancelAmount = new BigNumber(100e18);

      const addresses = [order.owner, order.params.tokenS, order.params.tokenB];
      const orderValues = [order.params.amountS,
                           order.params.amountB,
                           order.params.timestamp,
                           order.params.ttl,
                           order.params.salt,
                           order.params.lrcFee,
                           cancelAmount];
      try {
        const tx = await loopringProtocolImpl.cancelOrder(addresses,
                                                          orderValues,
                                                          order.params.buyNoMoreThanAmountB,
                                                          order.params.marginSplitPercentage,
                                                          order.params.v,
                                                          order.params.r,
                                                          order.params.s,
                                                          {from: order2Owner});
      } catch (err) {
        const errMsg = `${err}`;
        assert(_.includes(errMsg, 'Error: VM Exception while processing transaction: revert'), `Expected contract to throw, got: ${err}`);
      }
    });
  });


  describe('setCutoff', () => {
    it('should be able to set cutoff timestamp for msg sender', async () => {
      await loopringProtocolImpl.setCutoff(new BigNumber(1508566125), {from: order1Owner});
      let cutoff = await loopringProtocolImpl.cutoffs(order1Owner);
      assert.equal(cutoff.toNumber(), 1508566125, "cutoff not set correctly");
    });
  });

})
