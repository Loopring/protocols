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
  });

  describe('submitRing', () => {
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

      const ring = await ringFactory.generateSize2Ring01(order1Owner, order2Owner, ringOwner);
      const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient, true);

      const ethOfOwnerBefore = await getEthBalanceAsync(owner);

      const tx =  await loopringProtocolImpl.submitRing(p.addressList,
                                                        p.uintArgsList,
                                                        p.uint8ArgsList,
                                                        p.buyNoMoreThanAmountBList,
                                                        p.vList,
                                                        p.rList,
                                                        p.sList,
                                                        p.ringOwner,
                                                        p.feeRecepient,
                                                        p.throwIfLRCIsInsuffcient,
                                                        {from: owner}
                                                       );
      //console.log("tx:", tx);
      //console.log(tx.receipt.logs);

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
    });

  });

})
