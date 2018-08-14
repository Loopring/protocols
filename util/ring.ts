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
  public P2P: boolean;
  public valid: boolean;

  private context: Context;
  private orderUtil: OrderUtil;

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
      order.fillAmountS = order.maxAmountS;
      if (this.P2P) {
        // If this is a P2P ring we may have to pay a (pre-trading) percentage tokenS to the wallet
        // We have to make sure the order owner can pay that percentage, otherwise we'll have to sell
        // less tokenS. We have to calculate totalAmountS here so that
        // fillAmountS := totalAmountS - (totalAmountS * tokenSFeePercentage)
        const totalAmountS = Math.floor((order.fillAmountS * 1000) / (1000 - order.tokenSFeePercentage));
        if (totalAmountS > order.spendableS) {
          const maxFeeAmountS = Math.floor(order.spendableS * order.tokenSFeePercentage) / 1000;
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
        if (this.P2P) {
          // Calculate P2P fees
          nextOrder.fillAmountFee = 0;
          if (nextOrder.walletAddr) {
            nextOrder.fillAmountFeeS =
              Math.floor((nextOrder.fillAmountS * 1000) / (1000 - nextOrder.tokenSFeePercentage))
              - nextOrder.fillAmountS;
            // This is to fix rounding errors in JS
            if (nextOrder.fillAmountS + nextOrder.fillAmountFeeS > nextOrder.spendableS) {
              nextOrder.fillAmountFeeS = nextOrder.spendableS - nextOrder.fillAmountS;
            }
            nextOrder.fillAmountFeeB = Math.floor(nextOrder.fillAmountB * nextOrder.tokenBFeePercentage) / 1000;
          } else {
            nextOrder.fillAmountFeeS = 0;
            nextOrder.fillAmountFeeB = 0;
          }

          // The taker gets the margin
          nextOrder.splitS = 0;
        } else {
          // Calculate matching fees
          nextOrder.fillAmountFee = nextOrder.feeAmount * nextOrder.fillAmountS / nextOrder.amountS;
          nextOrder.fillAmountFeeS = 0;
          nextOrder.fillAmountFeeB = 0;

          // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
          let totalAmountFeeToken = nextOrder.fillAmountFee;
          if (nextOrder.feeToken === nextOrder.tokenS) {
            totalAmountFeeToken += nextOrder.fillAmountS;
          }
          if (totalAmountFeeToken > nextOrder.spendableFee) {
              nextOrder.fillAmountFeeB += Math.floor(nextOrder.fillAmountB * nextOrder.feePercentage) / 1000;
              // fillAmountB still contains fillAmountFeeB! This makes the subsequent calculations easier.
              nextOrder.fillAmountFee = 0;
          }

          // The miner/wallet gets the margin
          nextOrder.splitS = nextOrder.fillAmountS - order.fillAmountB;
          nextOrder.fillAmountS = order.fillAmountB;
        }
      } else {
        this.valid = false;
      }
    }
  }

  public async getRingTransferItems(walletSplitPercentage: number, feeBalances: { [id: string]: any; }) {
    if (walletSplitPercentage > 100 && walletSplitPercentage < 0) {
      throw new Error("invalid walletSplitPercentage:" + walletSplitPercentage);
    }
    if (!this.valid) {
      console.log("Ring cannot be settled!");
      return [];
    }

    const ringSize = this.orders.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const currOrder = this.orders[i];
      const prevOrder = this.orders[prevIndex];
      const token = currOrder.tokenS;
      const from = currOrder.owner;
      const to = prevOrder.owner;
      const amount = currOrder.fillAmountS;
      const feeHolder = this.context.feeHolder.address;

      if (!currOrder.splitS) { // if undefined, then assigned to 0;
        currOrder.splitS = 0;
      }

      console.log("order.spendableS:       " + currOrder.spendableS / 1e18);
      console.log("order.spendableFee:     " + currOrder.spendableFee / 1e18);
      console.log("order.amountS:          " + currOrder.amountS / 1e18);
      console.log("order.amountB:          " + currOrder.amountB / 1e18);
      console.log("order expected rate:    " + currOrder.amountS / currOrder.amountB);
      console.log("order.fillAmountS:      " + currOrder.fillAmountS / 1e18);
      console.log("order.fillAmountB:      " + currOrder.fillAmountB / 1e18);
      console.log("order.splitS:           " + currOrder.splitS / 1e18);
      console.log("order actual rate:      " + (currOrder.fillAmountS + currOrder.splitS) / currOrder.fillAmountB);
      console.log("order.fillAmountFee:    " + currOrder.fillAmountFee / 1e18);
      console.log("order.fillAmountFeeS:   " + currOrder.fillAmountFeeS / 1e18);
      console.log("order.fillAmountFeeB:   " + currOrder.fillAmountFeeB / 1e18);
      console.log("tokenS percentage:      " + (this.P2P ? currOrder.tokenSFeePercentage : 0) / 1000);
      // tokenSFeePercentage is pre-trading so the percentage is on the total tokenS paid
      console.log("tokenS real percentage: " + currOrder.fillAmountFeeS /
                                               (currOrder.fillAmountS + currOrder.fillAmountFeeS));
      console.log("tokenB percentage:      " +
        (this.P2P ? currOrder.tokenBFeePercentage : currOrder.feePercentage) / 1000);
      console.log("tokenB real percentage: " + currOrder.fillAmountFeeB / currOrder.fillAmountB);
      console.log("----------------------------------------------");

      // Sanity checks
      assert(currOrder.fillAmountS >= 0, "fillAmountS should be positive");
      assert(currOrder.splitS >= 0, "splitS should be positive");
      assert(currOrder.fillAmountFee >= 0, "fillAmountFee should be positive");
      assert(currOrder.fillAmountFeeS >= 0, "fillAmountFeeS should be positive");
      assert(currOrder.fillAmountFeeB >= 0, "fillAmountFeeB should be positive");
      assert((currOrder.fillAmountS + currOrder.splitS) <= currOrder.amountS, "fillAmountS + splitS <= amountS");
      assert((currOrder.fillAmountS + currOrder.splitS + currOrder.fillAmountFeeS) <= currOrder.spendableS,
             "fillAmountS + splitS + fillAmountFeeS <= spendableS");
      assert(currOrder.fillAmountS <= currOrder.amountS, "fillAmountS <= amountS");
      assert(currOrder.fillAmountFee <= currOrder.feeAmount, "fillAmountFee <= feeAmount");
      if (this.P2P) {
        // Taker gets all margin
        assert(currOrder.fillAmountS >= prevOrder.fillAmountB, "fillAmountS >= prev.fillAmountB");
      } else {
        // Miner gets all margin
        assert.equal(currOrder.fillAmountS, prevOrder.fillAmountB, "fillAmountS == prev.fillAmountB");
      }
      // TODO: can fail if not exactly equal, check with lesser precision
      // assert(currOrder.amountS / currOrder.amountB
      //        === currOrder.fillAmountS / currOrder.fillAmountB, "fill rates need to match order rate");

      // AdjustOrders
      const totalAmountS = amount + currOrder.splitS;
      currOrder.filledAmountS += totalAmountS;
      currOrder.maxAmountS -= totalAmountS;
      currOrder.maxAmountB -= currOrder.fillAmountB;

      currOrder.spendableS -= totalAmountS;
      currOrder.spendableFee -= currOrder.fillAmountFee;
      if (currOrder.tokenS === currOrder.feeToken) {
        currOrder.spendableS -= currOrder.fillAmountFee;
        currOrder.spendableFee -= totalAmountS;
      }

      // If the buyer needs to pay fees in tokenB, the seller needs
      // to send the tokenS amount to the fee holder contract
      const amountSToBuyer = amount - prevOrder.fillAmountFeeB;
      let amountSToFeeHolder = currOrder.splitS + currOrder.fillAmountFeeS + prevOrder.fillAmountFeeB;
      let amountFeeToFeeHolder = currOrder.fillAmountFee;
      if (currOrder.tokenS === currOrder.feeToken) {
        amountSToFeeHolder += amountFeeToFeeHolder;
        amountFeeToFeeHolder = 0;
      }

      // Transfers
      if (amountSToBuyer > 0) {
        transferItems.push({token, from, to, amount: amountSToBuyer});
      }
      if (amountSToFeeHolder > 0) {
        transferItems.push({token, from, to: feeHolder, amount: amountSToFeeHolder});
      }
      if (amountFeeToFeeHolder > 0) {
        transferItems.push({token: currOrder.feeToken, from, to: feeHolder, amount: amountFeeToFeeHolder});
      }

      let walletPercentage = currOrder.walletAddr ? walletSplitPercentage : 0;
      if (this.P2P) {
        // Miner gets nothing
        walletPercentage = 100;
      }
      if (currOrder.fillAmountFee > 0) {
        const feeToWallet = Math.floor(currOrder.fillAmountFee * walletPercentage / 100);
        const feeToMiner = currOrder.fillAmountFee - feeToWallet;
        await this.addFeeBalance(feeBalances, currOrder.feeToken, currOrder.walletAddr, feeToWallet);
        await this.addFeeBalance(feeBalances, currOrder.feeToken, this.feeRecipient, feeToMiner);
      }
      if (currOrder.fillAmountFeeB > 0) {
        const feeToWallet = Math.floor(currOrder.fillAmountFeeB * walletPercentage / 100);
        const feeToMiner = currOrder.fillAmountFeeB - feeToWallet;
        await this.addFeeBalance(feeBalances, currOrder.tokenB, currOrder.walletAddr, feeToWallet);
        await this.addFeeBalance(feeBalances, currOrder.tokenB, this.feeRecipient, feeToMiner);
      }
      if (currOrder.fillAmountFeeS > 0) {
        const feeToWallet = Math.floor(currOrder.fillAmountFeeS * walletPercentage / 100);
        const feeToMiner = currOrder.fillAmountFeeS - feeToWallet;
        await this.addFeeBalance(feeBalances, currOrder.tokenS, currOrder.walletAddr, feeToWallet);
        await this.addFeeBalance(feeBalances, currOrder.tokenS, this.feeRecipient, feeToMiner);
      }
      if (currOrder.splitS > 0) {
        const feeToWallet = Math.floor(currOrder.splitS * walletPercentage / 100);
        const feeToMiner = currOrder.splitS - feeToWallet;
        await this.addFeeBalance(feeBalances, token, currOrder.walletAddr, feeToWallet);
        await this.addFeeBalance(feeBalances, token, this.feeRecipient, feeToMiner);
      }

    }

    return transferItems;
  }

  private async addFeeBalance(feeBalances: { [id: string]: any; }, token: string, owner: string, amount: number) {
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

}
