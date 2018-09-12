import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import abi = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import * as psc from "protocol2-js";
import util = require("util");
import tokenInfos = require("../migrations/config/tokens.js");
import { ringsInfoList } from "./rings_config";
import { Artifacts } from "../util/Artifacts";

const {
  RingSubmitter,
  RingCanceller,
  TokenRegistry,
  SymbolRegistry,
  BrokerRegistry,
  OrderRegistry,
  MinerRegistry,
  TradeDelegate,
  FeeHolder,
  DummyToken,
  DummyBrokerInterceptor,
  OrderBook,
  TaxTable,
} = new Artifacts(artifacts);

contract("Exchange_Security", (accounts: string[]) => {
  const deployer = accounts[0];
  const transactionOrigin = accounts[1];
  const miner = accounts[2];
  const wallet1 = accounts[3];
  const broker1 = accounts[4];
  const orderOwners = accounts.slice(5, 9);
  const orderDualAuthAddr = accounts.slice(9, 13);
  const allOrderTokenRecipients = accounts.slice(13, 17);

  let ringSubmitter: any;
  let ringCanceller: any;
  let tokenRegistry: any;
  let symbolRegistry: any;
  let tradeDelegate: any;
  let orderRegistry: any;
  let minerRegistry: any;
  let feeHolder: any;
  let orderBook: any;
  let taxTable: any;
  let dummyBrokerInterceptor: any;
  let orderBrokerRegistryAddress: string;
  let minerBrokerRegistryAddress: string;
  let lrcAddress: string;
  let wethAddress: string;
  let feePercentageBase: number;

  const tokenSymbolAddrMap = new Map();
  const tokenInstanceMap = new Map();
  const allTokenSymbols = tokenInfos.development.map((t) => t.symbol);
  const allTokens: any[] = [];

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2));
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

  const getTransferEvents = async (tokens: any[], fromBlock: number) => {
    let transferItems: Array<[string, string, string, number]> = [];
    for (const tokenContractInstance of tokens) {
      const eventArr: any = await getEventsFromContract(tokenContractInstance, "Transfer", fromBlock);
      const items = eventArr.map((eventObj: any) => {
        return [tokenContractInstance.address, eventObj.args.from, eventObj.args.to, eventObj.args.value.toNumber()];
      });
      transferItems = transferItems.concat(items);
    }

    return transferItems;
  };

  const watchAndPrintEvent = async (contract: any, eventName: string) => {
    const events: any = await getEventsFromContract(contract, eventName, 0);

    events.forEach((e: any) => {
      console.log("event:", util.inspect(e.args, false, null));
    });
  };

  const getDefaultContext = () => {
    const currBlockNumber = web3.eth.blockNumber;
    const currBlockTimestamp = web3.eth.getBlock(currBlockNumber).timestamp;
    // Pass in the block number and the block time stamp so we can more accurately reproduce transactions
    const context = new psc.Context(currBlockNumber,
                                currBlockTimestamp,
                                TokenRegistry.address,
                                tradeDelegate.address,
                                orderBrokerRegistryAddress,
                                minerBrokerRegistryAddress,
                                OrderRegistry.address,
                                MinerRegistry.address,
                                feeHolder.address,
                                OrderBook.address,
                                taxTable.address,
                                lrcAddress,
                                feePercentageBase);
    return context;
  };

  const setupOrder = async (order: psc.OrderInfo, index: number, limitFeeTokenAmount?: boolean) => {
    if (order.owner === undefined) {
      const accountIndex = index % orderOwners.length;
      order.owner = orderOwners[accountIndex];
    } else if (order.owner !== undefined && !order.owner.startsWith("0x")) {
      const accountIndex = parseInt(order.owner, 10);
      assert(accountIndex >= 0 && accountIndex < orderOwners.length, "Invalid owner index");
      order.owner = orderOwners[accountIndex];
    }
    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = await symbolRegistry.getAddressBySymbol(order.tokenS);
    }
    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = await symbolRegistry.getAddressBySymbol(order.tokenB);
    }
    if (order.feeToken && !order.feeToken.startsWith("0x")) {
      order.feeToken = await symbolRegistry.getAddressBySymbol(order.feeToken);
    }
    if (order.feeAmount === undefined) {
      order.feeAmount = 1e18;
    }
    if (order.feePercentage === undefined && order.feeAmount > 0) {
      order.feePercentage = 20;  // == 2.0%
    }
    if (!order.dualAuthSignAlgorithm) {
      order.dualAuthSignAlgorithm = psc.SignAlgorithm.Ethereum;
    }
    if (order.dualAuthAddr === undefined && order.dualAuthSignAlgorithm !== psc.SignAlgorithm.None) {
      const accountIndex = index % orderDualAuthAddr.length;
      order.dualAuthAddr = orderDualAuthAddr[accountIndex];
    }
    if (!order.allOrNone) {
      order.allOrNone = false;
    }
    if (!order.validSince) {
      // Set the order validSince time to a bit before the current timestamp;
      order.validSince = web3.eth.getBlock(web3.eth.blockNumber).timestamp - 1000;
    }
    if (!order.walletAddr && index > 0) {
      order.walletAddr = wallet1;
    }
    if (order.walletAddr && !order.walletSplitPercentage) {
      order.walletSplitPercentage = (index * 10) % 100;
    }
    if (order.tokenRecipient !== undefined && !order.tokenRecipient.startsWith("0x")) {
      const accountIndex = parseInt(order.tokenRecipient, 10);
      assert(accountIndex >= 0 && accountIndex < orderOwners.length, "Invalid token recipient index");
      order.tokenRecipient = orderOwners[accountIndex];
    }
    // Fill in defaults (default, so these will not get serialized)
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.feeToken = order.feeToken ? order.feeToken : lrcAddress;
    order.feeAmount = order.feeAmount ? order.feeAmount : 0;
    order.feePercentage = order.feePercentage ? order.feePercentage : 0;
    order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 0;
    order.tokenSFeePercentage = order.tokenSFeePercentage ? order.tokenSFeePercentage : 0;
    order.tokenBFeePercentage = order.tokenBFeePercentage ? order.tokenBFeePercentage : 0;
    order.walletSplitPercentage = order.walletSplitPercentage ? order.walletSplitPercentage : 0;

    // setup initial balances:
    const tokenS = await DummyToken.at(order.tokenS);
    await tokenS.setBalance(order.owner, (order.balanceS !== undefined) ? order.balanceS : order.amountS);
    if (!limitFeeTokenAmount) {
      const feeToken = order.feeToken ? order.feeToken : lrcAddress;
      const balanceFee = (order.balanceFee !== undefined) ? order.balanceFee : (order.feeAmount * 2);
      if (feeToken === order.tokenS) {
        tokenS.addBalance(order.owner, balanceFee);
      } else {
        const tokenFee = await DummyToken.at(feeToken);
        await tokenFee.setBalance(order.owner, balanceFee);
      }
    }
  };

  const registerBrokerChecked = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    await brokerRegistry.registerBroker(broker, interceptor, {from: user});
    await assertRegistered(user, broker, interceptor);
  };

  const unregisterBrokerChecked = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    await brokerRegistry.unregisterBroker(broker, {from: user});
    await assertNotRegistered(user, broker);
  };

  const assertRegistered = async (user: string, broker: string, interceptor: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(isRegistered, "interceptor should be registered.");
    assert.equal(interceptor, interceptorFromContract, "get wrong interceptor");
  };

  const assertNotRegistered = async (user: string, broker: string) => {
    const brokerRegistry = BrokerRegistry.at(orderBrokerRegistryAddress);
    const [isRegistered, interceptorFromContract] = await brokerRegistry.getBroker(user, broker);
    assert(!isRegistered, "interceptor should not be registered.");
  };

  const cleanTradeHistory = async () => {
    // This will re-deploy the TradeDelegate contract (and thus the RingSubmitter/RingCanceller contract as well)
    // so all trade history is reset
    tradeDelegate = await TradeDelegate.new();
    feeHolder = await FeeHolder.new(tradeDelegate.address);
    ringSubmitter = await RingSubmitter.new(
      lrcAddress,
      wethAddress,
      TokenRegistry.address,
      tradeDelegate.address,
      orderBrokerRegistryAddress,
      minerBrokerRegistryAddress,
      OrderRegistry.address,
      MinerRegistry.address,
      feeHolder.address,
      orderBook.address,
      TaxTable.address,
    );
    ringCanceller = await RingCanceller.new(
      tradeDelegate.address,
    );
    await initializeTradeDelegate();
  };

  const initializeTradeDelegate = async () => {
    await tradeDelegate.authorizeAddress(ringSubmitter.address, {from: deployer});
    await tradeDelegate.authorizeAddress(ringCanceller.address, {from: deployer});

    for (const token of allTokens) {
      // approve once for all orders:
      for (const orderOwner of orderOwners) {
        await token.approve(tradeDelegate.address, 1e32, {from: orderOwner});
      }
    }
  };

  before( async () => {
    [ringSubmitter, ringCanceller, tokenRegistry,
     symbolRegistry, tradeDelegate, orderRegistry,
     minerRegistry, feeHolder, orderBook, taxTable,
     dummyBrokerInterceptor] = await Promise.all([
       RingSubmitter.deployed(),
       RingCanceller.deployed(),
       TokenRegistry.deployed(),
       SymbolRegistry.deployed(),
       TradeDelegate.deployed(),
       OrderRegistry.deployed(),
       MinerRegistry.deployed(),
       FeeHolder.deployed(),
       OrderBook.deployed(),
       TaxTable.deployed(),
       DummyBrokerInterceptor.deployed(),
     ]);

    lrcAddress = await symbolRegistry.getAddressBySymbol("LRC");
    wethAddress = await symbolRegistry.getAddressBySymbol("WETH");

    // Get the different brokers from the ringSubmitter
    orderBrokerRegistryAddress = await ringSubmitter.orderBrokerRegistryAddress();
    minerBrokerRegistryAddress = await ringSubmitter.minerBrokerRegistryAddress();

    // Dummy data
    const minerBrokerRegistry = BrokerRegistry.at(minerBrokerRegistryAddress);
    await minerBrokerRegistry.registerBroker(miner, "0x0", {from: miner});

    for (const sym of allTokenSymbols) {
      const addr = await symbolRegistry.getAddressBySymbol(sym);
      tokenSymbolAddrMap.set(sym, addr);
      const token = await DummyToken.at(addr);
      allTokens.push(token);
    }

    feePercentageBase = (await ringSubmitter.FEE_AND_TAX_PERCENTAGE_BASE()).toNumber();

    await initializeTradeDelegate();
  });

  describe("Security", () => {

    beforeEach(async () => {
      await cleanTradeHistory();
    });

    it("Reentrancy attack", async () => {
      const ringsInfo: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 22e17,
            broker: broker1,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 31e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      // A ring without callbacks so submitRings doesn't get into an infinite loop
      // in a reentrancy scenario
      const ringsInfoAttack: psc.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: allTokenSymbols[0],
            tokenB: allTokenSymbols[1],
            amountS: 35e17,
            amountB: 25e17,
          },
          {
            tokenS: allTokenSymbols[1],
            tokenB: allTokenSymbols[0],
            amountS: 23e17,
            amountB: 32e17,
          },
        ],
        transactionOrigin,
        miner,
        feeRecipient: miner,
      };

      for (const [i, order] of ringsInfo.orders.entries()) {
        await setupOrder(order, i);
      }

      for (const [i, order] of ringsInfoAttack.orders.entries()) {
        await setupOrder(order, i);
      }

      const owner = ringsInfo.orders[0].owner;
      const context = getDefaultContext();

      const attackBrokerInterceptor = await DummyBrokerInterceptor.new(ringSubmitter.address);

      // Register the broker with interceptor
      await registerBrokerChecked(owner, broker1, attackBrokerInterceptor.address);

      // Set the allowance to a large number
      await attackBrokerInterceptor.setAllowance(1e32);

      // Enable the Reentrancy attack
      // Create a valid ring that can be submitted by the interceptor
      {
        const ringsGeneratorAttack = new psc.RingsGenerator(context);
        await ringsGeneratorAttack.setupRingsAsync(ringsInfoAttack);
        const bsAttack = ringsGeneratorAttack.toSubmitableParam(ringsInfoAttack);
        // Enable the reentrancy attack on the interceptor
        await attackBrokerInterceptor.setReentrancyAttackEnabled(true, bsAttack);
      }

      // Setup the ring
      const ringsGenerator = new psc.RingsGenerator(context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // submitRings currently does not throw because external calls cannot fail the transaction
      ringSubmitter.submitRings(bs, {from: transactionOrigin});

      // Unregister the broker
      await unregisterBrokerChecked(owner, broker1);
    });

  });

});
