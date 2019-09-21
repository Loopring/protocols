import { BigNumber } from "bignumber.js";
import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { logDebug } from "./logs";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { Fill, InvalidRingEvent, OrderExpectation, OrderInfo, RingMinedEvent,
         RingsInfo, SimulatorReport } from "./types";

interface OrderSettlement {
  amountS: BigNumber;
  amountB: BigNumber;
  amountFee: BigNumber;
  amountFeeS: BigNumber;
  amountFeeB: BigNumber;
  rebateFee: BigNumber;
  rebateS: BigNumber;
  rebateB: BigNumber;
  splitS: BigNumber;
}

interface FeePayment {
  token: string;
  owner: string;
  amount: BigNumber;
}

export class ProtocolValidator {

  context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async verifyTransaction(ringsInfo: RingsInfo,
                                 report: SimulatorReport,
                                 addressBook: { [id: string]: string; }) {
    if (!ringsInfo.expected) {
      return;
    }

    // Check if the transaction should revert
    assert.equal(report.reverted, ringsInfo.expected.revert ? ringsInfo.expected.revert : false,
                 "Transaction should revert when expected");
    if (report.reverted) {
      if (ringsInfo.expected.revertMessage) {
        assert.equal(report.revertMessage, ringsInfo.expected.revertMessage, "Revert message should match");
      }
      return;
    }

    const decimalsPrecision = (ringsInfo.expected.decimalsPrecision !== undefined)
                              ? ringsInfo.expected.decimalsPrecision : 18;

    // Copy balances before
    const expectedBalances: { [id: string]: any; } = {};
    for (const token of Object.keys(report.balancesBefore)) {
      for (const owner of Object.keys(report.balancesBefore[token])) {
        if (!expectedBalances[token]) {
          expectedBalances[token] = {};
        }
        expectedBalances[token][owner] = report.balancesBefore[token][owner];
      }
    }
    // Copy fee balances before
    const expectedFeeBalances: { [id: string]: any; } = {};
    for (const token of Object.keys(report.feeBalancesBefore)) {
      for (const owner of Object.keys(report.feeBalancesBefore[token])) {
        if (!expectedFeeBalances[token]) {
          expectedFeeBalances[token] = {};
        }
        expectedFeeBalances[token][owner] = report.feeBalancesBefore[token][owner];
      }
    }
    // Intialize filled amounts
    const expectedfilledAmounts: { [id: string]: BigNumber; } = {};
    for (const order of ringsInfo.orders) {
      const orderHash = order.hash.toString("hex");
      if (!expectedfilledAmounts[orderHash]) {
        expectedfilledAmounts[orderHash] = report.filledAmountsBefore[orderHash];
      }
    }

    const feeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
    const feePayments: FeePayment[] = [];
    const ringMinedEvents: RingMinedEvent[] = [];
    const invalidRingEvents: InvalidRingEvent[] = [];
    // Simulate order settlement in rings using the given expectations
    for (const [r, ring] of ringsInfo.rings.entries()) {

      // Calculate ring hash
      const orderHashes = new Bitstream();
      for (const order of ring) {
        orderHashes.addHex(ringsInfo.orders[order].hash.toString("hex"));
        orderHashes.addNumber(ringsInfo.orders[order].waiveFeePercentage ?
                              ringsInfo.orders[order].waiveFeePercentage : 0, 2);
      }
      const ringHash = "0x" + ABI.soliditySHA3(
        ["bytes"],
        [Buffer.from(orderHashes.getData().slice(2), "hex")],
      ).toString("hex");

      if (ringsInfo.expected.rings[r].fail) {
        const invalidRingEvent: InvalidRingEvent = {
          ringHash,
        };
        invalidRingEvents.push(invalidRingEvent);
        continue;
      }
      const fills: Fill[] = [];
      for (let o = 0; o < ring.length; o++) {
        const order = ringsInfo.orders[ring[o]];
        const orderExpectation = ringsInfo.expected.rings[r].orders[o];
        const prevIndex = (o + ring.length - 1) % ring.length;
        const prevOrder = ringsInfo.orders[ring[prevIndex]];
        const prevOrderExpectation = ringsInfo.expected.rings[r].orders[prevIndex];
        const orderSettlement = await this.calculateOrderSettlement(ringsInfo.orders,
                                                                    ring,
                                                                    order,
                                                                    orderExpectation,
                                                                    prevOrder,
                                                                    prevOrderExpectation,
                                                                    feeRecipient,
                                                                    feePayments);

        if (orderExpectation.margin !== undefined) {
          // Check if the margin is as expected
          this.assertAlmostEqual(orderSettlement.splitS.toNumber(), orderExpectation.margin,
                                 "Margin does not match the expected value", decimalsPrecision);
        }

        // RingMined fill for this order

        const fill: Fill = {
          orderHash: "0x" + order.hash.toString("hex"),
          owner: order.owner,
          tokenS: order.tokenS,
          amountS: orderSettlement.amountS.minus(orderSettlement.splitS),
          split: orderSettlement.splitS,
          feeAmount: orderSettlement.amountFee.minus(orderSettlement.rebateFee),
          feeAmountS: orderSettlement.amountFeeS.minus(orderSettlement.rebateS),
          feeAmountB: orderSettlement.amountFeeB.minus(orderSettlement.rebateB),
        };
        fills.push(fill);

        // Balances

        const totalS = orderSettlement.amountS.minus(orderSettlement.rebateS);
        const totalB = orderSettlement.amountB.minus(orderSettlement.amountFeeB).plus(orderSettlement.rebateB);
        const totalFee = orderSettlement.amountFee.minus(orderSettlement.rebateFee);
        // console.log("totalS: " + totalS / 1e18);
        // console.log("totalB: " + totalB / 1e18);
        // console.log("totalFee: " + totalFee / 1e18);
        // console.log("splitS: " + orderSettlement.splitS);
        expectedBalances[order.tokenS][order.owner] =
          expectedBalances[order.tokenS][order.owner].minus(totalS);
        expectedBalances[order.tokenB][order.tokenRecipient] =
          expectedBalances[order.tokenB][order.tokenRecipient].plus(totalB);
        expectedBalances[order.feeToken][order.owner] =
          expectedBalances[order.feeToken][order.owner].minus(totalFee);

        // Add margin given to the order owner
        expectedBalances[order.tokenS][order.owner] =
          expectedBalances[order.tokenS][order.owner].plus(orderSettlement.splitS);

        // Filled
        const expectedFilledAmount = new BigNumber(order.amountS)
                                    .times(ringsInfo.expected.rings[r].orders[o].filledFraction.toString())
                                    .floor();
        expectedfilledAmounts[order.hash.toString("hex")] =
          expectedfilledAmounts[order.hash.toString("hex")].plus(expectedFilledAmount);
      }

      const ringMinedEvent: RingMinedEvent = {
        ringIndex: new BigNumber(0),
        ringHash,
        feeRecipient,
        fills,
      };
      ringMinedEvents.push(ringMinedEvent);
    }

    // const addressBook = this.getAddressBook(ringsInfo);
    // Check balances
    for (const token of Object.keys(expectedBalances)) {
      for (const owner of Object.keys(expectedBalances[token])) {
        // const ownerName = addressBook[owner];
        // const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);

        // console.log("[Sim]" + ownerName + ": " +
        //   report.balancesAfter[token][owner].toNumber() / 1e18 + " " + tokenSymbol);
        // console.log("[Exp]" + ownerName + ": " +
        //   expectedBalances[token][owner].toNumber() / 1e18 + " " + tokenSymbol);
        this.assertAlmostEqual(report.balancesAfter[token][owner].toNumber(),
                               expectedBalances[token][owner].toNumber(),
                               "Balance different than expected", decimalsPrecision);
      }
    }
    // Check fee balances
    for (const feePayment of feePayments) {
      expectedFeeBalances[feePayment.token][feePayment.owner] =
        expectedFeeBalances[feePayment.token][feePayment.owner].plus(feePayment.amount);
    }
    for (const token of Object.keys(expectedFeeBalances)) {
      for (const owner of Object.keys(expectedFeeBalances[token])) {
        // const ownerName = addressBook[owner];
        // const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);

        // console.log("[Sim]" + ownerName + ": " + report.feeBalancesAfter[token][owner] / 1e18 + " " + tokenSymbol);
        // console.log("[Exp]" + ownerName + ": " + expectedFeeBalances[token][owner] / 1e18 + " " + tokenSymbol);
        this.assertAlmostEqual(report.feeBalancesAfter[token][owner].toNumber(),
                               expectedFeeBalances[token][owner].toNumber(),
                               "Fee balance different than expected", decimalsPrecision);
      }
    }
    // Check filled
    for (const order of ringsInfo.orders) {
      const orderHash = order.hash.toString("hex");
      this.assertAlmostEqual(report.filledAmountsAfter[orderHash].toNumber(),
                             expectedfilledAmounts[orderHash].toNumber(),
                             "Filled amount different than expected",
                             decimalsPrecision, 6);
    }
    // Check RingMined events
    assert.equal(report.ringMinedEvents.length, ringMinedEvents.length,
                 "Number of RingMined events does not match");
    for (let i = 0; i < ringMinedEvents.length; i++) {
      const expectedEvent = ringMinedEvents[i];
      const simulatorEvent = report.ringMinedEvents[i];
      // assert(contractEvent.ringIndex.eq(simulatorEvent.ringIndex), "ringIndex does not match");
      assert.equal(expectedEvent.ringHash, simulatorEvent.ringHash, "ringHash does not match");
      assert.equal(expectedEvent.feeRecipient, simulatorEvent.feeRecipient, "feeRecipient does not match");
      assert.equal(expectedEvent.fills.length, simulatorEvent.fills.length, "fills length does not match");
      for (let f = 0; f < expectedEvent.fills.length; f++) {
        const expectedFill = expectedEvent.fills[f];
        const simulatorFill = simulatorEvent.fills[f];
        assert.equal(expectedFill.orderHash, simulatorFill.orderHash, "orderHash does not match");
        assert.equal(expectedFill.owner, simulatorFill.owner, "owner does not match");
        assert.equal(expectedFill.tokenS, simulatorFill.tokenS, "tokenS does not match");
        this.assertAlmostEqual(expectedFill.amountS.toNumber(), simulatorFill.amountS.toNumber(),
                               "amountS does not match", decimalsPrecision);
        this.assertAlmostEqual(expectedFill.split.toNumber(), simulatorFill.split.toNumber(),
                               "split does not match", decimalsPrecision);
        this.assertAlmostEqual(expectedFill.feeAmount.toNumber(), simulatorFill.feeAmount.toNumber(),
                               "feeAmount does not match", decimalsPrecision);
        this.assertAlmostEqual(expectedFill.feeAmountS.toNumber(), simulatorFill.feeAmountS.toNumber(),
                               "feeAmountS does not match", decimalsPrecision);
        this.assertAlmostEqual(expectedFill.feeAmountB.toNumber(), simulatorFill.feeAmountB.toNumber(),
                               "feeAmountB does not match", decimalsPrecision);
      }
    }
    // Check InvalidRing events
    assert.equal(report.invalidRingEvents.length, invalidRingEvents.length,
                 "Number of InvalidRing events does not match");
    for (let i = 0; i < invalidRingEvents.length; i++) {
      const expectedEvent = invalidRingEvents[i];
      const simulatorEvent = report.invalidRingEvents[i];
      assert.equal(expectedEvent.ringHash, simulatorEvent.ringHash, "ringHash does not match");
    }
  }

  private async calculateOrderSettlement(orders: OrderInfo[],
                                         ring: number[],
                                         order: OrderInfo,
                                         orderExpectation: OrderExpectation,
                                         prevOrder: OrderInfo,
                                         prevOrderExpectation: OrderExpectation,
                                         feeRecipient: string,
                                         feePayments: FeePayment[]) {
    let walletSplitPercentage = order.walletSplitPercentage;
    if (!order.walletAddr) {
      walletSplitPercentage = 0;
    }
    if (orderExpectation.P2P) {
      walletSplitPercentage = 100;
    }

    if (orderExpectation.P2P) {
      // Fill amounts
      const amountS = new BigNumber(order.amountS).times(orderExpectation.filledFraction.toString()).floor();
      const amountB = new BigNumber(order.amountB).times(orderExpectation.filledFraction.toString()).floor();

      // Fees
      const amountFeeS = amountS.times(order.tokenSFeePercentage).dividedToIntegerBy(this.context.feePercentageBase);
      const amountFeeB = amountB.times(order.tokenBFeePercentage).dividedToIntegerBy(this.context.feePercentageBase);
      const rebateS = await this.collectFeePayments(feePayments,
                                                    orders,
                                                    ring,
                                                    order,
                                                    orderExpectation,
                                                    order.tokenS,
                                                    amountFeeS,
                                                    walletSplitPercentage,
                                                    feeRecipient);
      const rebateB = await this.collectFeePayments(feePayments,
                                                    orders,
                                                    ring,
                                                    order,
                                                    orderExpectation,
                                                    order.tokenB,
                                                    amountFeeB,
                                                    walletSplitPercentage,
                                                    feeRecipient);

      const prevAmountB = new BigNumber(prevOrder.amountB)
                         .times(prevOrderExpectation.filledFraction.toString())
                         .floor();
      const splitS = amountS.minus(amountFeeS).minus(prevAmountB);
      const epsilon = 10000;
      assert(splitS.gte(-epsilon), "splitS >= 0");

      const orderSettlement: OrderSettlement = {
        amountS,
        amountB,
        amountFee: new BigNumber(0),
        amountFeeS,
        amountFeeB,
        rebateFee: new BigNumber(0),
        rebateS,
        rebateB,
        splitS,
      };
      return orderSettlement;
    } else {
      // Fill amounts
      const amountS = new BigNumber(order.amountS).times(orderExpectation.filledFraction.toString()).floor();
      const amountB = new BigNumber(order.amountB).times(orderExpectation.filledFraction.toString()).floor();

      // Fee
      let amountFee = new BigNumber(order.feeAmount).times(orderExpectation.filledFraction.toString()).floor();

      let rebateFee = await this.collectFeePayments(feePayments,
                                                      orders,
                                                      ring,
                                                      order,
                                                      orderExpectation,
                                                      order.feeToken,
                                                      amountFee,
                                                      walletSplitPercentage,
                                                      feeRecipient);

      const prevAmountB = new BigNumber(prevOrder.amountB)
                          .times(prevOrderExpectation.filledFraction.toString())
                          .floor();
      const splitS = amountS.minus(prevAmountB);
      const epsilon = 10000;
      assert(splitS.gte(-epsilon), "splitS >= 0");

      // Pay using amountB in tokenB when expected
      let amountFeeB = new BigNumber(0);
      let rebateB = new BigNumber(0);
      const payMatchingFeeUsingAmountB = (orderExpectation.payMatchingFeeUsingAmountB === undefined) ?
                                         (order.tokenB === order.feeToken) :
                                         orderExpectation.payMatchingFeeUsingAmountB;
      if (payMatchingFeeUsingAmountB) {
        assert(order.tokenB === order.feeToken, "Cannot pay matching fee in tokenB when tokenB != feeToken");
        amountFeeB = amountFee;
        rebateB = rebateFee;
        amountFee = new BigNumber(0);
        rebateFee = new BigNumber(0);
      }

      const orderSettlement: OrderSettlement = {
        amountS,
        amountB,
        amountFee,
        amountFeeS: new BigNumber(0),
        amountFeeB,
        rebateFee,
        rebateS: new BigNumber(0),
        rebateB,
        splitS,
      };
      return orderSettlement;
    }
  }

  private async collectFeePayments(feePayments: FeePayment[],
                                   orders: OrderInfo[],
                                   ring: number[],
                                   order: OrderInfo,
                                   orderExpectation: OrderExpectation,
                                   token: string,
                                   totalAmount: BigNumber,
                                   walletSplitPercentage: number,
                                   feeRecipient: string) {
    if (totalAmount.isZero()) {
      return new BigNumber(0);
    }

    let amount = totalAmount;
    if (orderExpectation.P2P && !order.walletAddr) {
      amount = new BigNumber(0);
    }

    // Pay the burn rate with the feeHolder as owner
    const burnAddress = this.context.feeHolder.options.address;

    const walletFee = amount.times(walletSplitPercentage).dividedToIntegerBy(100);
    let minerFee = amount.minus(walletFee);

    // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
    if (order.waiveFeePercentage > 0) {
      minerFee = minerFee
                 .times(this.context.feePercentageBase - order.waiveFeePercentage)
                 .dividedToIntegerBy(this.context.feePercentageBase);
    } else if (order.waiveFeePercentage < 0) {
      // No fees need to be paid to the miner by this order
      minerFee = new BigNumber(0);
    }

    // Calculate burn rates and rebates
    const burnRateToken = await this.context.burnRateTable.methods.getBurnRate(token).call();
    const burnRate = orderExpectation.P2P ? (burnRateToken >> 16) : (burnRateToken & 0xFFFF);
    const rebateRate = 0;
    // Miner fee
    const minerBurn = minerFee.times(burnRate).dividedToIntegerBy(this.context.feePercentageBase);
    const minerRebate = minerFee.times(rebateRate).dividedToIntegerBy(this.context.feePercentageBase);
    minerFee = minerFee.minus(minerBurn).minus(minerRebate);
    // Wallet fee
    const walletBurn = walletFee.times(burnRate).dividedToIntegerBy(this.context.feePercentageBase);
    const walletRebate = walletFee.times(rebateRate).dividedToIntegerBy(this.context.feePercentageBase);
    const feeToWallet = walletFee.minus(walletBurn).minus(walletRebate);

    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    let feeToMiner = minerFee;
    if (minerFee.gt(0)) {
      // Pay out the fees to the orders
      let minerFeesToOrdersPercentage = 0;
      for (const ringOrderIndex of ring) {
        const ringOrder = orders[ringOrderIndex];
        if (ringOrder.waiveFeePercentage < 0) {
          const feeToOwner = minerFee
                             .times(-ringOrder.waiveFeePercentage)
                             .dividedToIntegerBy(this.context.feePercentageBase);
          await this.addFeePayment(feePayments, token, ringOrder.owner, feeToOwner);
          minerFeesToOrdersPercentage += -ringOrder.waiveFeePercentage;
        }
      }
      // Subtract all fees the miner pays to the orders
      feeToMiner = minerFee
                   .times(this.context.feePercentageBase - minerFeesToOrdersPercentage)
                   .dividedToIntegerBy(this.context.feePercentageBase);
    }

    // Do the fee payments
    await this.addFeePayment(feePayments, token, order.walletAddr, feeToWallet);
    await this.addFeePayment(feePayments, token, feeRecipient, feeToMiner);
    // Burn
    await this.addFeePayment(feePayments, token, burnAddress, minerBurn.plus(walletBurn));

    // Calculate the total fee payment after possible discounts (burn rate rebate + fee waiving)
    const totalFeePaid = (feeToWallet.plus(minerFee)).plus(minerBurn.plus(walletBurn));

    // Return the rebate this order got
    return totalAmount.minus(totalFeePaid);
  }

  private addFeePayment(feePayments: FeePayment[],
                        token: string,
                        owner: string,
                        amount: BigNumber) {
    if (amount.gt(0)) {
      const feePayment: FeePayment = {
        token,
        owner,
        amount,
      };
      feePayments.push(feePayment);
    }
  }

  private assertAlmostEqual(n1: number, n2: number, description: string, decimals: number, precision = 8) {
    const numStr1 = (n1 / (10 ** decimals)).toFixed(precision);
    const numStr2 = (n2 / (10 ** decimals)).toFixed(precision);
    return assert.equal(Number(numStr1), Number(numStr2), description);
  }
}
