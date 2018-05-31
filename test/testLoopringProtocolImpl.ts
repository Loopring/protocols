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
  let gtoAddress: string;
  let rdnAddress: string;
  let delegateAddr: string;

  let lrc: any;
  let eos: any;
  let gto: any;
  let rdn: any;

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
    gtoAddress = await tokenRegistry.getAddressBySymbol("GTO");
    rdnAddress = await tokenRegistry.getAddressBySymbol("RDN");
    delegateAddr = TokenTransferDelegate.address;

    const walletSplitPercentageBN = await loopringProtocolImpl.walletSplitPercentage();
    walletSplitPercentage = walletSplitPercentageBN.toNumber();

    tokenTransferDelegate.authorizeAddress(LoopringProtocolImpl.address);

    [lrc, eos, gto, rdn] = await Promise.all([
      DummyToken.at(lrcAddress),
      DummyToken.at(eosAddress),
      DummyToken.at(gtoAddress),
      DummyToken.at(rdnAddress),
    ]);

    tokenMap.set(lrcAddress, lrc);
    tokenSymbolMap.set(lrcAddress, "LRC");
    tokenMap.set(eosAddress, eos);
    tokenSymbolMap.set(eosAddress, "EOS");
    tokenMap.set(gtoAddress, gto);
    tokenSymbolMap.set(gtoAddress, "GTO");
    tokenMap.set(rdnAddress, rdn);
    tokenSymbolMap.set(rdnAddress, "RDN");

    const currBlockNumber = web3.eth.blockNumber;
    currBlockTimeStamp = web3.eth.getBlock(currBlockNumber).timestamp;

    ringFactory = new RingFactory(TokenTransferDelegate.address,
                                  orderAuthAddr,
                                  currBlockTimeStamp);
    ringFactory.walletAddr = walletAddr;

    allTokens = [eos, gto, lrc, rdn];
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

    const tokenAddresses = [eosAddress, gtoAddress, lrcAddress];
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

  const getTransferEvents = async (tokens: string[], fromBlock: number) => {
    let transferItems: Array<[string, string, number]> = [];
    for (const tokenAddr of tokens) {
      const tokenContractInstance = tokenMap.get(tokenAddr);
      const eventArr: any = await getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
      const items = eventArr.map((eventObj: any) => {
        return [eventObj.args.from, eventObj.args.to, eventObj.args.value.toNumber()];
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
    const protocolAbi = fs.readFileSync("ABI/version15/LoopringProtocolImpl.abi", "ascii");
    const txParser = new TxParser(protocolAbi);
    const ringInfoListFromRawTxs = rawTxs.map((tx) => txParser.parseSubmitRingTx(tx));

    // const ringInfoListForTest = ringInfoListFromRawTxs;
    const ringInfoListForTest = ringInfoList.concat(ringInfoListFromRawTxs);

    let eventFromBlock: number = 0;

    const cancelOrderAmount = async (order: Order, cancelAmount: number) => {
      const addresses = [order.owner,
                         order.params.tokenS,
                         order.params.tokenB,
                         order.params.walletAddr,
                         order.params.authAddr];
      const orderValues = [order.params.amountS,
                           order.params.amountB,
                           order.params.validSince,
                           order.params.validUntil,
                           order.params.lrcFee,
                           cancelAmount];
      await loopringProtocolImpl.cancelOrder(addresses,
                                             orderValues,
                                             order.params.buyNoMoreThanAmountB,
                                             order.params.marginSplitPercentage,
                                             order.params.v,
                                             order.params.r,
                                             order.params.s,
                                             {from: order.owner});
    };

    for (const ringInfo of ringInfoListForTest) {
      it(ringInfo.description, async () => {
        setDefaultValuesForRingInfo(ringInfo);

        const ring = await ringFactory.generateRing(ringInfo);
        assert(ring.orders[0].isValidSignature(), "invalid signature");

        await setBalanceBefore(ring,
                               feeRecepient,
                               ringInfo.spendableAmountSList,
                               ringInfo.spendableLrcFeeAmountList);

        const p = ringFactory.ringToSubmitableParams(ring);

        const simulator = new ProtocolSimulator(ring,
                                                lrcAddress,
                                                tokenRegistry.address,
                                                walletSplitPercentage);
        // set order's cancelOrFilledAmount
        if (ringInfo.orderFilledOrCancelledAmountList) {
          ringInfo.orderFilledOrCancelledAmountList.forEach(async (n, i) => {
            if (n > 0) {
              await cancelOrderAmount(ring.orders[i], n);
            }
          });
        }

        const simulatorReport = await simulator.simulateAndReport([],
                                                                  [],
                                                                  ringInfo.orderFilledOrCancelledAmountList,
                                                                  ringInfo.verbose);

        const tx = await loopringProtocolImpl.submitRing(p.data,
                                                         {from: feeRecepient});
        // console.log("tx.receipt.logs: ", tx.receipt.logs);
        console.log("gas used: ", tx.receipt.gasUsed);

        const tokenSet = new Set([lrcAddress]);
        for (const order of ring.orders) {
          tokenSet.add(order.params.tokenS);
        }

        const tokensInRing = [...tokenSet];
        const transferEvents = await getTransferEvents(tokensInRing, eventFromBlock);

        assertTransfers(transferEvents, simulatorReport.transferList);

        await clear([eos, gto, lrc], [order1Owner, order2Owner, feeRecepient]);
        eventFromBlock = web3.eth.blockNumber + 1;
      });
    }

  });

  describe("cancelOrder", () => {
    it("should be able to set order cancelled amount by order owner", async () => {
      const feeSelectionList = [0, 0];

      const orderPrams = {
        delegateContract: delegateAddr,
        tokenS: eosAddress,
        tokenB: gtoAddress,
        amountS: new BigNumber(1000e18),
        amountB: new BigNumber(100e18),
        validSince: new BigNumber(currBlockTimeStamp),
        validUntil: new BigNumber((currBlockTimeStamp + 360000) + 130),
        lrcFee: new BigNumber(1e18),
        buyNoMoreThanAmountB: false,
        marginSplitPercentage: 0,
        authAddr: orderAuthAddr,
        walletAddr,
      };

      const order = new Order(order1Owner, orderPrams);
      await order.signAsync();

      const cancelAmount = new BigNumber(100e18);
      const addresses = [order.owner,
                         order.params.tokenS,
                         order.params.tokenB,
                         order.params.walletAddr,
                         order.params.authAddr];

      const orderValues = [order.params.amountS,
                           order.params.amountB,
                           order.params.validSince,
                           order.params.validUntil,
                           order.params.lrcFee,
                           cancelAmount];

      const cancelledOrFilledAmount0 = await tokenTransferDelegate.cancelledOrFilled(order.params.orderHashHex);
      const tx = await loopringProtocolImpl.cancelOrder(addresses,
                                                        orderValues,
                                                        order.params.buyNoMoreThanAmountB,
                                                        order.params.marginSplitPercentage,
                                                        order.params.v,
                                                        order.params.r,
                                                        order.params.s,
                                                        {from: order.owner});

      const cancelledOrFilledAmount1 = await tokenTransferDelegate.cancelledOrFilled(order.params.orderHashHex);
      assert.equal(cancelledOrFilledAmount1.minus(cancelledOrFilledAmount0).toNumber(),
        cancelAmount.toNumber(), "cancelled amount not match");
    });

    it("should not be able to cancell order by other address", async () => {
      const feeSelectionList = [0, 0];
      const orderPrams = {
        delegateContract: delegateAddr,
        tokenS: eosAddress,
        tokenB: gtoAddress,
        amountS: new BigNumber(1000e18),
        amountB: new BigNumber(100e18),
        validSince: new BigNumber(currBlockTimeStamp),
        validUntil: new BigNumber((currBlockTimeStamp + 360000) + 130),
        lrcFee: new BigNumber(1e18),
        buyNoMoreThanAmountB: false,
        marginSplitPercentage: 0,
        authAddr: orderAuthAddr,
        walletAddr,
      };

      const order = new Order(order1Owner, orderPrams);
      await order.signAsync();
      const cancelAmount = new BigNumber(100e18);

      const addresses = [order.owner,
                         order.params.tokenS,
                         order.params.tokenB,
                         order.params.walletAddr,
                         order.params.authAddr];

      const orderValues = [order.params.amountS,
                           order.params.amountB,
                           order.params.validSince,
                           order.params.validUntil,
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
        assert(_.includes(errMsg, "Error: VM Exception while processing transaction: revert"),
               `Expected contract to throw, got: ${err}`);
      }
    });
  });

  describe("cancelAllOrders", () => {
    it("should be able to set cutoffs", async () => {
      await loopringProtocolImpl.cancelAllOrders(new BigNumber(1508566125), {from: order2Owner});
      const cutoff = await tokenTransferDelegate.cutoffs(order2Owner);
      assert.equal(cutoff.toNumber(), 1508566125, "cutoff not set correctly");
    });

  });

  describe("cancelAllOrdersByTradingPair", () => {
    it("should be able to set trading pair cutoffs", async () => {
      await loopringProtocolImpl.cancelAllOrdersByTradingPair(eosAddress,
                                                              gtoAddress,
                                                              new BigNumber(1508566125),
                                                              {from: order2Owner});

      const cutoff = await loopringProtocolImpl.getTradingPairCutoffs(order2Owner,
                                                                      eosAddress,
                                                                      gtoAddress);

      assert.equal(cutoff.toNumber(), 1508566125, "trading pair cutoff not set correctly");
    });

  });

});
