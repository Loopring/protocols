import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { DetailedTokenTransfer, OrderInfo, OrderPayments, Participation, RingPayments, TransferItem } from "./types";

export class Ring {

  public participations: Participation[] = [];
  public hash?: Buffer;
  public minerFeesToOrdersPercentage?: number;
  public valid: boolean;

  public payments: RingPayments;

  private context: Context;
  private orderUtil: OrderUtil;

  private feeBalances: { [id: string]: any; } = {};

  // BEGIN diagnostics
  private detailTransferS: DetailedTokenTransfer[];
  private detailTransferB: DetailedTokenTransfer[];
  private detailTransferFee: DetailedTokenTransfer[];
  // END diagnostics

  constructor(context: Context,
              orders: OrderInfo[]) {
    this.context = context;
    this.valid = true;
    this.minerFeesToOrdersPercentage = 0;
    this.orderUtil = new OrderUtil(context);

    for (const order of orders) {
      const participation: Participation = {
        order,
        splitS: 0,
        feeAmount: 0,
        feeAmountS: 0,
        feeAmountB: 0,
        rebateFee: 0,
        rebateS: 0,
        rebateB: 0,
        fillAmountS: 0,
        fillAmountB: 0,
      };
      this.participations.push(participation);
    }

    // BEGIN diagnostics
    this.payments = {
      orders: [],
    };
    this.detailTransferS = [];
    this.detailTransferB = [];
    this.detailTransferFee = [];
    for (const [i, order] of orders.entries()) {
      this.payments.orders.push({
        payments: [],
      });

      const prevOrder = orders[(i + orders.length - 1) % orders.length];
      const nextOrder = orders[(i + 1) % orders.length];

      const paymentS: DetailedTokenTransfer = {
        description: "Sell",
        token: order.tokenS,
        from: order.owner,
        to: prevOrder.owner,
        amount: 0,
        subPayments: [],
      };
      this.detailTransferS.push(paymentS);
      this.payments.orders[i].payments.push(paymentS);

      const paymentB: DetailedTokenTransfer = {
        description: "Buy",
        token: order.tokenB,
        from: nextOrder.owner,
        to: order.owner,
        amount: 0,
        subPayments: [],
      };
      this.detailTransferB.push(paymentB);
      this.payments.orders[i].payments.push(paymentB);

      const paymentFee: DetailedTokenTransfer = {
        description: "MatchingFee",
        token: order.feeToken,
        from: order.owner,
        to: "NA",
        amount: 0,
        subPayments: [],
      };
      this.detailTransferFee.push(paymentFee);
      this.payments.orders[i].payments.push(paymentFee);
    }
    // END diagnostics
  }

  public updateHash() {
    const orderHashes = new Bitstream();
    for (const p of this.participations) {
      orderHashes.addHex(p.order.hash.toString("hex"));
      orderHashes.addNumber(p.order.waiveFeePercentage ? p.order.waiveFeePercentage : 0, 2);
    }
    this.hash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
  }

  public checkOrdersValid() {
    this.valid = this.valid &&
                 ensure(this.participations.length > 1 && this.participations.length <= 8, "invald ring size");
    for (const p of this.participations) {
      this.valid = this.valid && ensure(p.order.valid, "ring contains invalid order");
    }
  }

  public checkForSubRings() {
    for (let i = 0; i < this.participations.length - 1; i++) {
      const tokenS = this.participations[i].order.tokenS;
      for (let j = i + 1; j < this.participations.length; j++) {
        this.valid = this.valid && ensure(tokenS !== this.participations[j].order.tokenS, "ring has sub-rings");
      }
    }
  }

  public async calculateFillAmountAndFee() {
    // Invalid order data could cause a divide by zero in the calculations
    if (!this.valid) {
      return;
    }

    for (const p of this.participations) {
      await this.setMaxFillAmounts(p);
    }

    let smallest = 0;
    const ringSize = this.participations.length;

    for (let i = ringSize - 1; i >= 0; i--) {
      smallest = this.resize(i, smallest);
    }

    for (let i = ringSize - 1; i >= smallest; i--) {
      this.resize(i, smallest);
    }

    // Reserve the total amount tokenS used for all the orders
    // (e.g. the owner of order 0 could use LRC as feeToken in order 0, while
    // the same owner can also sell LRC in order 2).
    for (const p of this.participations) {
      await this.orderUtil.reserveAmountS(p.order, p.fillAmountS);
    }

    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;

      const valid = await this.calculateFees(this.participations[i], this.participations[prevIndex]);
      this.valid = ensure(valid, "ring cannot be settled");
      if (this.participations[i].order.waiveFeePercentage < 0) {
        this.minerFeesToOrdersPercentage += -this.participations[i].order.waiveFeePercentage;
      }
    }
    this.valid = this.valid && ensure(this.minerFeesToOrdersPercentage <= this.context.feePercentageBase,
                                      "miner distributes more than 100% of its fees to order owners");

    // Ring calculations are done. Make sure te remove all reservations for this ring
    for (const p of this.participations) {
      this.orderUtil.resetReservations(p.order);
    }
  }

  public async setMaxFillAmounts(p: Participation) {
    const remainingS = p.order.amountS - p.order.filledAmountS;
    p.ringSpendableS = await this.orderUtil.getSpendableS(p.order);
    p.fillAmountS = Math.min(p.ringSpendableS, remainingS);
    p.fillAmountB = Math.floor(p.fillAmountS * p.order.amountB / p.order.amountS);
  }

  public async calculateFees(p: Participation, prevP: Participation) {
    if (p.order.P2P) {
      // Calculate P2P fees
      p.feeAmount = 0;
      p.feeAmountS = Math.floor(p.fillAmountS * p.order.tokenSFeePercentage /
                              this.context.feePercentageBase);
      p.feeAmountB = Math.floor(p.fillAmountB * p.order.tokenBFeePercentage /
                              this.context.feePercentageBase);
    } else {
      // Calculate matching fees
      p.feeAmount = Math.floor(p.order.feeAmount * p.fillAmountS / p.order.amountS);
      p.feeAmountS = 0;
      p.feeAmountB = 0;

      // If feeToken == tokenB, try to pay using fillAmountB
      if (p.order.feeToken === p.order.tokenB && p.fillAmountB >= p.feeAmount) {
        p.feeAmountB = p.feeAmount;
        p.feeAmount = 0;
      }

      // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
      p.ringSpendableFee = await this.orderUtil.getSpendableFee(p.order);
      if (p.feeAmount > p.ringSpendableFee) {
          p.feeAmountB += Math.floor(p.fillAmountB * p.order.feePercentage / this.context.feePercentageBase);
          p.feeAmount = 0;
      } else {
        await this.orderUtil.reserveAmountFee(p.order, p.feeAmount);
      }
    }

    if (p.fillAmountS - p.feeAmountS >= prevP.fillAmountB) {
      // The miner (or in a P2P case, the taker) gets the margin
      p.splitS = (p.fillAmountS - p.feeAmountS) - prevP.fillAmountB;
      p.fillAmountS = prevP.fillAmountB + p.feeAmountS;
      return true;
    } else {
      return false;
    }
  }

  public adjustOrderState(p: Participation) {
    // Update filled amount
    p.order.filledAmountS += p.fillAmountS + p.splitS;

    // Update spendables
    const totalAmountS = p.fillAmountS + p.splitS;
    const totalAmountFee = p.feeAmount;
    p.order.tokenSpendableS.amount -= totalAmountS;
    p.order.tokenSpendableFee.amount -= totalAmountFee;
    if (p.order.brokerInterceptor) {
      p.order.brokerSpendableS.amount -= totalAmountS;
      p.order.brokerSpendableFee.amount -= totalAmountFee;
      assert(p.order.brokerSpendableS.amount >= 0, "brokerSpendableS should be positive");
      assert(p.order.tokenSpendableFee.amount >= 0, "tokenSpendableFee should be positive");
    }
    // Checks
    assert(p.order.tokenSpendableS.amount >= 0, "spendableS should be positive");
    assert(p.order.tokenSpendableFee.amount >= 0, "spendableFee should be positive");
    assert(p.order.filledAmountS <= p.order.amountS, "filledAmountS <= amountS");
  }

  public async adjustOrderStates() {
    // Adjust orders
    for (const p of this.participations) {
      this.adjustOrderState(p);
    }
  }

  public async doPayments(mining: Mining, feeBalances: { [id: string]: any; }) {
    if (!this.valid) {
      return [];
    }

    await this.payFees(mining);
    const transferItems = await this.transferTokens();

    // Validate how the ring is settled
    await this.validateSettlement(transferItems);

    // Add the fee balances to the global fee list
    for (const token of Object.keys(this.feeBalances)) {
      for (const owner of Object.keys(this.feeBalances[token])) {
        if (!feeBalances[token]) {
          feeBalances[token] = {};
        }
        if (!feeBalances[token][owner]) {
          feeBalances[token][owner] = await this.context.feeHolder.feeBalances(token, owner).toNumber();
        }
        feeBalances[token][owner] += this.feeBalances[token][owner];
      }
    }

    return transferItems;
  }

  private transferTokens() {
    const ringSize = this.participations.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const p = this.participations[i];
      const prevP = this.participations[prevIndex];
      const feeHolder = this.context.feeHolder.address;

      const buyerFeeAmountAfterRebateB = prevP.feeAmountB - prevP.rebateB;
      assert(buyerFeeAmountAfterRebateB >= 0, "buyerFeeAmountAfterRebateB >= 0");

      // If the buyer needs to pay fees in a percentage of tokenB, the seller needs
      // to send that amount of tokenS to the fee holder contract.
      const amountSToBuyer = p.fillAmountS -
                             p.feeAmountS -
                             buyerFeeAmountAfterRebateB;
      let amountSToFeeHolder = (p.feeAmountS - p.rebateS) +
                               buyerFeeAmountAfterRebateB +
                               p.splitS;
      let amountFeeToFeeHolder = p.feeAmount - p.rebateFee;
      if (p.order.tokenS === p.order.feeToken) {
        amountSToFeeHolder += amountFeeToFeeHolder;
        amountFeeToFeeHolder = 0;
      }

      this.addTokenTransfer(transferItems, p.order.tokenS, p.order.owner, prevP.order.tokenRecipient, amountSToBuyer);
      this.addTokenTransfer(transferItems, p.order.tokenS, p.order.owner, feeHolder, amountSToFeeHolder);
      this.addTokenTransfer(transferItems, p.order.feeToken, p.order.owner, feeHolder, amountFeeToFeeHolder);

      // BEGIN diagnostics
      this.detailTransferS[i].amount = p.fillAmountS + p.splitS;
      this.logPayment(this.detailTransferS[i], p.order.tokenS, p.order.owner, prevP.order.tokenRecipient,
                      p.fillAmountS - p.feeAmountS, "ToBuyer");
      this.detailTransferB[i].amount = p.fillAmountB;
      this.detailTransferFee[i].amount = p.feeAmount;
      // END diagnostics
    }
    return transferItems;
  }

  private addTokenTransfer(transferItems: TransferItem[], token: string, from: string, to: string, amount: number) {
    if (from !== to && amount > 0) {
      transferItems.push({token, from, to, amount});
    }
  }

  private async payFees(mining: Mining) {
    const ringSize = this.participations.length;
    for (let i = 0; i < ringSize; i++) {
      const p = this.participations[i];

      const walletPercentage = p.order.P2P ? 100 :
                               (p.order.walletAddr ? p.order.walletSplitPercentage : 0);

      // Save these fee amounts before any discount the order gets for validation
      const feePercentageB = p.order.P2P ? p.order.tokenBFeePercentage : p.order.feePercentage;

      p.rebateFee = await this.payFeesAndBurn(mining,
                                              p,
                                              p.order.feeToken,
                                              p.feeAmount,
                                              0,
                                              walletPercentage,
                                              this.detailTransferFee[i]);
      p.rebateS = await this.payFeesAndBurn(mining,
                                            p,
                                            p.order.tokenS,
                                            p.feeAmountS,
                                            p.splitS,
                                            walletPercentage,
                                            this.detailTransferS[i],
                                            p.order.tokenSFeePercentage);
      p.rebateB = await this.payFeesAndBurn(mining,
                                            p,
                                            p.order.tokenB,
                                            p.feeAmountB,
                                            0,
                                            walletPercentage,
                                            this.detailTransferB[i],
                                            feePercentageB);
    }
  }

  private async payFeesAndBurn(mining: Mining,
                               p: Participation,
                               token: string,
                               totalAmount: number,
                               margin: number,
                               walletSplitPercentage: number,
                               payment: DetailedTokenTransfer,
                               feePercentage: number = 0) {
    if (totalAmount + margin === 0) {
      return 0;
    }

    let amount = totalAmount;
    // No need to pay any fees in a P2P order without a wallet
    // (but the fee amount is a part of amountS of the order, so the fee amount is rebated).
    if (p.order.P2P && !p.order.walletAddr) {
      amount = 0;
    }

    // Pay the burn rate with the feeHolder as owner
    const burnAddress = this.context.feeHolder.address;

    // BEGIN diagnostics
    let feeDesc = "Fee";
    if (!p.order.P2P && p.order.feeToken === p.order.tokenB) {
      feeDesc += "@feeToken";
    } else {
      feeDesc += ((feePercentage > 0) ? ("@" + (feePercentage / 10)) + "%" : "");
    }
    const totalPayment = this.logPayment(payment, token, p.order.owner, "NA", amount + margin, feeDesc + "+Margin");
    const marginPayment = this.logPayment(totalPayment, token, p.order.owner, mining.feeRecipient, margin, "Margin");
    const feePayment = this.logPayment(totalPayment, token, p.order.owner, "NA", amount, feeDesc);
    // END diagnostics

    const walletFee = Math.floor(amount * walletSplitPercentage / 100);
    let minerFee = amount - walletFee;

    // BEGIN diagnostics
    const walletPayment = this.logPayment(
      feePayment, token, p.order.owner, "NA", walletFee, "Wallet@" + walletSplitPercentage + "%");
    let minerPayment = this.logPayment(
      feePayment, token, p.order.owner, "NA", minerFee, "Miner@" + (100 - walletSplitPercentage) + "%");
    // END diagnostics

    // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
    if (p.order.waiveFeePercentage > 0) {
      minerFee = Math.floor(minerFee *
                            (this.context.feePercentageBase - p.order.waiveFeePercentage) /
                            this.context.feePercentageBase);

      // BEGIN diagnostics
      minerPayment = this.logPayment(
        minerPayment, token, p.order.owner, "NA", minerFee, "Waive@" + p.order.waiveFeePercentage / 10 + "%");
      // END diagnostics
    } else if (p.order.waiveFeePercentage < 0) {
      // No fees need to be paid to the miner by this order
      minerFee = 0;

      // BEGIN diagnostics
      minerPayment = this.logPayment(
        minerPayment, token, p.order.owner, "NA", minerFee, "Waive@" + p.order.waiveFeePercentage / 10 + "%");
      // END diagnostics
    }

    // Calculate burn rates and rebates
    const burnRateToken = (await this.context.burnRateTable.getBurnRate(token)).toNumber();
    const burnRate = p.order.P2P ? (burnRateToken >> 16) : (burnRateToken & 0xFFFF);
    const rebateRate = 0;
    // Miner fee
    const minerBurn = Math.floor(minerFee * burnRate / this.context.feePercentageBase);
    const minerRebate = Math.floor(minerFee * rebateRate / this.context.feePercentageBase);
    minerFee = margin + (minerFee - minerBurn - minerRebate);
    // Wallet fee
    const walletBurn = Math.floor(walletFee * burnRate / this.context.feePercentageBase);
    const walletRebate = Math.floor(walletFee * rebateRate / this.context.feePercentageBase);
    const feeToWallet = walletFee - walletBurn - walletRebate;

    // BEGIN diagnostics
    this.logPayment(minerPayment, token, p.order.owner, burnAddress, minerBurn, "Burn@" + burnRate / 10 + "%");
    this.logPayment(minerPayment, token, p.order.owner, p.order.owner, minerRebate, "Rebate@" + rebateRate / 10 + "%");
    const minerIncomePayment =
      this.logPayment(minerPayment, token, p.order.owner, mining.feeRecipient, minerFee - margin, "Income");
    this.logPayment(walletPayment, token, p.order.owner, burnAddress, walletBurn, "Burn@" + burnRate / 10 + "%");
    this.logPayment(walletPayment, token, p.order.owner, p.order.owner, walletRebate,
                    "Rebate@" + rebateRate / 10 + "%");
    this.logPayment(walletPayment, token, p.order.owner, p.order.walletAddr, feeToWallet, "Income");
    // END diagnostics

    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    let feeToMiner = minerFee;
    if (this.minerFeesToOrdersPercentage > 0 && minerFee > 0) {
      // Pay out the fees to the orders
      for (const otherP of this.participations) {
        if (otherP.order.waiveFeePercentage < 0) {
          const feeToOwner = Math.floor(minerFee *
                             (-otherP.order.waiveFeePercentage) / this.context.feePercentageBase);
          await this.addFeePayment(token, otherP.order.owner, feeToOwner);

          // BEGIN diagnostics
          this.logPayment(minerIncomePayment, token, p.order.owner, otherP.order.owner, feeToOwner,
            "Share_Income+Margin@" + (-otherP.order.waiveFeePercentage) / 10 + "%");
          // END diagnostics
        }
      }
      // Subtract all fees the miner pays to the orders
      feeToMiner = Math.floor(minerFee * (this.context.feePercentageBase - this.minerFeesToOrdersPercentage) /
      this.context.feePercentageBase);
    }

    // Do the fee payments
    await this.addFeePayment(token, p.order.walletAddr, feeToWallet);
    await this.addFeePayment(token, mining.feeRecipient, feeToMiner);
    // Burn
    await this.addFeePayment(token, burnAddress, minerBurn + walletBurn);

    // Calculate the total fee payment after possible discounts (burn rate rebate + fee waiving)
    let totalFeePaid = (feeToWallet + minerFee) + (minerBurn + walletBurn);

    // JS rounding errors...
    if (totalFeePaid > totalAmount + margin && totalFeePaid < totalAmount + margin + 10000) {
      totalFeePaid = totalAmount + margin;
    }
    assert(totalFeePaid <= totalAmount + margin, "Total fee paid cannot exceed the total fee amount");

    // Return the rebate this order got
    return (totalAmount + margin) - totalFeePaid;
  }

  private async addFeePayment(token: string,
                              to: string,
                              amount: number) {
    if (!token || !to || !amount) {
      return;
    }
    if (!this.feeBalances[token]) {
      this.feeBalances[token] = {};
    }
    if (!this.feeBalances[token][to]) {
      this.feeBalances[token][to] = 0;
    }
    this.feeBalances[token][to] += amount;
  }

  private resize(i: number, smallest: number) {
    let newSmallest = smallest;
    const j = (i + this.participations.length - 1) % this.participations.length;
    const p = this.participations[i];
    const prevP = this.participations[j];

    let postFeeFillAmountS = p.fillAmountS;
    if (p.order.tokenSFeePercentage > 0) {
      postFeeFillAmountS = Math.floor(p.fillAmountS *
        (this.context.feePercentageBase - p.order.tokenSFeePercentage) /
        this.context.feePercentageBase);
    }
    if (prevP.fillAmountB > postFeeFillAmountS) {
      newSmallest = i;
      prevP.fillAmountB = postFeeFillAmountS;
      prevP.fillAmountS = Math.floor(prevP.fillAmountB * prevP.order.amountS / prevP.order.amountB);
    }

    return newSmallest;
  }

  private calculatePreTradingPercentage(value: number, percentage: number, percentageBase: number) {
    assert(percentage < percentageBase);
    return Math.floor((value * percentageBase) / (percentageBase - percentage)) - value;
  }

  private async validateSettlement(transfers: TransferItem[]) {
    const expectedTotalBurned: { [id: string]: number; } = {};
    const ringSize = this.participations.length;
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const p = this.participations[i];
      const prevP = this.participations[prevIndex];

      console.log("order.spendableS:       " + p.ringSpendableS / 1e18);
      console.log("order.spendableFee:     " + p.ringSpendableFee / 1e18);
      console.log("order.amountS:          " + p.order.amountS / 1e18);
      console.log("order.amountB:          " + p.order.amountB / 1e18);
      console.log("order.feeAmount:        " + p.order.feeAmount / 1e18);
      console.log("order expected rate:    " + p.order.amountS / p.order.amountB);
      console.log("order.fillAmountS:      " + p.fillAmountS / 1e18);
      console.log("order.fillAmountB:      " + p.fillAmountB / 1e18);
      console.log("order.splitS:           " + p.splitS / 1e18);
      console.log("order actual rate:      " + (p.fillAmountS + p.splitS) / p.fillAmountB);
      console.log("p.feeAmount:            " + p.feeAmount / 1e18);
      console.log("p.feeAmountS:           " + p.feeAmountS / 1e18);
      console.log("p.feeAmountB:           " + p.feeAmountB / 1e18);
      console.log("p.rebateFee:            " + p.rebateFee / 1e18);
      console.log("p.rebateS:              " + p.rebateS / 1e18);
      console.log("p.rebateB:              " + p.rebateB / 1e18);
      console.log("tokenS percentage:      " + (p.order.P2P ? p.order.tokenSFeePercentage : 0) /
                                               this.context.feePercentageBase);
      console.log("tokenS real percentage: " + p.feeAmountS / p.order.amountS);
      console.log("tokenB percentage:      " +
        (p.order.P2P ? p.order.tokenBFeePercentage : p.order.feePercentage) / this.context.feePercentageBase);
      console.log("tokenB real percentage: " + p.feeAmountB / p.fillAmountB);
      console.log("----------------------------------------------");

      const epsilon = 1000;

      // Sanity checks
      assert(p.fillAmountS >= 0, "fillAmountS should be positive");
      assert(p.splitS >= 0, "splitS should be positive");
      assert(p.feeAmount >= 0, "feeAmount should be positive");
      assert(p.feeAmountS >= 0, "feeAmountS should be positive");
      assert(p.feeAmountB >= 0, "feeAmountB should be positive");
      assert(p.rebateFee >= 0, "rebateFee should be positive");
      assert(p.rebateS >= 0, "rebateFeeS should be positive");
      assert(p.rebateB >= 0, "rebateFeeB should be positive");

      // General fill requirements
      assert((p.fillAmountS + p.splitS) <= p.order.amountS, "fillAmountS + splitS <= amountS");
      assert(p.fillAmountB <= p.order.amountB + epsilon, "fillAmountB <= amountB");
      assert(p.feeAmount <= p.order.feeAmount, "fillAmountFee <= feeAmount");
      if (p.fillAmountS > 0 || p.fillAmountB > 0) {
        const orderRate = p.order.amountS / p.order.amountB;
        const rate = (p.fillAmountS + p.splitS) / p.fillAmountB;
        this.assertAlmostEqual(rate, orderRate, "fill rates need to match order rate");
      }
      assert(p.rebateFee <= p.feeAmount, "p.rebateFee <= p.feeAmount");
      assert(p.rebateS <= p.feeAmountS, "p.rebateS <= p.feeAmountS");
      assert(p.rebateB <= p.feeAmountB, "p.rebateB <= p.feeAmountB");

      // Miner/Taker gets all margin
      assert.equal(p.fillAmountS - p.feeAmountS, prevP.fillAmountB, "fillAmountS == prev.fillAmountB");

      // Spendable limitations
      {
        const totalAmountTokenS = p.fillAmountS + p.splitS;
        const totalAmountTokenFee = p.feeAmount;
        if (p.order.tokenS === p.order.feeToken) {
          assert(totalAmountTokenS + totalAmountTokenFee <= p.ringSpendableS + epsilon,
                 "totalAmountTokenS + totalAmountTokenFee <= spendableS");
        } else {
          assert(totalAmountTokenS <= p.ringSpendableS + epsilon, "totalAmountTokenS <= spendableS");
          assert(totalAmountTokenFee <= (p.ringSpendableFee ? p.ringSpendableFee : 0) + epsilon,
                 "totalAmountTokenFee <= spendableFee");
        }
      }

      // Ensure fees are calculated correctly
      if (p.order.P2P) {
        // Fee cannot be paid in tokenFee
        assert.equal(p.feeAmount, 0, "Cannot pay in tokenFee in a P2P order");
        // Check if fees were calculated correctly for the expected rate
        if (p.order.walletAddr) {
          // fees in tokenS
          {
            const rate = p.feeAmountS / p.fillAmountS;
            this.assertAlmostEqual(rate, p.order.tokenSFeePercentage,
                                   "tokenS fee rate needs to match given rate");
          }
          // fees in tokenB
          {
            const rate = p.feeAmountB / p.fillAmountB;
            this.assertAlmostEqual(rate, p.order.tokenBFeePercentage,
                                   "tokenB fee rate needs to match given rate");
          }
        } else {
          // No fees need to be paid when no wallet is given
          assert.equal(p.feeAmountS, p.rebateS, "No fees need to paid without wallet in a P2P order");
          assert.equal(p.feeAmountB, p.rebateB, "No fees need to paid without wallet in a P2P order");
        }
      } else {
        // Fee cannot be paid in tokenS
        assert.equal(p.feeAmountS, 0, "Cannot pay in tokenS");
        // Fees need to be paid either in feeToken OR tokenB, never both at the same time
        assert(!(p.feeAmount > 0 && p.feeAmountB > 0), "fees should be paid in tokenFee OR tokenB");

        const fee = Math.floor(p.order.feeAmount * (p.fillAmountS + p.splitS) / p.order.amountS);
        const feeB = Math.floor(p.fillAmountB * p.order.feePercentage / this.context.feePercentageBase);

        // Fee can be paid in tokenB when the owner doesn't have enought funds to pay in feeToken
        // or feeToken == tokenB
        if (p.order.feeToken === p.order.tokenB && p.fillAmountB >= fee) {
          this.assertAlmostEqual(p.feeAmountB, fee, "Fee should be paid in tokenB using feeAmount");
          assert.equal(p.feeAmount, 0, "Fee should not be paid in feeToken");
        } else if (fee > p.ringSpendableFee) {
          this.assertAlmostEqual(p.feeAmountB, feeB, "Fee should be paid in tokenB using feePercentage");
          assert.equal(p.feeAmount, 0, "Fee should not be paid in feeToken");
        } else {
          assert.equal(p.feeAmountB, 0, "Fee should not be paid in tokenB");
          this.assertAlmostEqual(p.feeAmount, fee, "Fee should be paid in feeToken using feeAmount");
        }
      }

      // Check rebates and burn rates
      const calculateBurnAndRebate = async (token: string, amount: number) => {
        const walletSplitPercentage = p.order.P2P ? 100 : p.order.walletSplitPercentage;
        const walletFee = Math.floor(amount * walletSplitPercentage / 100);
        const minerFeeBeforeWaive = amount - walletFee;
        const waiveFeePercentage = p.order.waiveFeePercentage < 0 ?
                                   this.context.feePercentageBase : p.order.waiveFeePercentage;
        const minerFee = Math.floor(minerFeeBeforeWaive *
                                    (this.context.feePercentageBase - waiveFeePercentage) /
                                    this.context.feePercentageBase);
        const minerRebate = minerFeeBeforeWaive - minerFee;
        const totalFee = walletFee + minerFee;
        const burnRateToken = (await this.context.burnRateTable.getBurnRate(token)).toNumber();
        const burnRate = p.order.P2P ? (burnRateToken >> 16) : (burnRateToken & 0xFFFF);
        const rebateRate = 0;
        const burnRebate = Math.floor(totalFee * rebateRate / this.context.feePercentageBase);
        const burn = Math.floor(totalFee * burnRate / this.context.feePercentageBase);
        return [burn, minerRebate + burnRebate];
      };
      const [expectedBurnFee, expectedRebateFee] = await calculateBurnAndRebate(p.order.feeToken, p.feeAmount);
      let [expectedBurnS, expectedRebateS] = await calculateBurnAndRebate(p.order.tokenS, p.feeAmountS);
      let [expectedBurnB, expectedRebateB] = await calculateBurnAndRebate(p.order.tokenB, p.feeAmountB);

      if (p.order.P2P && !p.order.walletAddr) {
        expectedRebateS = p.feeAmountS;
        expectedBurnS = 0;
        expectedRebateB = p.feeAmountB;
        expectedBurnB = 0;
      }

      this.assertAlmostEqual(p.rebateFee, expectedRebateFee, "Fee rebate should match expected value");
      this.assertAlmostEqual(p.rebateS, expectedRebateS, "FeeS rebate should match expected value");
      this.assertAlmostEqual(p.rebateB, expectedRebateB, "FeeB rebate should match expected value");

      // Add burn rates to total expected burn rates
      if (!expectedTotalBurned[p.order.feeToken]) {
        expectedTotalBurned[p.order.feeToken] = 0;
      }
      expectedTotalBurned[p.order.feeToken] += expectedBurnFee;
      if (!expectedTotalBurned[p.order.tokenS]) {
        expectedTotalBurned[p.order.tokenS] = 0;
      }
      expectedTotalBurned[p.order.tokenS] += expectedBurnS;
      if (!expectedTotalBurned[p.order.tokenB]) {
        expectedTotalBurned[p.order.tokenB] = 0;
      }
      expectedTotalBurned[p.order.tokenB] += expectedBurnB;

      // Ensure fees in tokenB can be paid with the amount bought
      assert(prevP.feeAmountB <= p.fillAmountS + epsilon,
             "Can't pay more in tokenB fees than what was bought");
    }

    // Ensure balances are updated correctly
    // Simulate the token transfers in the ring
    const balances: { [id: string]: any; } = {};
    for (const transfer of transfers) {
      if (!balances[transfer.token]) {
        balances[transfer.token] = {};
      }
      if (!balances[transfer.token][transfer.from]) {
        balances[transfer.token][transfer.from] = 0;
      }
      if (!balances[transfer.token][transfer.to]) {
        balances[transfer.token][transfer.to] = 0;
      }
      balances[transfer.token][transfer.from] -= transfer.amount;
      balances[transfer.token][transfer.to] += transfer.amount;
    }
    // Accumulate owner balances and accumulate fees
    const expectedBalances: { [id: string]: any; } = {};
    const expectedFeeHolderBalances: { [id: string]: number; } = {};
    for (let i = 0; i < ringSize; i++) {
      const p = this.participations[i];
      const nextP = this.participations[(i + 1) % ringSize];
      // Owner balances
      const expectedBalanceS = -(p.fillAmountS - p.rebateS + p.splitS);
      const expectedBalanceB = p.fillAmountB - (p.feeAmountB - p.rebateB);
      const expectedBalanceFeeToken = -(p.feeAmount - p.rebateFee);

      // Accumulate balances
      if (!expectedBalances[p.order.owner]) {
        expectedBalances[p.order.owner] = {};
      }
      if (!expectedBalances[p.order.tokenRecipient]) {
        expectedBalances[p.order.tokenRecipient] = {};
      }
      if (!expectedBalances[p.order.owner][p.order.tokenS]) {
        expectedBalances[p.order.owner][p.order.tokenS] = 0;
      }
      if (!expectedBalances[p.order.tokenRecipient][p.order.tokenB]) {
        expectedBalances[p.order.tokenRecipient][p.order.tokenB] = 0;
      }
      if (!expectedBalances[p.order.owner][p.order.feeToken]) {
        expectedBalances[p.order.owner][p.order.feeToken] = 0;
      }
      expectedBalances[p.order.owner][p.order.tokenS] += expectedBalanceS;
      expectedBalances[p.order.tokenRecipient][p.order.tokenB] += expectedBalanceB;
      expectedBalances[p.order.owner][p.order.feeToken] += expectedBalanceFeeToken;

      // Accumulate fees
      if (!expectedFeeHolderBalances[p.order.tokenS]) {
        expectedFeeHolderBalances[p.order.tokenS] = 0;
      }
      if (!expectedFeeHolderBalances[p.order.tokenB]) {
        expectedFeeHolderBalances[p.order.tokenB] = 0;
      }
      if (!expectedFeeHolderBalances[p.order.feeToken]) {
        expectedFeeHolderBalances[p.order.feeToken] = 0;
      }
      expectedFeeHolderBalances[p.order.tokenS] += p.feeAmountS - p.rebateS + p.splitS;
      expectedFeeHolderBalances[p.order.tokenB] += p.feeAmountB - p.rebateB;
      expectedFeeHolderBalances[p.order.feeToken] += p.feeAmount - p.rebateFee;
    }
    // Check balances of all owners
    for (let i = 0; i < ringSize; i++) {
      const p = this.participations[i];
      const balanceS = (balances[p.order.tokenS] && balances[p.order.tokenS][p.order.owner])
                      ? balances[p.order.tokenS][p.order.owner] : 0;
      const balanceB = (balances[p.order.tokenB] && balances[p.order.tokenB][p.order.tokenRecipient])
                      ? balances[p.order.tokenB][p.order.tokenRecipient] : 0;
      const balanceFeeToken = (balances[p.order.feeToken] && balances[p.order.feeToken][p.order.owner])
                             ? balances[p.order.feeToken][p.order.owner] : 0;
      this.assertAlmostEqual(balanceS, expectedBalances[p.order.owner][p.order.tokenS],
                             "Order owner tokenS balance should match expected value");
      this.assertAlmostEqual(balanceB, expectedBalances[p.order.tokenRecipient][p.order.tokenB],
                             "Order tokenRecipient tokenB balance should match expected value");
      this.assertAlmostEqual(balanceFeeToken, expectedBalances[p.order.owner][p.order.feeToken],
                             "Order owner feeToken balance should match expected value");
    }
    // Check fee holder balances of all possible tokens used to pay fees
    for (const token of [...Object.keys(expectedFeeHolderBalances), ...Object.keys(balances)]) {
      const feeAddress = this.context.feeHolder.address;
      const expectedBalance = expectedFeeHolderBalances[token] ? expectedFeeHolderBalances[token] : 0;
      const balance = (balances[token] && balances[token][feeAddress]) ? balances[token][feeAddress] : 0;
      this.assertAlmostEqual(balance, expectedBalance,
                             "FeeHolder balance after transfers should match expected value");
    }

    // Ensure total fee payments match transferred amounts to feeHolder contract
    {
      for (const token of [...Object.keys(this.feeBalances), ...Object.keys(balances)]) {
        const feeAddress = this.context.feeHolder.address;
        let totalFee = 0;
        if (this.feeBalances[token]) {
          for (const owner of Object.keys(this.feeBalances[token])) {
            totalFee += this.feeBalances[token][owner];
          }
        }
        let feeHolderBalance = 0;
        if (balances[token] && balances[token][feeAddress]) {
          feeHolderBalance = balances[token][feeAddress];
        }
        this.assertAlmostEqual(totalFee, feeHolderBalance,
                               "Total fees amount in feeHolder should match total amount transferred");
      }
    }

    // Ensure total burn payments match expected total burned
    for (const token of [...Object.keys(expectedTotalBurned), ...Object.keys(this.feeBalances)]) {
      const feeAddress = this.context.feeHolder.address;
      let burned = 0;
      let expected = 0;
      if (this.feeBalances[token] && this.feeBalances[token][feeAddress]) {
        burned = this.feeBalances[token][feeAddress];
      }
      if (expectedTotalBurned[token]) {
        expected = expectedTotalBurned[token];
      }
      this.assertAlmostEqual(burned, expected, "Total burned should match expected value");
    }
  }

  private assertAlmostEqual(n1: number, n2: number, description: string, precision: number = 8) {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);
    return assert.equal(Number(numStr1), Number(numStr2), description);
  }

  private logPayment(parent: DetailedTokenTransfer,
                     token: string,
                     from: string,
                     to: string,
                     amount: number,
                     description: string = "NA") {
    const payment: DetailedTokenTransfer = {
      description,
      token,
      from,
      to,
      amount,
      subPayments: [],
    };
    parent.subPayments.push(payment);
    return payment;
  }
}
