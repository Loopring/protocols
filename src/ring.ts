import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { DetailedTokenTransfer, OrderInfo, OrderPayments, RingPayments, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
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
    this.orders = orders;
    this.valid = true;
    this.minerFeesToOrdersPercentage = 0;
    this.orderUtil = new OrderUtil(context);

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
    for (const order of this.orders) {
      orderHashes.addHex(order.hash.toString("hex"));
      orderHashes.addNumber(order.waiveFeePercentage ? order.waiveFeePercentage : 0, 2);
    }
    this.hash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
  }

  public checkOrdersValid() {
    this.valid = this.valid && ensure(this.orders.length > 1 && this.orders.length <= 8, "invald ring size");
    for (const order of this.orders) {
      this.valid = this.valid && ensure(order.valid, "ring contains invalid order");
    }
  }

  public checkForSubRings() {
    for (let i = 0; i < this.orders.length - 1; i++) {
      const tokenS = this.orders[i].tokenS;
      for (let j = i + 1; j < this.orders.length; j++) {
        this.valid = this.valid && ensure(tokenS !== this.orders[j].tokenS, "ring has sub-rings");
      }
    }
  }

  public async calculateFillAmountAndFee() {
    // Invalid order data could cause a divide by zero in the calculations
    if (!this.valid) {
      return;
    }

    for (const order of this.orders) {
      await this.setMaxFillAmounts(order);
    }

    let smallest = 0;
    const ringSize = this.orders.length;

    for (let i = ringSize - 1; i >= 0; i--) {
      smallest = this.resize(i, smallest);
    }

    for (let i = ringSize - 1; i >= smallest; i--) {
      this.resize(i, smallest);
    }

    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const prevOrder = this.orders[prevIndex];
      const order = this.orders[i];

      // Check if this order needs to be completely filled
      if (order.allOrNone && order.fillAmountB !== order.amountB) {
        this.valid = ensure(false, "order needs to be filled completely");
        break;
      }

      const valid = await this.calculateFees(order, prevOrder);
      this.valid = ensure(valid, "ring cannot be settled");
      if (order.waiveFeePercentage < 0) {
        this.minerFeesToOrdersPercentage += -order.waiveFeePercentage;
      }
    }
    this.valid = this.valid && ensure(this.minerFeesToOrdersPercentage <= this.context.feePercentageBase,
                                      "miner distributes more than 100% of its fees to order owners");

    // Ring calculations are done. Make sure te remove all reservations for this ring
    for (const order of this.orders) {
      this.orderUtil.resetReservations(order);
    }
  }

  public async setMaxFillAmounts(order: OrderInfo) {
    const remainingS = order.amountS - order.filledAmountS;
    order.ringSpendableS = await this.orderUtil.getSpendableS(order);
    order.fillAmountS = Math.min(order.ringSpendableS, remainingS);
    order.fillAmountB = Math.floor(order.fillAmountS * order.amountB / order.amountS);
  }

  public async calculateFees(order: OrderInfo, prevOrder: OrderInfo) {
    // Reserve the total amount tokenS used for the order, it may be used to pay fees
    // for this order or even another order with the same owner
    await this.orderUtil.reserveAmountS(order, order.fillAmountS);

    if (order.P2P) {
      // Calculate P2P fees
      order.fillAmountFee = 0;
      if (order.walletAddr) {
        order.fillAmountFeeS = Math.floor(order.fillAmountS * order.tokenSFeePercentage /
                               this.context.feePercentageBase);
        order.fillAmountFeeB = Math.floor(order.fillAmountB * order.tokenBFeePercentage /
                               this.context.feePercentageBase);
      } else {
        order.fillAmountFeeS = 0;
        order.fillAmountFeeB = 0;
      }
    } else {
      // Calculate matching fees
      order.fillAmountFee = Math.floor(order.feeAmount * order.fillAmountS / order.amountS);
      order.fillAmountFeeS = 0;
      order.fillAmountFeeB = 0;

      // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
      // If nextOrder.feeToken == nextOrder.tokenB and the order doesn't have the necessary tokenB amount
      // we use feePercentage instead, which should give similar results if the data is set correctly
      // in the order
      order.ringSpendableFee = await this.orderUtil.getSpendableFee(order);
      if (order.fillAmountFee > order.ringSpendableFee) {
          order.fillAmountFeeB += Math.floor(order.fillAmountB * order.feePercentage / this.context.feePercentageBase);
          order.fillAmountFee = 0;
      } else {
        await this.orderUtil.reserveAmountFee(order, order.fillAmountFee);
      }
    }

    if (order.fillAmountS - order.fillAmountFeeS >= prevOrder.fillAmountB) {
      // The miner (or in a P2P case, the taker) gets the margin
      order.splitS = (order.fillAmountS - order.fillAmountFeeS) - prevOrder.fillAmountB;
      order.fillAmountS = prevOrder.fillAmountB + order.fillAmountFeeS;
      return true;
    } else {
      return false;
    }
  }

  public adjustOrderState(order: OrderInfo) {
    // Update filled amount
    order.filledAmountS += order.fillAmountS + order.splitS;

    // Update spendables
    const totalAmountS = order.fillAmountS;
    const totalAmountFee = order.fillAmountFee;
    order.tokenSpendableS.amount -= totalAmountS;
    order.tokenSpendableFee.amount -= totalAmountFee;
    if (order.brokerInterceptor) {
      order.brokerSpendableS.amount -= totalAmountS;
      order.brokerSpendableFee.amount -= totalAmountFee;
    }
    // Checks
    assert(order.tokenSpendableS.amount >= 0, "spendableS should be positive");
    assert(order.tokenSpendableFee.amount >= 0, "spendableFee should be positive");
    assert(order.filledAmountS <= order.amountS, "filledAmountS <= amountS");
  }

  public async getRingTransferItems(mining: Mining, feeBalances: { [id: string]: any; }) {
    if (!this.valid) {
      return [];
    }

    await this.payFees(mining);
    const transferItems = await this.transferTokens();

    // Validate how the ring is settled
    await this.validateSettlement(transferItems);

    // Adjust orders
    for (const order of this.orders) {
      this.adjustOrderState(order);
    }

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
    const ringSize = this.orders.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const order = this.orders[i];
      const prevOrder = this.orders[prevIndex];
      const feeHolder = this.context.feeHolder.address;

      // If the buyer needs to pay fees in a percentage of tokenB, the seller needs
      // to send that amount of tokenS to the fee holder contract.
      const amountSToBuyer = order.fillAmountS - order.fillAmountFeeS -
                             (prevOrder.fillAmountFeeB - prevOrder.rebateB);
      let amountSToFeeHolder = (order.fillAmountFeeS - order.rebateS) +
                               (prevOrder.fillAmountFeeB - prevOrder.rebateB) +
                               order.splitS;
      let amountFeeToFeeHolder = order.fillAmountFee - order.rebateFee;
      if (order.tokenS === order.feeToken) {
        amountSToFeeHolder += amountFeeToFeeHolder;
        amountFeeToFeeHolder = 0;
      }

      this.addTokenTransfer(transferItems, order.tokenS, order.owner, prevOrder.tokenRecipient, amountSToBuyer);
      this.addTokenTransfer(transferItems, order.tokenS, order.owner, feeHolder, amountSToFeeHolder);
      this.addTokenTransfer(transferItems, order.feeToken, order.owner, feeHolder, amountFeeToFeeHolder);

      // BEGIN diagnostics
      this.detailTransferS[i].amount = order.fillAmountS + order.splitS;
      this.logPayment(this.detailTransferS[i], order.tokenS, order.owner, prevOrder.tokenRecipient,
                      order.fillAmountS - order.fillAmountFeeS, "ToBuyer");
      this.detailTransferB[i].amount = order.fillAmountB;
      this.detailTransferFee[i].amount = order.fillAmountFee;
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
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const order = this.orders[i];

      const walletPercentage = order.P2P ? 100 :
                               (order.walletAddr ? order.walletSplitPercentage : 0);

      // Save these fee amounts before any discount the order gets for validation
      const feePercentageB = order.P2P ? order.tokenBFeePercentage : order.feePercentage;

      order.rebateFee = await this.payFeesAndBurn(mining,
                                                  order,
                                                  order.feeToken,
                                                  order.fillAmountFee,
                                                  0,
                                                  walletPercentage,
                                                  this.detailTransferFee[i]);
      order.rebateS = await this.payFeesAndBurn(mining,
                                                order,
                                                order.tokenS,
                                                order.fillAmountFeeS,
                                                order.splitS,
                                                walletPercentage,
                                                this.detailTransferS[i],
                                                order.tokenSFeePercentage);
      order.rebateB = await this.payFeesAndBurn(mining,
                                                order,
                                                order.tokenB,
                                                order.fillAmountFeeB,
                                                0,
                                                walletPercentage,
                                                this.detailTransferB[i],
                                                feePercentageB);
    }
  }

  private async payFeesAndBurn(mining: Mining,
                               order: OrderInfo,
                               token: string,
                               amount: number,
                               margin: number,
                               walletSplitPercentage: number,
                               payment: DetailedTokenTransfer,
                               feePercentage: number = 0) {
    if (amount + margin === 0) {
      return 0;
    }
    if (order.P2P && !order.walletAddr) {
      assert.equal(amount, 0, "In a P2P order no fees should be paid when no wallet is provided");
    }

    // Pay the burn rate with the feeHolder as owner
    const burnAddress = this.context.feeHolder.address;

    // BEGIN diagnostics
    const feeDesc = "Fee" + ((feePercentage > 0) ? ("@" + (feePercentage / 10)) + "%" : "");
    const totalPayment = this.logPayment(payment, token, order.owner, "NA", amount + margin, feeDesc + "+Margin");
    const marginPayment = this.logPayment(totalPayment, token, order.owner, mining.feeRecipient, margin, "Margin");
    const feePayment = this.logPayment(totalPayment, token, order.owner, "NA", amount, feeDesc);
    // END diagnostics

    const walletFee = Math.floor(amount * walletSplitPercentage / 100);
    let minerFee = amount - walletFee;

    // BEGIN diagnostics
    const walletPayment = this.logPayment(
      feePayment, token, order.owner, "NA", walletFee, "Wallet@" + walletSplitPercentage + "%");
    let minerPayment = this.logPayment(
      feePayment, token, order.owner, "NA", minerFee, "Miner@" + (100 - walletSplitPercentage) + "%");
    // END diagnostics

    // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
    if (order.waiveFeePercentage > 0) {
      minerFee = Math.floor(minerFee *
                            (this.context.feePercentageBase - order.waiveFeePercentage) /
                            this.context.feePercentageBase);

      // BEGIN diagnostics
      minerPayment = this.logPayment(
        minerPayment, token, order.owner, "NA", minerFee, "Waive@" + order.waiveFeePercentage / 10 + "%");
      // END diagnostics
    } else if (order.waiveFeePercentage < 0) {
      // No fees need to be paid to the miner by this order
      minerFee = 0;

      // BEGIN diagnostics
      minerPayment = this.logPayment(
        minerPayment, token, order.owner, "NA", minerFee, "Waive@" + order.waiveFeePercentage / 10 + "%");
      // END diagnostics
    }

    // Calculate burn rates and rebates
    const [burnRate, rebateRate] =
    await this.context.burnRateTable.getBurnAndRebateRate(order.owner, token, order.P2P);
    // Miner fee
    const minerBurn = Math.floor(minerFee * burnRate.toNumber() / this.context.feePercentageBase);
    const minerRebate = Math.floor(minerFee * rebateRate.toNumber() / this.context.feePercentageBase);
    minerFee = margin + (minerFee - minerBurn - minerRebate);
    // Wallet fee
    const walletBurn = Math.floor(walletFee * burnRate.toNumber() / this.context.feePercentageBase);
    const walletRebate = Math.floor(walletFee * rebateRate.toNumber() / this.context.feePercentageBase);
    const feeToWallet = walletFee - walletBurn - walletRebate;

    // BEGIN diagnostics
    this.logPayment(minerPayment, token, order.owner, burnAddress, minerBurn, "Burn@" + burnRate / 10 + "%");
    this.logPayment(minerPayment, token, order.owner, order.owner, minerRebate, "Rebate@" + rebateRate / 10 + "%");
    const minerIncomePayment =
      this.logPayment(minerPayment, token, order.owner, mining.feeRecipient, minerFee - margin, "Income");
    this.logPayment(walletPayment, token, order.owner, burnAddress, walletBurn, "Burn@" + burnRate / 10 + "%");
    this.logPayment(walletPayment, token, order.owner, order.owner, walletRebate, "Rebate@" + rebateRate / 10 + "%");
    this.logPayment(walletPayment, token, order.owner, order.walletAddr, feeToWallet, "Income");
    // END diagnostics

    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    let feeToMiner = minerFee;
    if (this.minerFeesToOrdersPercentage > 0 && minerFee > 0) {
      // Pay out the fees to the orders
      for (const otherOrder of this.orders) {
        if (otherOrder.waiveFeePercentage < 0) {
          const feeToOwner = Math.floor(minerFee * (-otherOrder.waiveFeePercentage) / this.context.feePercentageBase);
          await this.addFeePayment(token, otherOrder.owner, feeToOwner);

          // BEGIN diagnostics
          this.logPayment(minerIncomePayment, token, order.owner, otherOrder.owner, feeToOwner,
            "Share_Income+Margin@" + (-otherOrder.waiveFeePercentage) / 10 + "%");
          // END diagnostics
        }
      }
      // Subtract all fees the miner pays to the orders
      feeToMiner = Math.floor(minerFee * (this.context.feePercentageBase - this.minerFeesToOrdersPercentage) /
      this.context.feePercentageBase);
    }

    // Do the fee payments
    await this.addFeePayment(token, order.walletAddr, feeToWallet);
    await this.addFeePayment(token, mining.feeRecipient, feeToMiner);
    // Burn
    await this.addFeePayment(token, burnAddress, minerBurn + walletBurn);

    // Calculate the total fee payment after possible discounts (burn rate rebate + fee waiving)
    let totalFeePaid = (feeToWallet + minerFee) + (minerBurn + walletBurn);

    // JS rounding errors...
    if (totalFeePaid > amount + margin && totalFeePaid < amount + margin + 10000) {
      totalFeePaid = amount + margin;
    }
    assert(totalFeePaid <= amount + margin, "Total fee paid cannot exceed the total fee amount");

    // Return the rebate this order got
    return (amount + margin) - totalFeePaid;
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
    const j = (i + this.orders.length - 1) % this.orders.length;
    const order = this.orders[i];
    const prevOrder = this.orders[j];

    let postFeeFillAmountS = order.fillAmountS;
    if (order.tokenSFeePercentage > 0) {
      postFeeFillAmountS = Math.floor(order.fillAmountS *
        (this.context.feePercentageBase - order.tokenSFeePercentage) /
        this.context.feePercentageBase);
    }
    if (prevOrder.fillAmountB > postFeeFillAmountS) {
      newSmallest = i;
      prevOrder.fillAmountB = postFeeFillAmountS;
      prevOrder.fillAmountS = Math.floor(prevOrder.fillAmountB * prevOrder.amountS / prevOrder.amountB);
    }

    return newSmallest;
  }

  private calculatePreTradingPercentage(value: number, percentage: number, percentageBase: number) {
    assert(percentage < percentageBase);
    return Math.floor((value * percentageBase) / (percentageBase - percentage)) - value;
  }

  private async validateSettlement(transfers: TransferItem[]) {
    const expectedTotalBurned: { [id: string]: number; } = {};
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const order = this.orders[i];
      const prevOrder = this.orders[prevIndex];

      console.log("order.spendableS:       " + order.ringSpendableS / 1e18);
      console.log("order.spendableFee:     " + order.ringSpendableFee / 1e18);
      console.log("order.amountS:          " + order.amountS / 1e18);
      console.log("order.amountB:          " + order.amountB / 1e18);
      console.log("order.feeAmount:        " + order.feeAmount / 1e18);
      console.log("order expected rate:    " + order.amountS / order.amountB);
      console.log("order.fillAmountS:      " + order.fillAmountS / 1e18);
      console.log("order.fillAmountB:      " + order.fillAmountB / 1e18);
      console.log("order.splitS:           " + order.splitS / 1e18);
      console.log("order actual rate:      " + (order.fillAmountS + order.splitS) / order.fillAmountB);
      console.log("order.fillAmountFee:    " + order.fillAmountFee / 1e18);
      console.log("order.fillAmountFeeS:   " + order.fillAmountFeeS / 1e18);
      console.log("order.fillAmountFeeB:   " + order.fillAmountFeeB / 1e18);
      console.log("order.rebateFee:        " + order.rebateFee / 1e18);
      console.log("order.rebateS:          " + order.rebateS / 1e18);
      console.log("order.rebateB:          " + order.rebateB / 1e18);
      console.log("tokenS percentage:      " + (order.P2P ? order.tokenSFeePercentage : 0) /
                                               this.context.feePercentageBase);
      console.log("tokenS real percentage: " + order.fillAmountFeeS / order.amountS);
      console.log("tokenB percentage:      " +
        (order.P2P ? order.tokenBFeePercentage : order.feePercentage) / this.context.feePercentageBase);
      console.log("tokenB real percentage: " + order.fillAmountFeeB / order.fillAmountB);
      console.log("----------------------------------------------");

      const epsilon = 1000;

      // Sanity checks
      assert(order.fillAmountS >= 0, "fillAmountS should be positive");
      assert(order.splitS >= 0, "splitS should be positive");
      assert(order.fillAmountFee >= 0, "fillAmountFee should be positive");
      assert(order.fillAmountFeeS >= 0, "fillAmountFeeS should be positive");
      assert(order.fillAmountFeeB >= 0, "fillAmountFeeB should be positive");
      assert(order.rebateFee >= 0, "rebateFee should be positive");
      assert(order.rebateS >= 0, "rebateFeeS should be positive");
      assert(order.rebateB >= 0, "rebateFeeB should be positive");

      // General fill requirements
      assert((order.fillAmountS + order.splitS) <= order.amountS, "fillAmountS + splitS <= amountS");
      assert(order.fillAmountB <= order.amountB + epsilon, "fillAmountB <= amountB");
      assert(order.fillAmountFee <= order.feeAmount, "fillAmountFee <= feeAmount");
      if (order.fillAmountS > 0 || order.fillAmountB > 0) {
        const orderRate = order.amountS / order.amountB;
        const rate = (order.fillAmountS + order.splitS) / order.fillAmountB;
        this.assertNumberEqualsWithPrecision(rate, orderRate, "fill rates need to match order rate");
      }
      assert(order.rebateFee <= order.fillAmountFee, "order.rebateFee <= order.fillAmountFee");
      assert(order.rebateS <= order.fillAmountFeeS, "order.rebateS <= order.fillAmountFeeS");
      assert(order.rebateB <= order.fillAmountFeeB, "order.rebateB <= order.fillAmountFeeB");

      // Miner/Taker gets all margin
      assert.equal(order.fillAmountS - order.fillAmountFeeS, prevOrder.fillAmountB, "fillAmountS == prev.fillAmountB");

      // Spendable limitations
      {
        const totalAmountTokenS = order.fillAmountS + order.splitS;
        const totalAmountTokenFee = order.fillAmountFee;
        if (order.tokenS === order.feeToken) {
          assert(totalAmountTokenS + totalAmountTokenFee <= order.ringSpendableS + epsilon,
                 "totalAmountTokenS + totalAmountTokenFee <= spendableS");
        } else {
          assert(totalAmountTokenS <= order.ringSpendableS + epsilon, "totalAmountTokenS <= spendableS");
          assert(totalAmountTokenFee <= (order.ringSpendableFee ? order.ringSpendableFee : 0) + epsilon,
                 "totalAmountTokenFee <= spendableFee");
        }
      }

      // Ensure fees are calculated correctly
      if (order.P2P) {
        // Fee cannot be paid in tokenFee
        assert.equal(order.fillAmountFee, 0, "Cannot pay in tokenFee in a P2P order");
        // Check if fees were calculated correctly for the expected rate
        if (order.walletAddr) {
          // fees in tokenS
          {
            const rate = order.fillAmountFeeS / order.fillAmountS;
            this.assertNumberEqualsWithPrecision(rate, order.tokenSFeePercentage,
                                                 "tokenS fee rate needs to match given rate");
          }
          // fees in tokenB
          {
            const rate = order.fillAmountFeeB / order.fillAmountB;
            this.assertNumberEqualsWithPrecision(rate, order.tokenBFeePercentage,
                                                 "tokenB fee rate needs to match given rate");
          }
        } else {
          // No fees need to be paid when no wallet is given
          assert.equal(order.fillAmountFeeS, 0, "No fees need to paid without wallet in a P2P order");
          assert.equal(order.fillAmountFeeB, 0, "No fees need to paid without wallet in a P2P order");
        }
      } else {
        // Fee cannot be paid in tokenS
        assert.equal(order.fillAmountFeeS, 0, "Cannot pay in tokenS");
        // Fees need to be paid either in feeToken OR tokenB, never both at the same time
        assert(!(order.fillAmountFee > 0 && order.fillAmountFeeB > 0), "fees should be paid in tokenFee OR tokenB");

        // Fees can only be paid in tokenB when the owner doesn't have enought funds to pay in feeToken
        if (order.fillAmountFeeB > 0) {
          const fee = Math.floor(order.feeAmount * (order.fillAmountS + order.splitS) / order.amountS);
          assert(fee > order.ringSpendableFee, "fees should be paid in tokenFee if possible");
        }
      }

      // Check rebates and burn rates
      const calculateBurnAndRebate = async (token: string, amount: number) => {
        const walletSplitPercentage = order.P2P ? 100 : order.walletSplitPercentage;
        const walletFee = Math.floor(amount * walletSplitPercentage / 100);
        const minerFeeBeforeWaive = amount - walletFee;
        const waiveFeePercentage = order.waiveFeePercentage < 0 ?
                                   this.context.feePercentageBase : order.waiveFeePercentage;
        const minerFee = Math.floor(minerFeeBeforeWaive *
                                    (this.context.feePercentageBase - waiveFeePercentage) /
                                    this.context.feePercentageBase);
        const minerRebate = minerFeeBeforeWaive - minerFee;
        const totalFee = walletFee + minerFee;
        const [burnRate, rebateRate] =
        await this.context.burnRateTable.getBurnAndRebateRate(order.owner, token, order.P2P);
        const burnRebate = Math.floor(totalFee * rebateRate.toNumber() / this.context.feePercentageBase);
        const burn = Math.floor(totalFee * burnRate.toNumber() / this.context.feePercentageBase);
        return [burn, minerRebate + burnRebate];
      };
      const [expectedBurnFee, expectedRebateFee] = await calculateBurnAndRebate(order.feeToken, order.fillAmountFee);
      const [expectedBurnS, expectedRebateS] = await calculateBurnAndRebate(order.tokenS, order.fillAmountFeeS);
      const [expectedBurnB, expectedRebateB] = await calculateBurnAndRebate(order.tokenB, order.fillAmountFeeB);
      this.assertNumberEqualsWithPrecision(order.rebateFee, expectedRebateFee,
                                           "Fee rebate should match expected value");
      this.assertNumberEqualsWithPrecision(order.rebateS, expectedRebateS,
                                           "FeeS rebate should match expected value");
      this.assertNumberEqualsWithPrecision(order.rebateB, expectedRebateB,
                                           "FeeB rebate should match expected value");

      // Add burn rates to total expected burn rates
      if (!expectedTotalBurned[order.feeToken]) {
        expectedTotalBurned[order.feeToken] = 0;
      }
      expectedTotalBurned[order.feeToken] += expectedBurnFee;
      if (!expectedTotalBurned[order.tokenS]) {
        expectedTotalBurned[order.tokenS] = 0;
      }
      expectedTotalBurned[order.tokenS] += expectedBurnS;
      if (!expectedTotalBurned[order.tokenB]) {
        expectedTotalBurned[order.tokenB] = 0;
      }
      expectedTotalBurned[order.tokenB] += expectedBurnB;

      // Ensure fees in tokenB can be paid with the amount bought
      assert(prevOrder.fillAmountFeeB <= order.fillAmountS + epsilon,
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
      const order = this.orders[i];
      const nextOrder = this.orders[(i + 1) % ringSize];
      // Owner balances
      const expectedBalanceS = -(order.fillAmountS - order.rebateS + order.splitS);
      const expectedBalanceB = order.fillAmountB - (order.fillAmountFeeB - order.rebateB);
      const expectedBalanceFeeToken = -(order.fillAmountFee - order.rebateFee);

      // Accumulate balances
      if (!expectedBalances[order.owner]) {
        expectedBalances[order.owner] = {};
      }
      if (!expectedBalances[order.tokenRecipient]) {
        expectedBalances[order.tokenRecipient] = {};
      }
      if (!expectedBalances[order.owner][order.tokenS]) {
        expectedBalances[order.owner][order.tokenS] = 0;
      }
      if (!expectedBalances[order.tokenRecipient][order.tokenB]) {
        expectedBalances[order.tokenRecipient][order.tokenB] = 0;
      }
      if (!expectedBalances[order.owner][order.feeToken]) {
        expectedBalances[order.owner][order.feeToken] = 0;
      }
      expectedBalances[order.owner][order.tokenS] += expectedBalanceS;
      expectedBalances[order.tokenRecipient][order.tokenB] += expectedBalanceB;
      expectedBalances[order.owner][order.feeToken] += expectedBalanceFeeToken;

      // Accumulate fees
      if (!expectedFeeHolderBalances[order.tokenS]) {
        expectedFeeHolderBalances[order.tokenS] = 0;
      }
      if (!expectedFeeHolderBalances[order.tokenB]) {
        expectedFeeHolderBalances[order.tokenB] = 0;
      }
      if (!expectedFeeHolderBalances[order.feeToken]) {
        expectedFeeHolderBalances[order.feeToken] = 0;
      }
      expectedFeeHolderBalances[order.tokenS] += order.fillAmountFeeS - order.rebateS + order.splitS;
      expectedFeeHolderBalances[order.tokenB] += order.fillAmountFeeB - order.rebateB;
      expectedFeeHolderBalances[order.feeToken] += order.fillAmountFee - order.rebateFee;
    }
    // Check balances of all owners
    for (let i = 0; i < ringSize; i++) {
      const order = this.orders[i];
      const balanceS = (balances[order.tokenS] && balances[order.tokenS][order.owner])
                      ? balances[order.tokenS][order.owner] : 0;
      const balanceB = (balances[order.tokenB] && balances[order.tokenB][order.tokenRecipient])
                      ? balances[order.tokenB][order.tokenRecipient] : 0;
      const balanceFeeToken = (balances[order.feeToken] && balances[order.feeToken][order.owner])
                             ? balances[order.feeToken][order.owner] : 0;
      this.assertNumberEqualsWithPrecision(balanceS, expectedBalances[order.owner][order.tokenS],
                                           "Order owner tokenS balance should match expected value");
      this.assertNumberEqualsWithPrecision(balanceB, expectedBalances[order.tokenRecipient][order.tokenB],
                                           "Order tokenRecipient tokenB balance should match expected value");
      this.assertNumberEqualsWithPrecision(balanceFeeToken, expectedBalances[order.owner][order.feeToken],
                                           "Order owner feeToken balance should match expected value");
    }
    // Check fee holder balances of all possible tokens used to pay fees
    for (const token of [...Object.keys(expectedFeeHolderBalances), ...Object.keys(balances)]) {
      const feeAddress = this.context.feeHolder.address;
      const expectedBalance = expectedFeeHolderBalances[token] ? expectedFeeHolderBalances[token] : 0;
      const balance = (balances[token] && balances[token][feeAddress]) ? balances[token][feeAddress] : 0;
      this.assertNumberEqualsWithPrecision(balance, expectedBalance,
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
        this.assertNumberEqualsWithPrecision(totalFee, feeHolderBalance,
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
      this.assertNumberEqualsWithPrecision(burned, expected, "Total burned should match expected value");
    }
  }

  private assertNumberEqualsWithPrecision(n1: number, n2: number, description: string, precision: number = 8) {
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
