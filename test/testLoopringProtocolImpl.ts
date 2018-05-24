import { BigNumber } from "bignumber.js";
import xor = require("bitwise-xor");
import promisify = require("es6-promisify");
import fs = require("fs");
import * as _ from "lodash";
import { Artifacts } from "../util/artifacts";
import { Order } from "../util/order";
import { TxParser } from "../util/parseTx";
import { ProtocolSimulator } from "../util/protocol_simulator";
import { Ring } from "../util/ring";
import { RingFactory } from "../util/ring_factory";
import { OrderParams, RingBalanceInfo, RingInfo, TransferItem } from "../util/types";
import { rawTxs } from "./rawTxs";
import { ringInfoList } from "./ringConfig";

const {
  LoopringProtocolImpl,
  TokenRegistry,
  TokenTransferDelegate,
  DummyToken,
} = new Artifacts(artifacts);

contract("LoopringProtocolImpl", (accounts: string[]) => {
  const owner = accounts[0];
  const order1Owner = accounts[1];
  const order2Owner = accounts[2];
  const order3Owner = accounts[3];
  const orderAuthAddr = accounts[7]; // should generate each time in front-end. we just mock it here.
  const ringOwner = accounts[6];
  const feeRecepient = ringOwner;
  const ringMiner = feeRecepient;
  const walletAddr = accounts[8];

  let loopringProtocolImpl: any;
  let tokenRegistry: any;
  let tokenTransferDelegate: any;

  let lrcAddress: string;
  let eosAddress: string;
  let neoAddress: string;
  let qtumAddress: string;
  let delegateAddr: string;

  let lrc: any;
  let eos: any;
  let neo: any;
  let qtum: any;

  let allTokens: any[];
  let allAddresses: string[];

  const tokenMap = new Map();
  const tokenSymbolMap = new Map();

  let currBlockTimeStamp: number;
  let walletSplitPercentage: number;

  let ringFactory: RingFactory;

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

    const walletSplitPercentageBN = await loopringProtocolImpl.walletSplitPercentage();
    walletSplitPercentage = walletSplitPercentageBN.toNumber();

    tokenTransferDelegate.authorizeAddress(LoopringProtocolImpl.address);

    [lrc, eos, neo, qtum] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(neoAddress),
      DummyToken.at(qtumAddress),
    ]);

    tokenMap.set(lrcAddress, lrc);
    tokenSymbolMap.set(lrcAddress, "LRC");
    tokenMap.set(eosAddress, eos);
    tokenSymbolMap.set(eosAddress, "EOS");
    tokenMap.set(neoAddress, neo);
    tokenSymbolMap.set(neoAddress, "NEO");
    tokenMap.set(qtumAddress, qtum);
    tokenSymbolMap.set(qtumAddress, "QTUM");

    const currBlockNumber = web3.eth.blockNumber;
    currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    ringFactory = new RingFactory(TokenTransferDelegate.address,
                                  eosAddress,
                                  neoAddress,
                                  lrcAddress,
                                  qtumAddress,
                                  orderAuthAddr,
                                  currBlockTimeStamp);
    ringFactory.walletAddr = walletAddr;

    allTokens = [eos, neo, lrc, qtum];
    allAddresses = [order1Owner, order2Owner, order3Owner, feeRecepient];

    // approve only once for all test cases.
    for (const token of allTokens) {
      for (const address of allAddresses) {
        await token.approve(delegateAddr, web3.toWei(10000000000), {from: address});
      }
    }
  });

  const getTokenBalanceAsync = async (token: any, addr: string) => {
    const tokenBalanceStr = await token.balanceOf(addr);
    const balance = new BigNumber(tokenBalanceStr);
    return balance.toNumber();
  };

  const getEthBalanceAsync = async (addr: string) => {
    const balanceStr = await promisify(web3.eth.getBalance)(addr);
    const balance = new BigNumber(balanceStr);
    return balance;
  };

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = n1.toPrecision(precision);
    const numStr2 = n2.toPrecision(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
  };

  const clear = async (tokens: any[], addresses: string[]) => {
    for (const token of tokens) {
      for (const address of addresses) {
        await token.setBalance(address, 0, {from: owner});
      }
    }
  };

  const approve = async (tokens: any[], addresses: string[], amounts: number[]) => {
    for (let i = 0; i < tokens.length; i++) {
      await tokens[i].approve(delegateAddr, 0, {from: addresses[i]});
      await tokens[i].approve(delegateAddr, amounts[i], {from: addresses[i]});
    }
  };

  const setBalanceBefore = async (ring: Ring,
                                  miner: string,
                                  spendableAmountSList: number[],
                                  spendableLrcFeeAmountList: number[]) => {
    const ringSize = ring.orders.length;
    let lrcRewardTotal = 0;
    for (let i = 0; i < ringSize; i++) {
      const order = ring.orders[i];
      const orderOwner = order.owner;
      let balance = order.params.amountS.toNumber();
      if (spendableAmountSList && spendableAmountSList[i]) {
        balance = spendableAmountSList[i];
      }
      const tokenSAddr = order.params.tokenS;
      const tokenInstance = tokenMap.get(tokenSAddr);
      await tokenInstance.setBalance(orderOwner, balance);

      let lrcFee = order.params.lrcFee.toNumber();
      lrcRewardTotal += lrcFee;
      if (spendableLrcFeeAmountList && spendableLrcFeeAmountList[i]) {
        lrcFee = spendableLrcFeeAmountList[i];
      }
      await lrc.addBalance(orderOwner, lrcFee);
    }

    if (spendableLrcFeeAmountList && spendableLrcFeeAmountList[ringSize]) {
      lrcRewardTotal = spendableLrcFeeAmountList[ringSize];
    }
    await lrc.setBalance(miner, lrcRewardTotal);
  };

  const setDefaultValuesForRingInfo = (ringInfo: RingInfo) => {
    const ringSize = ringInfo.amountSList.length;
    assert(ringSize <= 3, "invalid orders size. amountSList:" + ringInfo.amountSList);

    const tokenAddresses = [eosAddress, neoAddress, lrcAddress];
    const orderOwners = [order1Owner, order2Owner, order3Owner];
    ringInfo.tokenAddressList = tokenAddresses.slice(0, ringSize);
    if (ringInfo.orderOwners && ringInfo.orderOwners.length > 0 &&
        ringInfo.orderOwners[0] === "##sameOwners##") {
      ringInfo.orderOwners = Array.from({length: ringSize}, () => orderOwners[0]);
    } else {
      ringInfo.orderOwners = orderOwners.slice(0, ringSize);
    }
    ringInfo.miner = ringOwner;

    if (!ringInfo.lrcFeeAmountList || ringInfo.lrcFeeAmountList.length < ringSize) {
      ringInfo.lrcFeeAmountList = Array.from({length: ringSize}, () => 1e18);
    }

    if (!ringInfo.buyNoMoreThanAmountBList || ringInfo.buyNoMoreThanAmountBList.length < ringSize) {
      ringInfo.buyNoMoreThanAmountBList = Array.from({length: ringSize}, () => false);
    }

    if (!ringInfo.marginSplitPercentageList || ringInfo.marginSplitPercentageList.length < ringSize) {
      ringInfo.marginSplitPercentageList = Array.from({length: ringSize}, () => 50);
    }
  };

  const getEventsFromContract = async (contract: any, eventName: string, fromBlock: number) => {
    return new Promise((resolve, reject) => {
      if (!contract[eventName]) {
        throw Error("TypeError: contract[eventName] is not a function: " + eventName);
      }

      const events = contract[eventName]({}, { fromBlock, toBlock: "latest" });
      events.watch();
      events.get((error: any, event: any) => {
        if (!error) {
          resolve(event);
        } else {
          throw Error("Failed to find filtered event: " + error);
        }
      });
      events.stopWatching();
    });
  };

  const getTransferItems = async (token: string, fromBlock: number) => {
    const tokenContractInstance = tokenMap.get(token);
    return await getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
  };

  const getTransferEvents = async (tokens: string[], fromBlock: number) => {
    let transferItems: Array<[string, string, number]> = [];
    for (const tokenAddr of tokens) {
      const eventArr: any = await getTransferItems(tokenAddr, fromBlock);
      const items = eventArr.map((eventObj: any) => {
        const from = eventObj.args.from;
        const to = eventObj.args.to;
        const amount = eventObj.args.value.toNumber();
        const item: [string, string, number] = [from, to, amount];
        return item;
      });

      transferItems = transferItems.concat(items);
    }

    return transferItems;
  };

  const assertTransfers = (tranferEvents: Array<[string, string, number]>, transferList: TransferItem[]) => {
    const transfersFromSimulator: Array<[string, string, number]> = [];
    transferList.forEach((item) => transfersFromSimulator.push([item.fromAddress, item.toAddress, item.amount]));
    const sorter = (a: [string, string, number], b: [string, string, number]) => {
      if (a[0] === b[0]) {
        if (a[1] === b[1]) {
          return a[2] - b[2];
        } else {
          return a[1] > b[1] ? 1 : -1;
        }
      } else {
        return a[0] > b[0] ? 1 : -1;
      }
    };

    transfersFromSimulator.sort(sorter);
    tranferEvents.sort(sorter);
    // console.log("transfersFromSimulator:", transfersFromSimulator);
    // console.log("tranferEvents from testrpc:", tranferEvents);

    assert.equal(tranferEvents.length, transfersFromSimulator.length, "transfer amounts not match");
    for (let i = 0; i < tranferEvents.length; i++) {
      const transferFromEvent = tranferEvents[i];
      const transferFromSimulator = transfersFromSimulator[i];
      assert.equal(transferFromEvent[0], transferFromSimulator[0]);
      assert.equal(transferFromEvent[1], transferFromSimulator[1]);
      assertNumberEqualsWithPrecision(transferFromEvent[2], transferFromSimulator[2]);
    }
  };

  describe("submitRing", () => {
    const protocolAbi = fs.readFileSync("ABI/version151/LoopringProtocolImpl.abi", "ascii");
    const txParser = new TxParser(protocolAbi);
    const ringInfoListFromRawTxs = rawTxs.map((tx) => txParser.parseSubmitRingTx(tx));

    // const ringInfoListForTest = ringInfoList;
    const ringInfoListForTest = ringInfoList.concat(ringInfoListFromRawTxs);

    let eventFromBlock: number = 0;
    for (const ringInfo of ringInfoListForTest) {
      it(ringInfo.description, async () => {
        const ringSize = ringInfo.amountSList.length;
        let spendableAmountSList: number[] = [];
        let spendableLrcFeeAmountList: number[] = [];
        let orderFilledOrCancelledAmountList: number[] = [];
        if (ringInfo.spendableAmountSList &&
            ringInfo.spendableAmountSList.length === ringSize) {
          spendableAmountSList = ringInfo.spendableAmountSList.slice();
        }
        if (ringInfo.spendableLrcFeeAmountList &&
            ringInfo.spendableLrcFeeAmountList.length === (ringSize + 1)) {
          spendableLrcFeeAmountList = ringInfo.spendableLrcFeeAmountList.slice();
        }
        if (ringInfo.orderFilledOrCancelledAmountList &&
            ringInfo.orderFilledOrCancelledAmountList.length === ringSize) {
          orderFilledOrCancelledAmountList = ringInfo.orderFilledOrCancelledAmountList.slice();
        }

        setDefaultValuesForRingInfo(ringInfo);

        const ring = await ringFactory.generateRing(ringInfo);
        assert(ring.orders[0].isValidSignature(), "invalid signature");

        await setBalanceBefore(ring,
                               feeRecepient,
                               spendableAmountSList,
                               spendableLrcFeeAmountList);

        const p = ringFactory.ringToSubmitableParams(ring);

        const simulator = new ProtocolSimulator(ring,
                                                lrcAddress,
                                                tokenRegistry.address,
                                                walletSplitPercentage);

        const spendableLrcAmountList = ring.orders.map((o, index) => {
          if (o.params.tokenS === lrcAddress) {
            return o.params.lrcFee.toNumber() + o.params.amountS.toNumber();
          } else {
            return o.params.lrcFee.toNumber();
          }
        });

        const simulatorReport = await simulator.simulateAndReport([],
                                                                  [],
                                                                  orderFilledOrCancelledAmountList,
                                                                  ringInfo.verbose);

        const tx = await loopringProtocolImpl.submitRing(p.addressList,
                                                         p.uintArgsList,
                                                         p.uint8ArgsList,
                                                         p.buyNoMoreThanAmountBList,
                                                         p.vList,
                                                         p.rList,
                                                         p.sList,
                                                         p.feeRecepient,
                                                         p.feeSelections,
                                                         {from: feeRecepient});

        // console.log("tx.receipt.logs: ", tx.receipt.logs);
        // const balanceInfo = await getRingBalanceInfoAfter(ring, feeRecepient);
        // console.log("balanceInfo:",  balanceInfo);

        const tokenSet = new Set([lrcAddress]);
        for (const order of ring.orders) {
          tokenSet.add(order.params.tokenS);
        }

        const tokensInRing = [...tokenSet];
        const transferEvents = await getTransferEvents(tokensInRing, eventFromBlock);

        // const logs = await getEventsFromContract(loopringProtocolImpl, "LogUint2", eventFromBlock);
        // const logs = await getEventsFromContract(tokenTransferDelegate, "LogSplitPay", eventFromBlock);
        // (logs as Array<[any]>).forEach((log: any) => {
        //   console.log(log.args.from, log.args.to, log.args.value.toNumber() / 1e18);
        // });

        // const logs2 = await getEventsFromContract(tokenTransferDelegate, "LogUint1", eventFromBlock);
        // (logs2 as Array<[any]>).forEach((log: any) => {
        //   console.log(log.args.n1.toNumber() / 1e18, log.args.n2.toNumber() / 1e18);
        // });

        assertTransfers(transferEvents, simulatorReport.transferList);

        await clear([eos, neo, lrc], [order1Owner, order2Owner, feeRecepient]);
        eventFromBlock = web3.eth.blockNumber + 1;
      });
    }

  });

  // describe("cancelOrder", () => {
  //   it("should be able to set order cancelled amount by order owner", async () => {
  //     const feeSelectionList = [0, 0];

  //     const orderPrams = {
  //       delegateContract: delegateAddr,
  //       tokenS: eosAddress,
  //       tokenB: neoAddress,
  //       amountS: new BigNumber(1000e18),
  //       amountB: new BigNumber(100e18),
  //       validSince: new BigNumber(currBlockTimeStamp),
  //       validUntil: new BigNumber((currBlockTimeStamp + 360000) + 130),
  //       lrcFee: new BigNumber(1e18),
  //       buyNoMoreThanAmountB: false,
  //       marginSplitPercentage: 0,
  //       authAddr: orderAuthAddr,
  //       walletAddr,
  //     };

  //     const order = new Order(order1Owner, orderPrams);
  //     await order.signAsync();

  //     const cancelAmount = new BigNumber(100e18);
  //     const addresses = [order.owner,
  //                        order.params.tokenS,
  //                        order.params.tokenB,
  //                        order.params.walletAddr,
  //                        order.params.authAddr];

  //     const orderValues = [order.params.amountS,
  //                          order.params.amountB,
  //                          order.params.validSince,
  //                          order.params.validUntil,
  //                          order.params.lrcFee,
  //                          cancelAmount];

  //     const cancelledOrFilledAmount0 = await tokenTransferDelegate.cancelledOrFilled(order.params.orderHashHex);
  //     const tx = await loopringProtocolImpl.cancelOrder(addresses,
  //                                                       orderValues,
  //                                                       order.params.buyNoMoreThanAmountB,
  //                                                       order.params.marginSplitPercentage,
  //                                                       order.params.v,
  //                                                       order.params.r,
  //                                                       order.params.s,
  //                                                       {from: order.owner});

  //     const cancelledOrFilledAmount1 = await tokenTransferDelegate.cancelledOrFilled(order.params.orderHashHex);
  //     assert.equal(cancelledOrFilledAmount1.minus(cancelledOrFilledAmount0).toNumber(),
  //       cancelAmount.toNumber(), "cancelled amount not match");
  //   });

  //   it("should not be able to cancell order by other address", async () => {
  //     const feeSelectionList = [0, 0];
  //     const orderPrams = {
  //       delegateContract: delegateAddr,
  //       tokenS: eosAddress,
  //       tokenB: neoAddress,
  //       amountS: new BigNumber(1000e18),
  //       amountB: new BigNumber(100e18),
  //       validSince: new BigNumber(currBlockTimeStamp),
  //       validUntil: new BigNumber((currBlockTimeStamp + 360000) + 130),
  //       lrcFee: new BigNumber(1e18),
  //       buyNoMoreThanAmountB: false,
  //       marginSplitPercentage: 0,
  //       authAddr: orderAuthAddr,
  //       walletAddr,
  //     };

  //     const order = new Order(order1Owner, orderPrams);
  //     await order.signAsync();
  //     const cancelAmount = new BigNumber(100e18);

  //     const addresses = [order.owner,
  //                        order.params.tokenS,
  //                        order.params.tokenB,
  //                        order.params.walletAddr,
  //                        order.params.authAddr];

  //     const orderValues = [order.params.amountS,
  //                          order.params.amountB,
  //                          order.params.validSince,
  //                          order.params.validUntil,
  //                          order.params.lrcFee,
  //                          cancelAmount];
  //     try {
  //       const tx = await loopringProtocolImpl.cancelOrder(addresses,
  //                                                         orderValues,
  //                                                         order.params.buyNoMoreThanAmountB,
  //                                                         order.params.marginSplitPercentage,
  //                                                         order.params.v,
  //                                                         order.params.r,
  //                                                         order.params.s,
  //                                                         {from: order2Owner});
  //     } catch (err) {
  //       const errMsg = `${err}`;
  //       assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
  //              `Expected contract to throw, got: ${err}`);
  //     }
  //   });
  // });

  // describe("cancelAllOrders", () => {
  //   it("should be able to set cutoffs", async () => {
  //     await loopringProtocolImpl.cancelAllOrders(new BigNumber(1508566125), {from: order2Owner});
  //     const cutoff = await tokenTransferDelegate.cutoffs(order2Owner);
  //     assert.equal(cutoff.toNumber(), 1508566125, "cutoff not set correctly");
  //   });

  //   // it("should be able to prevent orders from being traded by cutoffs.", async () => {
  //   //   await loopringProtocolImpl.cancelAllOrders(new BigNumber(currBlockTimeStamp),
  //   //                                              {from: order2Owner});

  //   //   const ring = await ringFactory.generateRingForCancel(order1Owner,
  //   //                                                        order2Owner,
  //   //                                                        ringOwner,
  //   //                                                        [0, 0]);

  //   //   await lrc.setBalance(order1Owner, web3.toWei(100),   {from: owner});
  //   //   await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
  //   //   await lrc.setBalance(order2Owner, web3.toWei(100),   {from: owner});
  //   //   await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});
  //   //   await lrc.setBalance(feeRecepient, 0, {from: owner});

  //   //   const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);

  //   //   const ethOfOwnerBefore = await getEthBalanceAsync(owner);

  //   //   try {
  //   //     await loopringProtocolImpl.submitRing(p.addressList,
  //   //                                           p.uintArgsList,
  //   //                                           p.uint8ArgsList,
  //   //                                           p.buyNoMoreThanAmountBList,
  //   //                                           p.vList,
  //   //                                           p.rList,
  //   //                                           p.sList,
  //   //                                           p.feeRecepient,
  //   //                                           p.feeSelections,
  //   //                                           {from: owner});
  //   //   } catch (err) {
  //   //     const errMsg = `${err}`;
  //   //     assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
  //   //            `Expected contract to throw, got: ${err}`);
  //   //   }

  //   // });

  // });

  // describe("cancelAllOrdersByTradingPair", () => {
  //   it("should be able to set trading pair cutoffs", async () => {
  //     await loopringProtocolImpl.cancelAllOrdersByTradingPair(eosAddress,
  //                                                             neoAddress,
  //                                                             new BigNumber(1508566125),
  //                                                             {from: order2Owner});

  //     const cutoff = await loopringProtocolImpl.getTradingPairCutoffs(order2Owner,
  //                                                                     eosAddress,
  //                                                                     neoAddress);

  //     assert.equal(cutoff.toNumber(), 1508566125, "trading pair cutoff not set correctly");
  //   });

  //   // it("should be able to prevent orders from being traded by tradingPairCutoffs", async () => {
  //   //   await loopringProtocolImpl.cancelAllOrdersByTradingPair(neoAddress,
  //   //                                                           eosAddress,
  //   //                                                           new BigNumber(currBlockTimeStamp),
  //   //                                                           {from: order2Owner});
  //   //   const ring = await ringFactory.generateRingForCancel(order1Owner,
  //   //                                                        order2Owner,
  //   //                                                        ringOwner,
  //   //                                                        [1, 1]);

  //   //   await lrc.setBalance(order1Owner, web3.toWei(100),   {from: owner});
  //   //   await eos.setBalance(order1Owner, web3.toWei(10000), {from: owner});
  //   //   await lrc.setBalance(order2Owner, web3.toWei(100),   {from: owner});
  //   //   await neo.setBalance(order2Owner, web3.toWei(1000),  {from: owner});
  //   //   await lrc.setBalance(feeRecepient, 0, {from: owner});

  //   //   const p = ringFactory.ringToSubmitableParams(ring, [0, 0], feeRecepient);

  //   //   const ethOfOwnerBefore = await getEthBalanceAsync(owner);

  //   //   try {
  //   //     await loopringProtocolImpl.submitRing(p.addressList,
  //   //                                           p.uintArgsList,
  //   //                                           p.uint8ArgsList,
  //   //                                           p.buyNoMoreThanAmountBList,
  //   //                                           p.vList,
  //   //                                           p.rList,
  //   //                                           p.sList,
  //   //                                           p.feeRecepient,
  //   //                                           p.feeSelections,
  //   //                                           {from: owner});
  //   //   } catch (err) {
  //   //     const errMsg = `${err}`;
  //   //     assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
  //   //            `Expected contract to throw, got: ${err}`);
  //   //   }

  //   // });

  // });

});
