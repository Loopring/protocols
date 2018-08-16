import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { OrderInfo, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
  public owner: string;
  public feeRecipient: string;
  public hash?: Buffer;
  public minerFeesToOrdersPercentage?: number;
  public P2P: boolean;
  public valid: boolean;

  private context: Context;
  private orderUtil: OrderUtil;
  private walletSplitPercentage: number;

  constructor(context: Context,
              orders: OrderInfo[],
              owner: string,
              feeRecipient: string,
              ) {
    this.context = context;
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;
    this.P2P = false;
    this.valid = true;
    this.minerFeesToOrdersPercentage = 0;

    this.orderUtil = new OrderUtil(context);
  }

  public updateHash() {
    const orderHashes = new Bitstream();
    for (const order of this.orders) {
      orderHashes.addHex(order.hash.toString("hex"));
    }
    this.hash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
  }

  public checkOrdersValid() {
    for (const order of this.orders) {
      this.valid = this.valid && order.valid;
    }
  }

  public async checkTokensRegistered() {
    const tokens: string[] = [];
    for (const order of this.orders) {
      tokens.push(order.tokenS);
    }
    const tokensRegistered = await this.context.tokenRegistry.areAllTokensRegistered(tokens);
    this.valid = this.valid && tokensRegistered;
  }

  public checkP2P(mining: Mining) {
    // This is a P2P ring when the signer of the ring is an owner of an order in the ring
    for (const order of this.orders) {
      if (order.owner === mining.miner) {
        this.P2P = true;
        return;
      }
    }
  }

  public async calculateFillAmountAndFee() {
    for (const order of this.orders) {
      order.tokenSFeePercentage = order.tokenSFeePercentage ? order.tokenSFeePercentage : 0;
      order.tokenBFeePercentage = order.tokenBFeePercentage ? order.tokenBFeePercentage : 0;
      order.waiveFeePercentage = order.waiveFeePercentage ? order.waiveFeePercentage : 0;

      order.fillAmountS = order.maxAmountS;
      if (this.P2P) {
        // If this is a P2P ring we may have to pay a (pre-trading) percentage tokenS to the wallet
        // We have to make sure the order owner can pay that percentage, otherwise we'll have to sell
        // less tokenS. We have to calculate totalAmountS here so that
        // fillAmountS := totalAmountS - (totalAmountS * tokenSFeePercentage)
        const totalAmountS = Math.floor((order.fillAmountS * this.context.feePercentageBase) /
                                        (this.context.feePercentageBase - order.tokenSFeePercentage));
        if (totalAmountS > order.spendableS) {
          const maxFeeAmountS = Math.floor(order.spendableS * order.tokenSFeePercentage) /
                                this.context.feePercentageBase;
          order.fillAmountS = order.spendableS - maxFeeAmountS;
        }
      }
      order.fillAmountB = order.fillAmountS * order.amountB / order.amountS;
    }

    let smallest = 0;
    const ringSize = this.orders.length;
    let rate = 1;
    for (let i = 0; i < ringSize; i++) {
      rate = rate * this.orders[i].amountS / this.orders[i].amountB;
    }

    for (let i = ringSize - 1; i >= 0; i--) {
      smallest = this.resize(i, smallest);
    }

    for (let i = ringSize - 1; i >= smallest; i--) {
      this.resize(i, smallest);
    }

    for (let i = 0; i < ringSize; i++) {
      const nextIndex = (i + 1) % ringSize;
      const order = this.orders[i];
      const nextOrder = this.orders[nextIndex];

      if (nextOrder.fillAmountS >= order.fillAmountB) {
        this.calculateFeesAndTaxes(nextOrder, order, this.P2P);
        if (nextOrder.waiveFeePercentage < 0) {
          this.minerFeesToOrdersPercentage += -nextOrder.waiveFeePercentage;
        }
      } else {
        this.valid = false;
      }
    }
    // Miner can only distribute 100% of its fees to all orders combined
    this.valid = this.valid && this.minerFeesToOrdersPercentage <= this.context.feePercentageBase;
  }

  public calculateFeesAndTaxes(order: OrderInfo, prevOrder: OrderInfo, P2P: boolean) {
    if (this.P2P) {
      // Calculate P2P fees
      order.fillAmountFee = 0;
      if (order.walletAddr) {
        order.fillAmountFeeS = Math.floor((order.fillAmountS * this.context.feePercentageBase) /
                                          (this.context.feePercentageBase - order.tokenSFeePercentage)) -
                               order.fillAmountS;
        order.fillAmountFeeB = Math.floor(order.fillAmountB * order.tokenBFeePercentage) /
                               this.context.feePercentageBase;
      } else {
        order.fillAmountFeeS = 0;
        order.fillAmountFeeB = 0;
      }

      // The taker gets the margin
      order.splitS = 0;
    } else {
      // Calculate matching fees
      order.fillAmountFee = order.feeAmount * order.fillAmountS / order.amountS;
      order.fillAmountFeeS = 0;
      order.fillAmountFeeB = 0;

      // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
      const feeAmountTax = this.context.tax.calculateTax(order.feeToken, false, this.P2P, order.fillAmountFee);
      let totalAmountFeeToken = order.fillAmountFee + feeAmountTax;
      if (order.feeToken === order.tokenS) {
        totalAmountFeeToken += order.fillAmountS;
      }
      // nextOrder.feeToken == nextOrder.tokenB and the order doesn't have the necessary tokenB amount
      // we use feePercentage instead, which should give similar results if the data is set correctly
      // in the order
      if (totalAmountFeeToken > order.spendableFee) {
          order.fillAmountFeeB += Math.floor(order.fillAmountB * order.feePercentage) / this.context.feePercentageBase;
          // fillAmountB still contains fillAmountFeeB! This makes the subsequent calculations easier.
          order.fillAmountFee = 0;
      }

      // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
      if (order.waiveFeePercentage > 0) {
        const waiveFeePercentage = order.waiveFeePercentage;
        order.fillAmountFee = Math.floor(order.fillAmountFee *
                                        (this.context.feePercentageBase - waiveFeePercentage)) /
                              this.context.feePercentageBase;
        order.fillAmountFeeB = Math.floor(order.fillAmountFeeB *
                                         (this.context.feePercentageBase - waiveFeePercentage)) /
                               this.context.feePercentageBase;
        // fillAmountFeeS is always 0
      } else if (order.waiveFeePercentage < 0) {
        // No fees need to be paid by this order
        order.fillAmountFee = 0;
        order.fillAmountFeeB = 0;
      }

      // The miner/wallet gets the margin
      order.splitS = order.fillAmountS - prevOrder.fillAmountB;
      order.fillAmountS = prevOrder.fillAmountB;
    }

    // Calculate consumer taxes. These are applied on top of the calculated fees
    order.taxFee = this.context.tax.calculateTax(order.feeToken, false, this.P2P, order.fillAmountFee);
    order.taxS = this.context.tax.calculateTax(order.tokenS, false, this.P2P, order.fillAmountFeeS);
    order.taxB = this.context.tax.calculateTax(order.tokenB, false, this.P2P, order.fillAmountFeeB);
  }

  public adjustOrderState(order: OrderInfo) {
    const filledAmountS = order.fillAmountS + order.splitS;
    const totalAmountS = filledAmountS + order.taxS;
    const totalAmountFee = order.fillAmountFee + order.taxFee;
    order.filledAmountS += filledAmountS;
    order.maxAmountS -= filledAmountS;
    if (order.maxAmountS > order.spendableS) {
      order.maxAmountS = order.spendableS;
    }
    // Update spendables
    order.spendableS -= totalAmountS;
    order.spendableFee -= totalAmountFee;
    if (order.tokenS === order.feeToken) {
      order.spendableS -= totalAmountFee;
      order.spendableFee -= totalAmountS;
    }
    // Checks
    assert(order.spendableS >= 0, "spendableS should be positive");
    assert(order.spendableFee >= 0, "spendableFee should be positive");
    assert(order.maxAmountS >= 0, "maxAmountS should be positive");
    assert(order.filledAmountS <= order.amountS, "filledAmountS <= amountS");
  }

  public async getRingTransferItems(walletSplitPercentage: number, feeBalances: { [id: string]: any; }) {
    this.walletSplitPercentage = walletSplitPercentage;
    if (walletSplitPercentage > 100 && walletSplitPercentage < 0) {
      throw new Error("invalid walletSplitPercentage:" + walletSplitPercentage);
    }
    if (!this.valid) {
      console.log("Ring cannot be settled!");
      return [];
    }

    // Validate how the ring is settled
    this.validateSettlement();

    const transferItems = await this.transferTokens();
    await this.payFees(feeBalances);

    // Adjust orders
    for (const order of this.orders) {
      this.adjustOrderState(order);
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
      const amountSToBuyer = order.fillAmountS - prevOrder.fillAmountFeeB - prevOrder.taxB;
      let amountSToFeeHolder = order.splitS + order.fillAmountFeeS + order.taxS +
                               prevOrder.fillAmountFeeB + prevOrder.taxB;
      let amountFeeToFeeHolder = order.fillAmountFee + order.taxFee;
      if (order.tokenS === order.feeToken) {
        amountSToFeeHolder += amountFeeToFeeHolder;
        amountFeeToFeeHolder = 0;
      }

      this.addTokenTransfer(transferItems, order.tokenS, order.owner, prevOrder.owner, amountSToBuyer);
      this.addTokenTransfer(transferItems, order.tokenS, order.owner, feeHolder, amountSToFeeHolder);
      this.addTokenTransfer(transferItems, order.feeToken, order.owner, feeHolder, amountFeeToFeeHolder);
    }
    return transferItems;
  }

  private addTokenTransfer(transferItems: TransferItem[], token: string, from: string, to: string, amount: number) {
    if (amount > 0) {
      transferItems.push({token, from, to, amount});
    }
  }

  private async payFees(feeBalances: { [id: string]: any; }) {
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const order = this.orders[i];
      const feeInTokenS = order.fillAmountFeeS + order.splitS;
      await this.payFeesAndTaxes(feeBalances, order.feeToken, order.fillAmountFee, order.taxFee, order.walletAddr);
      await this.payFeesAndTaxes(feeBalances, order.tokenS, feeInTokenS, order.taxS, order.walletAddr);
      await this.payFeesAndTaxes(feeBalances, order.tokenB, order.fillAmountFeeB, order.taxB, order.walletAddr);
    }
  }

  private async payFeesAndTaxes(feeBalances: { [id: string]: any; }, token: string, amount: number,
                                consumerTax: number, wallet: string) {
    if (amount === 0) {
      assert.equal(consumerTax, 0, "If fee == 0 no tax should be paid");
      return;
    }
    if (this.P2P && !wallet) {
      assert.equal(amount, 0, "In a P2P ring no fees should be paid when no wallet is provided");
    }

    const walletPercentage = this.P2P ? 100 :
                             (wallet ? this.walletSplitPercentage : 0);

    const incomeTax = this.context.tax.calculateTax(token, true, this.P2P, amount);
    const incomeAfterTax = amount - incomeTax;

    const feeToWallet = Math.floor(incomeAfterTax * walletPercentage / 100);
    const minerFee = incomeAfterTax - feeToWallet;

    let feeToMiner = minerFee;
    // Fees can be paid out in different tokens so we can't easily accumulate the total fee
    // that needs to be paid out to order owners. So we pay out each part out here to all orders that need it.
    if (this.minerFeesToOrdersPercentage > 0) {
      // Subtract all fees the miner pays to the orders
      feeToMiner = Math.floor(minerFee * (this.context.feePercentageBase - this.minerFeesToOrdersPercentage) /
                              this.context.feePercentageBase);
      // Pay out the fees to the orders
      for (const order of this.orders) {
        if (order.waiveFeePercentage < 0) {
          const feeToOwner = Math.floor(minerFee * (-order.waiveFeePercentage) / this.context.feePercentageBase);
          await this.payFee(feeBalances, token, order.owner, feeToOwner);
        }
      }
    }
    await this.payFee(feeBalances, token, wallet, feeToWallet);
    await this.payFee(feeBalances, token, this.feeRecipient, feeToMiner);
    // Pay the tax with the feeHolder as owner
    await this.payFee(feeBalances, token, this.context.feeHolder.address, consumerTax + incomeTax);
  }

  private async payFee(feeBalances: { [id: string]: any; }, token: string, owner: string, amount: number) {
    if (!token || !owner || !amount) {
      return;
    }
    if (!feeBalances[token]) {
      feeBalances[token] = {};
    }
    if (!feeBalances[token][owner]) {
      feeBalances[token][owner] = await this.context.feeHolder.feeBalances(token, owner).toNumber();
    }
    feeBalances[token][owner] += amount;
  }

  private resize(i: number, smallest: number) {
    let newSmallest = smallest;
    const j = (i + this.orders.length - 1) % this.orders.length;
    const order = this.orders[i];
    const prevOrder = this.orders[j];

    if (prevOrder.fillAmountB > order.fillAmountS) {
      newSmallest = i;
      prevOrder.fillAmountB = order.fillAmountS;
      prevOrder.fillAmountS = prevOrder.fillAmountB * prevOrder.amountS / prevOrder.amountB;
    }

    return newSmallest;
  }

  private validateSettlement() {
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const order = this.orders[i];
      const prevOrder = this.orders[prevIndex];

      console.log("order.spendableS:       " + order.spendableS / 1e18);
      console.log("order.spendableFee:     " + order.spendableFee / 1e18);
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
      console.log("order.taxFee:           " + order.taxFee / 1e18);
      console.log("order.taxS:             " + order.taxS / 1e18);
      console.log("order.taxB:             " + order.taxB / 1e18);
      console.log("tokenS percentage:      " + (this.P2P ? order.tokenSFeePercentage : 0) /
                                               this.context.feePercentageBase);
      // tokenSFeePercentage is pre-trading so the percentage is on the total tokenS paid
      console.log("tokenS real percentage: " + order.fillAmountFeeS /
                                               (order.fillAmountS + order.fillAmountFeeS));
      console.log("tokenB percentage:      " +
        (this.P2P ? order.tokenBFeePercentage : order.feePercentage) / this.context.feePercentageBase);
      console.log("tokenB real percentage: " + order.fillAmountFeeB / order.fillAmountB);
      console.log("----------------------------------------------");

      // Sanity checks
      assert(order.fillAmountS >= 0, "fillAmountS should be positive");
      assert(order.splitS >= 0, "splitS should be positive");
      assert(order.fillAmountFee >= 0, "fillAmountFee should be positive");
      assert(order.fillAmountFeeS >= 0, "fillAmountFeeS should be positive");
      assert(order.fillAmountFeeB >= 0, "fillAmountFeeB should be positive");
      assert(order.taxFee >= 0, "taxFee should be positive");
      assert(order.taxS >= 0, "taxS should be positive");
      assert(order.taxB >= 0, "taxB should be positive");
      assert((order.fillAmountS + order.splitS) <= order.amountS, "fillAmountS + splitS <= amountS");
      assert((order.fillAmountS + order.splitS + order.fillAmountFeeS) <= order.spendableS + 10000,
             "fillAmountS + splitS + fillAmountFeeS <= spendableS");
      assert(order.fillAmountS <= order.amountS, "fillAmountS <= amountS");
      assert(order.fillAmountFee <= order.feeAmount, "fillAmountFee <= feeAmount");
      if (this.P2P) {
        // Taker gets all margin
        assert(order.fillAmountS >= prevOrder.fillAmountB, "fillAmountS >= prev.fillAmountB");
      } else {
        // Miner gets all margin
        assert.equal(order.fillAmountS, prevOrder.fillAmountB, "fillAmountS == prev.fillAmountB");
      }
      // TODO: can fail if not exactly equal, check with lesser precision
      // assert(currOrder.amountS / currOrder.amountB
      //        === currOrder.fillAmountS / currOrder.fillAmountB, "fill rates need to match order rate");
    }
  }

}
