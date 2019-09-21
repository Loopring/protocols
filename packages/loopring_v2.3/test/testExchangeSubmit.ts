import { BigNumber } from "bignumber.js";
import * as pjs from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { ringsInfoList } from "./rings_config";
import { ExchangeTestUtil } from "./testExchangeUtil";

const {
  DummyExchange,
  OrderBook,
  OrderRegistry,
  TESTToken,
} = new Artifacts(artifacts);

const ContractOrderOwner = artifacts.require("ContractOrderOwner");

contract("Exchange_Submit", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const zeroAddress = "0x" + "00".repeat(20);

  let dummyExchange: any;
  let orderBook: any;
  let orderRegistry: any;
  let contractOrderOwner: any;

  const checkFilled = async (order: pjs.OrderInfo, expected: number) => {
    await exchangeTestUtil.checkFilled(order.hash, expected);
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);

    orderBook = await OrderBook.deployed();
    orderRegistry = await OrderRegistry.deployed();

    // Create dummy exchange and authorize it
    dummyExchange = await DummyExchange.new(exchangeTestUtil.context.tradeDelegate.options.address,
                                            exchangeTestUtil.context.tradeHistory.options.address,
                                            exchangeTestUtil.context.feeHolder.options.address,
                                            exchangeTestUtil.ringSubmitter.address);
    await exchangeTestUtil.context.tradeDelegate.methods.authorizeAddress(
      dummyExchange.address,
    ).send({from: exchangeTestUtil.testContext.deployer});

    contractOrderOwner = await ContractOrderOwner.new(exchangeTestUtil.context.orderBook.options.address, zeroAddress);
  });

  describe("submitRing", () => {

    for (const ringsInfo of ringsInfoList) {
      it(ringsInfo.description, async () => {
        await exchangeTestUtil.setupRings(ringsInfo);
        await exchangeTestUtil.submitRingsAndSimulate(ringsInfo, dummyExchange);
      });
    }

    // We added a revert `INVALID_FILLS` that is fired for this test whenever the spendable is eq to 0. This happens
    // here because the allowance is set to 0.
    it("order owner has not approved sufficient funds to the trade delegate contract", async () => {
      // First transaction
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 100e18,
            amountB: 10e18,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 100e18,
          },
        ],
      };
      ringsInfo.orders[0].owner = exchangeTestUtil.testContext.orderDualAuthAddrs[0];
      await exchangeTestUtil.setupRings(ringsInfo);
      ringsInfo.expected = {
          revert: true,
          revertMessage: "INVALID_FILLS",
      };

      // Nothing approved for tokenS or feeToken, orders should remain completely unfilled
      await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    });

    // Dolomite doesn't support any on-chain orders
    // it("on-chain order should be able to dealed with off-chain order", async () => {
    //   const onChainOrder: pjs.OrderInfo = {
    //     index: 0,
    //     tokenS: "GTO",
    //     tokenB: "WETH",
    //     amountS: 10000e18,
    //     amountB: 3e18,
    //     onChain: true,
    //   };
    //
    //   const offChainOrder: pjs.OrderInfo = {
    //     index: 1,
    //     tokenS: "WETH",
    //     tokenB: "GTO",
    //     amountS: 3e18,
    //     amountB: 10000e18,
    //     feeAmount: 1e18,
    //   };
    //
    //   const ringsInfo: pjs.RingsInfo = {
    //     rings: [[0, 1]],
    //     orders: [
    //       onChainOrder,
    //       offChainOrder,
    //     ],
    //   };
    //
    //   await exchangeTestUtil.setupRings(ringsInfo);
    //
    //   const orderUtil = new pjs.OrderUtil(undefined);
    //   const orderData = orderUtil.toOrderBookSubmitParams(onChainOrder);
    //   const fromBlock = web3.eth.blockNumber;
    //   await orderBook.submitOrder(orderData, {from: onChainOrder.owner});
    //   const events: any = await exchangeTestUtil.getEventsFromContract(orderBook, "OrderSubmitted", fromBlock);
    //   const orderHashOnChain = events[0].args.orderHash;
    //   const orderHash = "0x" + orderUtil.getOrderHash(onChainOrder).toString("hex");
    //   pjs.logDebug("orderHash:", orderHash);
    //   pjs.logDebug("orderHashOnChain:", orderHashOnChain);
    //   assert.equal(orderHashOnChain, orderHash, "order hash not equal");
    //
    //   await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
    // });

    it("should be able to get different burn rates by using different tokens to pay fees", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            feeToken: "LRC",
            feeAmount: 1e18,
            walletAddr: "0",
            walletSplitPercentage: 25,
            balanceS: 5e18,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 10e18,
            feeToken: "REP",
            feeAmount: 1e18,
            walletAddr: "0",
            walletSplitPercentage: 25,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const order0 = ringsInfo.orders[0];
      const order1 = ringsInfo.orders[1];
      const feeRecipient = ringsInfo.feeRecipient;
      const burnRateTable = exchangeTestUtil.context.burnRateTable;

      // Get the burn rates of the tokens
      const BURN_BASE_PERCENTAGE = await burnRateTable.methods.BURN_BASE_PERCENTAGE().call();
      const burnRate0 = (await burnRateTable.methods.getBurnRate(order0.feeToken).call()) & 0xFFFF;
      const burnRate1 = (await burnRateTable.methods.getBurnRate(order1.feeToken).call()) & 0xFFFF;
      assert(burnRate0 !== burnRate1, "Tokens should have different burn rates");

      // Orders will be filled 50%
      const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);
      const feeReceivedMiner0 = report.feeBalancesAfter[order0.feeToken][feeRecipient]
                                      .minus(report.feeBalancesBefore[order0.feeToken][feeRecipient]);
      const feeReceivedWallet0 = report.feeBalancesAfter[order0.feeToken][order0.walletAddr]
                                       .minus(report.feeBalancesBefore[order0.feeToken][order0.walletAddr]);
      const feeReceivedMiner1 = report.feeBalancesAfter[order1.feeToken][feeRecipient]
                                      .minus(report.feeBalancesBefore[order1.feeToken][feeRecipient]);
      const feeReceivedWallet1 = report.feeBalancesAfter[order1.feeToken][order1.walletAddr]
                                       .minus(report.feeBalancesBefore[order1.feeToken][order1.walletAddr]);
      // Wallet percentage split is 25% so miner gets 3x the fee as the wallet
      assert.equal(feeReceivedMiner0.toNumber(), 3 * feeReceivedWallet0.toNumber(),
                   "Wallet fee == Miner fee");
      assert.equal(feeReceivedMiner1.toNumber(), 3 * feeReceivedWallet1.toNumber(),
                   "Wallet fee == Miner fee");

      // Orders will be filled 50% and walletSplitPercentage is set to 25%
      const expectedFee0 = new BigNumber(order0.feeAmount / 8)
                           .mul(BURN_BASE_PERCENTAGE - burnRate0)
                           .dividedToIntegerBy(BURN_BASE_PERCENTAGE);
      const expectedFee1 = new BigNumber(order1.feeAmount / 8)
                           .mul(BURN_BASE_PERCENTAGE - burnRate1)
                           .dividedToIntegerBy(BURN_BASE_PERCENTAGE);
      // Verify the fee payments
      assert.equal(feeReceivedMiner0.toNumber(), 3 * expectedFee0.toNumber(), "fee should match expected value");
      assert.equal(feeReceivedWallet0.toNumber(), expectedFee0.toNumber(), "fee should match expected value");
      assert.equal(feeReceivedMiner1.toNumber(), 3 * expectedFee1.toNumber(), "fee should match expected value");
      assert.equal(feeReceivedWallet1.toNumber(), expectedFee1.toNumber(), "fee should match expected value");
    });

    it("default values should be set to expected values", async () => {
      const lrcAddress = exchangeTestUtil.context.lrcAddress;
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            walletSplitPercentage: 0,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 10e18,
            walletSplitPercentage: 0,
          },
        ],
        transactionOrigin: exchangeTestUtil.testContext.transactionOrigin,
        feeRecipient: null,
        miner: null,
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      const {tx, report} = await exchangeTestUtil.submitRingsAndSimulate(ringsInfo);

      // tx.origin is the default feeRecipient
      {
        const feeRecipient = ringsInfo.transactionOrigin;
        const feeBalanceBefore = report.feeBalancesBefore[lrcAddress][feeRecipient];
        const feeBalanceAfter = report.feeBalancesAfter[lrcAddress][feeRecipient];
        assert(feeBalanceAfter.gt(feeBalanceBefore), "tx.origin should be the default feeRecipient");
      }

      // LRC is the default feeToken
      {
        const callData = await exchangeTestUtil.deserializeRing(ringsInfo);
        const lrcAddressIndex = callData.indexOf(lrcAddress);
        assert.equal(lrcAddressIndex, -1, "LRC address should not be stored in the calldata");
        let numLRCTransfers = 0;
        for (const transfer of report.transferItems) {
          if (transfer.to === exchangeTestUtil.context.feeHolder.options.address) {
            assert.equal(transfer.token, lrcAddress, "LRC should be the default feeToken");
            numLRCTransfers++;
          }
        }
        assert.equal(numLRCTransfers, 2, "2 transfers to the fee contract expected");
      }

      // The order owner is the default tokenRecipient
      {
        for (const order of ringsInfo.orders) {
          const balanceBefore = report.balancesBefore[order.tokenB][order.owner];
          const balanceAfter = report.balancesAfter[order.tokenB][order.owner];
          assert.equal(balanceAfter.minus(balanceBefore).toNumber(), order.amountB,
                       "The order owner should receive the tokens bought");
        }
      }
    });

    it("should revert when a token transfer fails", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "TEST",
            amountS: 10e18,
            amountB: 10e18,
          },
          {
            tokenS: "TEST",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 10e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);

      // Setup the ring
      const ringsGenerator = new pjs.RingsGenerator(exchangeTestUtil.context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // Fail the token transfer by throwing in transferFrom
      const TestToken = await TESTToken.at(exchangeTestUtil.testContext.tokenSymbolAddrMap.get("TEST"));
      await TestToken.setTestCase(await TestToken.TEST_REQUIRE_FAIL());

      // submitRings should revert
      await pjs.expectThrow(
        exchangeTestUtil.ringSubmitter.submitRings(bs, {from: exchangeTestUtil.testContext.transactionOrigin}),
        "TRANSFER_FAILURE",
      );
    });

    it("should not be able to send the same order twice", async () => {
      const ringsInfo: pjs.RingsInfo = {
        rings: [[0, 1], [2, 3]],
        orders: [
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            balanceS: 100e18,
            balanceFee: 100e18,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 10e18,
            amountB: 10e18,
            balanceS: 100e18,
            balanceFee: 100e18,
          },
          {
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: 10e18,
            amountB: 10e18,
            balanceS: 100e18,
            balanceFee: 100e18,
          },
          {
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: 1e18,
            amountB: 1e18,
            balanceS: 100e18,
            balanceFee: 100e18,
          },
        ],
      };
      await exchangeTestUtil.setupRings(ringsInfo);
      // Copy the order
      ringsInfo.orders[2] = ringsInfo.orders[0];

      // Setup the ring
      const ringsGenerator = new pjs.RingsGenerator(exchangeTestUtil.context);
      await ringsGenerator.setupRingsAsync(ringsInfo);
      const bs = ringsGenerator.toSubmitableParam(ringsInfo);

      // submitRings should revert
      await pjs.expectThrow(
        exchangeTestUtil.ringSubmitter.submitRings(bs, {from: exchangeTestUtil.testContext.transactionOrigin}),
        "INVALID_VALUE",
      );
    });

  });

});
