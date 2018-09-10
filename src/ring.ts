import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { DetailedTokenTransfer, OrderInfo, OrderPayments, RingPayments, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
  public owner: string;
  public feeRecipient: string;
  public hash?: Buffer;
  public minerFeesToOrdersPercentage?: number;
  public valid: boolean;

  public payments: RingPayments;

  private context: Context;
  private orderUtil: OrderUtil;

  private feeBalances: { [id: string]: any; } = {};

  private tokenPayments: Array<{ [id: string]: DetailedTokenTransfer; }> = [];

  constructor(context: Context,
              orders: OrderInfo[],
              owner: string,
              feeRecipient: string,
              ) {
    this.context = context;
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;
    this.valid = true;
    this.minerFeesToOrdersPercentage = 0;

    this.payments = {
      orders: [],
    };
    for (const order of orders) {
      this.payments.orders.push({
        payments: [],
      });
      this.tokenPayments.push({});
    }

    this.orderUtil = new OrderUtil(context);
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

  public async checkTokensRegistered() {
    const tokens: string[] = [];
    for (const order of this.orders) {
      tokens.push(order.tokenS);
    }
    const tokensRegistered = await this.context.tokenRegistry.areAllTokensRegistered(tokens);
    this.valid = this.valid && ensure(tokensRegistered, "ring uses unregistered tokens");
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

      if (order.fillAmountS >= prevOrder.fillAmountB) {
        await this.calculateFeesAndTaxes(order, prevOrder);
        if (order.waiveFeePercentage < 0) {
          this.minerFeesToOrdersPercentage += -order.waiveFeePercentage;
        }
      } else {
        this.valid = ensure(false, "ring cannot be settled");
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
    if (order.P2P) {
      // If this is a P2P ring we may have to pay a (pre-trading) percentage tokenS to the wallet
      // We have to make sure the order owner can pay that percentage, otherwise we'll have to sell
      // less tokenS.
      const feeS = this.calculatePreTradingPercentage(order.fillAmountS,
                                                      order.tokenSFeePercentage,
                                                      this.context.feePercentageBase);
      const totalAmountS = order.fillAmountS + feeS;
      if (totalAmountS > order.ringSpendableS) {
        const maxFeeAmountS = Math.floor(order.ringSpendableS * order.tokenSFeePercentage /
                                         this.context.feePercentageBase);
        order.fillAmountS = order.ringSpendableS - maxFeeAmountS;
      }
    }
    order.fillAmountB = Math.floor(order.fillAmountS * order.amountB / order.amountS);
  }

  public async calculateFeesAndTaxes(order: OrderInfo, prevOrder: OrderInfo) {
    if (order.P2P) {
      // Calculate P2P fees
      order.fillAmountFee = 0;
      if (order.walletAddr) {
        order.fillAmountFeeS = this.calculatePreTradingPercentage(order.fillAmountS,
                                                                  order.tokenSFeePercentage,
                                                                  this.context.feePercentageBase);
        order.fillAmountFeeB = Math.floor(order.fillAmountB * order.tokenBFeePercentage /
                               this.context.feePercentageBase);
      } else {
        order.fillAmountFeeS = 0;
        order.fillAmountFeeB = 0;
      }

      // The taker gets the margin
      order.splitS = 0;
      order.fillAmountS = prevOrder.fillAmountB;
    } else {
      // Calculate matching fees
      order.fillAmountFee = Math.floor(order.feeAmount * order.fillAmountS / order.amountS);
      order.fillAmountFeeS = 0;
      order.fillAmountFeeB = 0;

      // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
      // If nextOrder.feeToken == nextOrder.tokenB and the order doesn't have the necessary tokenB amount
      // we use feePercentage instead, which should give similar results if the data is set correctly
      // in the order
      await this.orderUtil.reserveAmountS(order, order.fillAmountS);
      order.ringSpendableFee = await this.orderUtil.getSpendableFee(order);
      if (order.fillAmountFee > order.ringSpendableFee) {
          order.fillAmountFeeB += Math.floor(order.fillAmountB * order.feePercentage / this.context.feePercentageBase);
          // fillAmountB still contains fillAmountFeeB! This makes the subsequent calculations easier.
          order.fillAmountFee = 0;
      } else {
        await this.orderUtil.reserveAmountFee(order, order.fillAmountFee);
      }

      // The miner/wallet gets the margin
      order.splitS = order.fillAmountS - prevOrder.fillAmountB;
      order.fillAmountS = prevOrder.fillAmountB;
    }
  }

  public adjustOrderState(order: OrderInfo) {
    const filledAmountS = order.fillAmountS + order.splitS;
    const totalAmountS = filledAmountS;
    const totalAmountFee = order.fillAmountFee;
    order.filledAmountS += filledAmountS;
    // Update spendables
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

  public async getRingTransferItems(feeBalances: { [id: string]: any; }) {
    if (!this.valid) {
      return [];
    }

    await this.payFees();
    const transferItems = await this.transferTokens();

    // Validate how the ring is settled
    // this.validateSettlement(transferItems);

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
      const amountSToBuyer = order.fillAmountS - prevOrder.fillAmountFeeB;
      let amountSToFeeHolder = /*order.splitS + */order.fillAmountFeeS + prevOrder.fillAmountFeeB;
      let amountFeeToFeeHolder = order.fillAmountFee;
      if (order.tokenS === order.feeToken) {
        amountSToFeeHolder += amountFeeToFeeHolder;
        amountFeeToFeeHolder = 0;
      }

      this.addTokenTransfer(transferItems, order.tokenS, order.owner, prevOrder.tokenRecipient, amountSToBuyer);
      this.addTokenTransfer(transferItems, order.tokenS, order.owner, feeHolder, amountSToFeeHolder);
      this.addTokenTransfer(transferItems, order.feeToken, order.owner, feeHolder, amountFeeToFeeHolder);

      if (!this.tokenPayments[i][order.tokenS]) {
        const payment: DetailedTokenTransfer = {
          description: "none",
          token: order.tokenS,
          from: order.owner,
          to: prevOrder.tokenRecipient,
          amount: 0,
          subPayments: [],
        };
        this.tokenPayments[i][order.tokenS] = payment;
      }
      this.tokenPayments[i][order.tokenS].amount +=
        order.fillAmountS + order.splitS + order.fillAmountFeeS;

      const paymentToBuyer: DetailedTokenTransfer = {
        description: "none",
        token: order.tokenS,
        from: order.owner,
        to: prevOrder.tokenRecipient,
        amount: order.fillAmountS,
        subPayments: [],
      };
      this.tokenPayments[i][order.tokenS].subPayments.push(paymentToBuyer);

      if (!this.tokenPayments[i][order.tokenB]) {
        const payment: DetailedTokenTransfer = {
          description: "none",
          token: order.tokenB,
          from: order.owner,
          to: order.owner,
          amount: 0,
          subPayments: [],
        };
        this.tokenPayments[i][order.tokenB] = payment;
      }
      this.tokenPayments[i][order.tokenB].amount -= (order.fillAmountB - order.fillAmountFeeB);

      if (!this.tokenPayments[i][order.feeToken]) {
        const payment: DetailedTokenTransfer = {
          description: "none",
          token: order.feeToken,
          from: order.owner,
          to: feeHolder,
          amount: 0,
          subPayments: [],
        };
        this.tokenPayments[i][order.feeToken] = payment;
      }
      this.tokenPayments[i][order.feeToken].amount += order.fillAmountFee;

      this.payments.orders[i].payments.push(this.tokenPayments[i][order.tokenS]);
      this.payments.orders[i].payments.push(this.tokenPayments[i][order.tokenB]);
      if (order.tokenS !== order.feeToken && order.tokenB !== order.feeToken) {
        this.payments.orders[i].payments.push(this.tokenPayments[i][order.feeToken]);
      }
    }
    return transferItems;
  }

  private addTokenTransfer(transferItems: TransferItem[], token: string, from: string, to: string, amount: number) {
    if (from !== to && amount > 0) {
      transferItems.push({token, from, to, amount});
    }
  }

  private async payFees() {
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const order = this.orders[i];

      const walletPercentage = order.P2P ? 100 :
                               (order.walletAddr ? order.walletSplitPercentage : 0);

      const feePaidFee = await this.payFeesAndTaxes(order,
                                                    order.feeToken,
                                                    order.fillAmountFee,
                                                    walletPercentage,
                                                    i);
      const feePaidS = await this.payFeesAndTaxes(order,
                                                  order.tokenS,
                                                  order.fillAmountFeeS + order.splitS,
                                                  walletPercentage,
                                                  i);
      const feePaidB = await this.payFeesAndTaxes(order,
                                                  order.tokenB,
                                                  order.fillAmountFeeB,
                                                  walletPercentage,
                                                  i);

      order.fillAmountFee = feePaidFee;
      order.fillAmountFeeS = feePaidS;
      order.fillAmountFeeB = feePaidB;
    }
  }

  private async payFeesAndTaxes(order: OrderInfo,
                                token: string,
                                amount: number,
                                walletSplitPercentage: number,
                                orderIdx: number) {
    if (amount === 0) {
      return 0;
    }
    if (order.P2P && !order.walletAddr) {
      assert.equal(amount, 0, "In a P2P order no fees should be paid when no wallet is provided");
    }

    /*const payment: DetailedTokenTransfer = {
      description: "none",
      token,
      from: this.orders[orderIdx].owner,
      to: "X",
      amount,
      subPayments: [],
    };
    this.tokenPayments[orderIdx][token].subPayments.push(payment);*/

    const walletFee = Math.floor(amount * walletSplitPercentage / 100);
    let minerFee = amount - walletFee;

    // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
    if (order.waiveFeePercentage > 0) {
      minerFee = Math.floor(minerFee *
                            (this.context.feePercentageBase - order.waiveFeePercentage) /
                            this.context.feePercentageBase);
      // fillAmountFeeS is always 0
    } else if (order.waiveFeePercentage < 0) {
      // No fees need to be paid by this order
      minerFee = 0;
    }

    // Calculate taxes and rebates
    const [burnRate, rebateRate] =
    await this.context.taxTable.getBurnAndRebateRate(order.owner, order.feeToken, order.P2P);
    // Miner fee
    const minerFeeTax = Math.floor(minerFee * burnRate.toNumber() / this.context.feePercentageBase);
    const minerFeeRebate = Math.floor(minerFee * rebateRate.toNumber() / this.context.feePercentageBase);
    let feeToMiner = minerFee - minerFeeTax - minerFeeRebate;
    // Wallet fee
    const walletFeeTax = Math.floor(walletFee * burnRate.toNumber() / this.context.feePercentageBase);
    const walletFeeRebate = Math.floor(walletFee * rebateRate.toNumber() / this.context.feePercentageBase);
    const feeToWallet = walletFee - walletFeeTax - walletFeeRebate;

    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    if (this.minerFeesToOrdersPercentage > 0 && feeToMiner > 0) {
      // Pay out the fees to the orders
      for (const otherOrder of this.orders) {
        if (otherOrder.waiveFeePercentage < 0) {
          const feeToOwner = Math.floor(feeToMiner * (-otherOrder.waiveFeePercentage) / this.context.feePercentageBase);
          await this.addFeePayment(token, otherOrder.owner, feeToOwner, orderIdx, null);
        }
      }
      // Subtract all fees the miner pays to the orders
      feeToMiner = Math.floor(feeToMiner * (this.context.feePercentageBase - this.minerFeesToOrdersPercentage) /
      this.context.feePercentageBase);
    }

    // Do the fee payments
    await this.addFeePayment(token, order.walletAddr, feeToWallet, orderIdx, null);
    await this.addFeePayment(token, this.feeRecipient, feeToMiner, orderIdx, null);
    // Pay the tax with the feeHolder as owner
    await this.addFeePayment(token, this.context.feeHolder.address, minerFeeTax + walletFeeTax, orderIdx, null);

    // Calculate the total fee payment after possible discounts (tax rebate + fee waiving)
    const totalFeePaid = (feeToWallet + feeToMiner) + (minerFeeTax + walletFeeTax);
    assert(totalFeePaid <= amount, "Total fee paid cannot exceed the total fee amount");
    return totalFeePaid;
  }

  private async addFeePayment(token: string,
                              owner: string,
                              amount: number,
                              orderIdx: number,
                              parentPayment: DetailedTokenTransfer) {
    if (!token || !owner || !amount) {
      return;
    }
    if (!this.feeBalances[token]) {
      this.feeBalances[token] = {};
    }
    if (!this.feeBalances[token][owner]) {
      this.feeBalances[token][owner] = 0;
    }
    this.feeBalances[token][owner] += amount;

    if (parentPayment) {
      const payment: DetailedTokenTransfer = {
        description: "none",
        token,
        from: this.orders[orderIdx].owner,
        to: owner,
        amount,
        subPayments: [],
      };
      parentPayment.subPayments.push(payment);
    }
  }

  private resize(i: number, smallest: number) {
    let newSmallest = smallest;
    const j = (i + this.orders.length - 1) % this.orders.length;
    const order = this.orders[i];
    const prevOrder = this.orders[j];

    if (prevOrder.fillAmountB > order.fillAmountS) {
      newSmallest = i;
      prevOrder.fillAmountB = order.fillAmountS;
      prevOrder.fillAmountS = Math.floor(prevOrder.fillAmountB * prevOrder.amountS / prevOrder.amountB);
    }

    return newSmallest;
  }

  private calculatePreTradingPercentage(value: number, percentage: number, percentageBase: number) {
    assert(percentage < percentageBase);
    return Math.floor((value * percentageBase) / (percentageBase - percentage)) - value;
  }

  private validateSettlement(transfers: TransferItem[]) {
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
      console.log("tokenS percentage:      " + (order.P2P ? order.tokenSFeePercentage : 0) /
                                               this.context.feePercentageBase);
      // tokenSFeePercentage is pre-trading so the percentage is on the total tokenS paid
      console.log("tokenS real percentage: " + order.fillAmountFeeS /
                                               (order.fillAmountS + order.fillAmountFeeS));
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

      // General fill requirements
      assert((order.fillAmountS + order.splitS) <= order.amountS, "fillAmountS + splitS <= amountS");
      assert(order.fillAmountB <= order.amountB + epsilon, "fillAmountB <= amountB");
      assert(order.fillAmountFee <= order.feeAmount, "fillAmountFee <= feeAmount");
      if (order.fillAmountS > 0 || order.fillAmountB > 0) {
        const orderRate = order.amountS / order.amountB;
        const rate = (order.fillAmountS + order.splitS) / order.fillAmountB;
        this.assertNumberEqualsWithPrecision(rate, orderRate, "fill rates need to match order rate");
      }

      // Check who gets the margin
      if (order.P2P) {
        // Taker gets all margin
        assert(order.fillAmountS >= prevOrder.fillAmountB, "fillAmountS >= prev.fillAmountB");
        assert.equal(order.splitS, 0, "splitS should be 0 in a P2P order");
      } else {
        // Miner gets all margin
        assert.equal(order.fillAmountS, prevOrder.fillAmountB, "fillAmountS == prev.fillAmountB");
      }

      // Spendable limitations
      {
        const totalAmountTokenS = order.fillAmountS + order.splitS + order.fillAmountFeeS;
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
            const rate = order.fillAmountFeeS / (order.fillAmountS + order.fillAmountFeeS);
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
        // assert.equal(order.fillAmountFeeS, 0, "Cannot pay in tokenS");
        // Fees need to be paid either in feeToken OR tokenB, never both at the same time
        assert(!(order.fillAmountFee > 0 && order.fillAmountFeeB > 0), "fees should be paid in tokenFee OR tokenB");

        // Fees can only be paid in tokenB when the owner doesn't have enought funds to pay in feeToken
        if (order.fillAmountFeeB > 0) {
          const fee = Math.floor(order.feeAmount * (order.fillAmountS + order.splitS) / order.amountS);
          assert(fee > order.ringSpendableFee, "fees should be paid in tokenFee if possible");
        }

        if (order.waiveFeePercentage < 0) {
          // If the miner waives the fees for this order all fees need to be 0
          assert.equal(order.fillAmountFee,  0, "No fees need to be paid if miner waives fees");
          assert.equal(order.fillAmountFeeB, 0, "No fees need to be paid if miner waives fees");
        } else {
          if (order.fillAmountFeeB > 0) {
            const rate = order.fillAmountFeeB / order.fillAmountB;
            const feePercentageAfterMinerReduction = order.feePercentage *
              (this.context.feePercentageBase - order.waiveFeePercentage) / this.context.feePercentageBase;
            this.assertNumberEqualsWithPrecision(rate, feePercentageAfterMinerReduction,
                                                 "tokenB fee should match feePercentage after miner reduction");
          }
          if (order.fillAmountFee > 0) {
            const filledPercentage = (order.fillAmountS + order.splitS) / order.amountS;
            const rate = order.fillAmountFee / order.feeAmount;
            const filledPercentageAfterMinerReduction = filledPercentage *
              (this.context.feePercentageBase - order.waiveFeePercentage) / this.context.feePercentageBase;
            this.assertNumberEqualsWithPrecision(rate, filledPercentageAfterMinerReduction,
                                                 "feeAmount rate should match filledPercentage after miner reduction");
          }
        }
      }

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
      const expectedBalanceS = -(order.fillAmountS + order.splitS + order.fillAmountFeeS);
      // In a P2P order nextOrder.fillAmountS > order.fillAmountB because the taker gets the margin
      const expectedBalanceB = nextOrder.fillAmountS - order.fillAmountFeeB;
      const expectedBalanceFeeToken = -(order.fillAmountFee);

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
      expectedFeeHolderBalances[order.tokenS] += order.splitS + order.fillAmountFeeS;
      expectedFeeHolderBalances[order.tokenB] += order.fillAmountFeeB;
      expectedFeeHolderBalances[order.feeToken] += order.fillAmountFee;
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

    // Ensure fee payments match perfectly with total amount fees paid by all orders
    {
      const totalFees: { [id: string]: number; } = {};
      for (let i = 0; i < ringSize; i++) {
        const order = this.orders[i];
        // Fees
        if (!totalFees[order.feeToken]) {
          totalFees[order.feeToken] = 0;
        }
        totalFees[order.feeToken] += order.fillAmountFee;
        if (!totalFees[order.tokenS]) {
          totalFees[order.tokenS] = 0;
        }
        totalFees[order.tokenS] += order.fillAmountFeeS + order.splitS;
        if (!totalFees[order.tokenB]) {
          totalFees[order.tokenB] = 0;
        }
        totalFees[order.tokenB] += order.fillAmountFeeB;
      }

      /*for (const token of Object.keys(this.feeBalances)) {
        let totalFee = 0;
        let totalTax = 0;
        for (const owner of Object.keys(this.feeBalances[token])) {
          const balance = this.feeBalances[token][owner];
          if (owner === this.context.feeHolder.address) {
            totalTax += balance;
          } else {
            totalFee += balance;
          }
        }
        const totalIncomeTax = this.context.tax.calculateTax(token, order.P2P, totalFees[token]);
        const incomeAfterTax = totalFees[token] - totalIncomeTax;
        this.assertNumberEqualsWithPrecision(incomeAfterTax, totalFee,
                                             "Total income distributed needs to match paid fees after tax");
        this.assertNumberEqualsWithPrecision(totalIncomeTax, totalTax,
                                             "Total tax distributed needs to match consumer tax + income tax");
      }*/
    }
  }

  private assertNumberEqualsWithPrecision(n1: number, n2: number, description: string, precision: number = 8) {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);
    return assert.equal(Number(numStr1), Number(numStr2), description);
  }
}
