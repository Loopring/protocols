import { Context } from "./context";
import { OrderUtil } from "./order";
import { OrderExpectation, OrderInfo, RingsInfo, SimulatorReport } from "./types";

interface OrderSettlement {
  amountS: number;
  amountB: number;
  amountFee: number;
  amountFeeS: number;
  amountFeeB: number;
  rebateFee: number;
  rebateS: number;
  rebateB: number;
  splitS: number;
}

interface FeePayment {
  token: string;
  owner: string;
  amount: number;
}

export class ProtocolValidator {

  public context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  public async verifyTransaction(ringsInfo: RingsInfo,
                                 report: SimulatorReport,
                                 addressBook: { [id: string]: string; }) {
    if (!ringsInfo.expected) {
      return;
    }

    // Check if the transaction should revert
    assert.equal(report.reverted, ringsInfo.expected.revert ? ringsInfo.expected.revert : false,
                 "Transaction should revert when expected");
    if (report.reverted) {
      return;
    }

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
    const expectedfilledAmounts: { [id: string]: any; } = {};
    for (const order of ringsInfo.orders) {
      const orderHash = order.hash.toString("hex");
      if (!expectedfilledAmounts[orderHash]) {
        expectedfilledAmounts[orderHash] = 0;
      }
    }

    const feeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
    const feePayments: FeePayment[] = [];
    // Simulate order settlement in rings using the given expectations
    for (const [r, ring] of ringsInfo.rings.entries()) {
      if (ringsInfo.expected.rings[r].fail) {
        continue;
      }
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

        // Balances
        const totalS = orderSettlement.amountS - orderSettlement.rebateS;
        const totalB = orderSettlement.amountB - orderSettlement.amountFeeB + orderSettlement.rebateB;
        const totalFee = orderSettlement.amountFee - orderSettlement.rebateFee;
        // console.log("totalS: " + totalS / 1e18);
        // console.log("totalB: " + totalB / 1e18);
        // console.log("totalFee: " + totalFee / 1e18);
        // console.log("splitS: " + orderSettlement.splitS);
        expectedBalances[order.tokenS][order.owner] -= totalS;
        expectedBalances[order.tokenB][order.tokenRecipient] += totalB;
        expectedBalances[order.feeToken][order.owner] -= totalFee;

        // Add margin given to the feeRecipient
        expectedBalances[order.tokenS][feeRecipient] += orderSettlement.splitS;

        // Filled
        const expectedFilledAmount = order.amountS * ringsInfo.expected.rings[r].orders[o].filledFraction;
        expectedfilledAmounts[order.hash.toString("hex")] += expectedFilledAmount;
      }
    }

    // const addressBook = this.getAddressBook(ringsInfo);
    // Check balances
    for (const token of Object.keys(expectedBalances)) {
      for (const owner of Object.keys(expectedBalances[token])) {
        // const ownerName = addressBook[owner];
        // const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);
        // console.log("[Sim]" + ownerName + ": " + report.balancesAfter[token][owner] / 1e18 + " " + tokenSymbol);
        // console.log("[Exp]" + ownerName + ": " + expectedBalances[token][owner] / 1e18 + " " + tokenSymbol);
        this.assertAlmostEqual(report.balancesAfter[token][owner], expectedBalances[token][owner],
                               "Balance differant than expected");
      }
    }
    // Check fee balances
    for (const feePayment of feePayments) {
      expectedFeeBalances[feePayment.token][feePayment.owner] += feePayment.amount;
    }
    for (const token of Object.keys(expectedFeeBalances)) {
      for (const owner of Object.keys(expectedFeeBalances[token])) {
        // const ownerName = addressBook[owner];
        // const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(token);
        // console.log("[Sim]" + ownerName + ": " + report.feeBalancesAfter[token][owner] / 1e18 + " " + tokenSymbol);
        // console.log("[Exp]" + ownerName + ": " + expectedFeeBalances[token][owner] / 1e18 + " " + tokenSymbol);
        this.assertAlmostEqual(report.feeBalancesAfter[token][owner], expectedFeeBalances[token][owner],
                               "Fee balance different than expected");
      }
    }
    // Check filled
    for (const order of ringsInfo.orders) {
      const orderHash = order.hash.toString("hex");
      this.assertAlmostEqual(report.filledAmounts[orderHash], expectedfilledAmounts[orderHash],
                             "Filled amount different than expected");
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
      const amountS = order.amountS * orderExpectation.filledFraction;
      const amountB = order.amountB * orderExpectation.filledFraction;

      // Fees
      const amountFeeS = Math.floor(amountS * order.tokenSFeePercentage / this.context.feePercentageBase);
      const amountFeeB = Math.floor(amountB * order.tokenBFeePercentage / this.context.feePercentageBase);
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

      const prevAmountB = prevOrder.amountB * prevOrderExpectation.filledFraction;
      const splitS = (amountS - amountFeeS) - prevAmountB;

      const orderSettlement: OrderSettlement = {
        amountS,
        amountB,
        amountFee: 0,
        amountFeeS,
        amountFeeB,
        rebateFee: 0,
        rebateS,
        rebateB,
        splitS,
      };
      return orderSettlement;
    } else {
      // Fill amounts
      const amountS = order.amountS * orderExpectation.filledFraction;
      const amountB = order.amountB * orderExpectation.filledFraction;

      // Fees
      let amountFee = order.feeAmount * orderExpectation.filledFraction;
      let amountFeeB = Math.floor(amountB * order.feePercentage / this.context.feePercentageBase);

      // Pay in either feeToken or tokenB
      if (orderExpectation.payFeeInTokenB) {
        amountFee = 0;
      } else {
        amountFeeB = 0;
      }

      const rebateFee = await this.collectFeePayments(feePayments,
                                                      orders,
                                                      ring,
                                                      order,
                                                      orderExpectation,
                                                      order.feeToken,
                                                      amountFee,
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

      const prevAmountB = prevOrder.amountB * prevOrderExpectation.filledFraction;
      const splitS = amountS - prevAmountB;

      const orderSettlement: OrderSettlement = {
        amountS,
        amountB,
        amountFee,
        amountFeeS: 0,
        amountFeeB,
        rebateFee,
        rebateS: 0,
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
                                   totalAmount: number,
                                   walletSplitPercentage: number,
                                   feeRecipient: string) {
    if (totalAmount === 0) {
      return 0;
    }

    let amount = totalAmount;
    if (orderExpectation.P2P && !order.walletAddr) {
      amount = 0;
    }

    // Pay the burn rate with the feeHolder as owner
    const burnAddress = this.context.feeHolder.address;

    const walletFee = Math.floor(amount * walletSplitPercentage / 100);
    let minerFee = amount - walletFee;

    // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
    if (order.waiveFeePercentage > 0) {
      minerFee = Math.floor(minerFee *
                            (this.context.feePercentageBase - order.waiveFeePercentage) /
                            this.context.feePercentageBase);
    } else if (order.waiveFeePercentage < 0) {
      // No fees need to be paid to the miner by this order
      minerFee = 0;
    }

    // Calculate burn rates and rebates
    const burnRateToken = (await this.context.burnRateTable.getBurnRate(token)).toNumber();
    const burnRate = orderExpectation.P2P ? (burnRateToken >> 16) : (burnRateToken & 0xFFFF);
    const rebateRate = 0;
    // Miner fee
    const minerBurn = Math.floor(minerFee * burnRate / this.context.feePercentageBase);
    const minerRebate = Math.floor(minerFee * rebateRate / this.context.feePercentageBase);
    minerFee = minerFee - minerBurn - minerRebate;
    // Wallet fee
    const walletBurn = Math.floor(walletFee * burnRate / this.context.feePercentageBase);
    const walletRebate = Math.floor(walletFee * rebateRate / this.context.feePercentageBase);
    const feeToWallet = walletFee - walletBurn - walletRebate;

    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    let feeToMiner = minerFee;
    if (minerFee > 0) {
      // Pay out the fees to the orders
      let minerFeesToOrdersPercentage = 0;
      for (const ringOrderIndex of ring) {
        const ringOrder = orders[ringOrderIndex];
        if (ringOrder.waiveFeePercentage < 0) {
          const feeToOwner = Math.floor(minerFee *
                             (-ringOrder.waiveFeePercentage) / this.context.feePercentageBase);
          await this.addFeePayment(feePayments, token, ringOrder.owner, feeToOwner);
          minerFeesToOrdersPercentage += -ringOrder.waiveFeePercentage;
        }
      }
      // Subtract all fees the miner pays to the orders
      feeToMiner = Math.floor(minerFee * (this.context.feePercentageBase - minerFeesToOrdersPercentage) /
                              this.context.feePercentageBase);
    }

    // Do the fee payments
    await this.addFeePayment(feePayments, token, order.walletAddr, feeToWallet);
    await this.addFeePayment(feePayments, token, feeRecipient, feeToMiner);
    // Burn
    await this.addFeePayment(feePayments, token, burnAddress, minerBurn + walletBurn);

    // Calculate the total fee payment after possible discounts (burn rate rebate + fee waiving)
    let totalFeePaid = (feeToWallet + minerFee) + (minerBurn + walletBurn);

    // JS rounding errors...
    if (totalFeePaid > totalAmount && totalFeePaid < totalAmount + 10000) {
      totalFeePaid = totalAmount;
    }

    // Return the rebate this order got
    return totalAmount - totalFeePaid;
  }

  private addFeePayment(feePayments: FeePayment[],
                        token: string,
                        owner: string,
                        amount: number) {
    if (amount > 0) {
      const feePayment: FeePayment = {
        token,
        owner,
        amount,
      };
      feePayments.push(feePayment);
    }
  }

  private assertAlmostEqual(n1: number, n2: number, description: string, precision: number = 8) {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);
    return assert.equal(Number(numStr1), Number(numStr2), description);
  }
}
