import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
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

  public async calculateFillAmountAndFee() {
    for (const order of this.orders) {
      order.fillAmountS = order.maxAmountS;
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
        nextOrder.fillAmountFee = nextOrder.feeAmount * nextOrder.fillAmountS / nextOrder.amountS;

        if (this.P2P) {
          // TODO: tokenS is pre-trading so we'll probably have to scale the ring
          // keeping this percentage in mind.
          // If we do a simple percentage on top of fillAmountS we could go above spendableS
          nextOrder.fillTokenSFeePercentage = nextOrder.tokenSFeePercentage;
          nextOrder.fillTokenBFeePercentage = nextOrder.tokenBFeePercentage;
        } else {
          nextOrder.fillTokenSFeePercentage = 0;
          nextOrder.fillTokenBFeePercentage = 0;
        }
        // We have to pay with tokenB if the owner can't pay the complete feeAmount in feeToken
        let totalAmountFeeToken = nextOrder.fillAmountFee;
        if (nextOrder.feeToken === nextOrder.tokenS) {
          totalAmountFeeToken += nextOrder.fillAmountS;
        }
        if (totalAmountFeeToken > nextOrder.spendableFee) {
            nextOrder.fillTokenBFeePercentage += nextOrder.feePercentage;
            nextOrder.fillAmountFee = 0;
        }

        nextOrder.splitS = nextOrder.fillAmountS - order.fillAmountB;
        nextOrder.fillAmountS = order.fillAmountB;
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

      console.log("order.amountS:          " + currOrder.amountS / 1e18);
      console.log("order.amountB:          " + currOrder.amountB / 1e18);
      console.log("order expected rate:    " + currOrder.amountS / currOrder.amountB);
      console.log("order.fillAmountS:      " + currOrder.fillAmountS / 1e18);
      console.log("order.fillAmountB:      " + currOrder.fillAmountB / 1e18);
      console.log("order.splitS:           " + currOrder.splitS / 1e18);
      console.log("order actual rate:      " + (currOrder.fillAmountS + currOrder.splitS) / currOrder.fillAmountB);
      console.log("order.fillAmountFee:    " + currOrder.fillAmountFee / 1e18);
      console.log("----------------------------------------------");

      // Sanity checks
      assert(currOrder.fillAmountS >= 0, "fillAmountS should be positive");
      assert(currOrder.splitS >= 0, "splitS should be positive");
      assert(currOrder.fillAmountFee >= 0, "fillAmountFee should be positive");
      assert((currOrder.fillAmountS + currOrder.splitS) <= currOrder.amountS, "fillAmountS + splitS <= amountS");
      assert(currOrder.fillAmountS <= currOrder.amountS, "fillAmountS <= amountS");
      assert(currOrder.fillAmountFee <= currOrder.feeAmount, "fillAmountFee <= feeAmount");
      assert.equal(currOrder.fillAmountS, prevOrder.fillAmountB, "fillAmountS == prev.fillAmountB");
      // TODO: can fail if not exactly equal, check with lesser precision
      // assert(currOrder.amountS / currOrder.amountB
      //        === currOrder.fillAmountS / currOrder.fillAmountB, "fill rates need to match order rate");

      // If the transfer amount is 0 nothing will get transfered
      if (amount === 0) {
        continue;
      }

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
      if (prevOrder.fillTokenBFeePercentage > 0) {
        const feeAmountB = Math.floor(prevOrder.fillAmountB * prevOrder.fillTokenBFeePercentage) / 1000;
        const amountToBuyer = amount - feeAmountB;
        transferItems.push({token, from, to: feeHolder, amount: feeAmountB});
        transferItems.push({token, from, to, amount: amountToBuyer});
      } else {
        transferItems.push({token, from, to, amount});
      }
      if (currOrder.fillAmountFee > 0) {
        transferItems.push({token: currOrder.feeToken, from , to: feeHolder, amount: currOrder.fillAmountFee});
      }
      if (currOrder.splitS > 0) {
        transferItems.push({token, from , to: feeHolder, amount: currOrder.splitS});
      }

      if (walletSplitPercentage > 0 && currOrder.walletAddr) {
        if (currOrder.fillAmountFee > 0) {
          const feeToWallet = Math.floor(currOrder.fillAmountFee * walletSplitPercentage / 100);
          const feeToMiner = currOrder.fillAmountFee - feeToWallet;
          await this.addFeeBalance(feeBalances, currOrder.feeToken, currOrder.walletAddr, feeToWallet);
          await this.addFeeBalance(feeBalances, currOrder.feeToken, this.feeRecipient, feeToMiner);
        }
        if (currOrder.fillTokenBFeePercentage > 0) {
          const feeAmountB = Math.floor(currOrder.fillAmountB * currOrder.fillTokenBFeePercentage) / 1000;
          const feeToWallet = Math.floor(feeAmountB * walletSplitPercentage / 100);
          const feeToMiner = feeAmountB - feeToWallet;
          await this.addFeeBalance(feeBalances, currOrder.tokenB, currOrder.walletAddr, feeToWallet);
          await this.addFeeBalance(feeBalances, currOrder.tokenB, this.feeRecipient, feeToMiner);
        }
        if (currOrder.splitS > 0) {
          const splitSToWallet = Math.floor(currOrder.splitS * walletSplitPercentage / 100);
          const splitSToMiner = currOrder.splitS - splitSToWallet;
          await this.addFeeBalance(feeBalances, token, currOrder.walletAddr, splitSToWallet);
          await this.addFeeBalance(feeBalances, token, this.feeRecipient, splitSToMiner);
        }
      } else {
        if (currOrder.fillAmountFee > 0) {
          await this.addFeeBalance(feeBalances, currOrder.feeToken, this.feeRecipient, currOrder.fillAmountFee);
        }
        if (currOrder.fillTokenBFeePercentage > 0) {
          const feeAmountB = Math.floor(currOrder.fillAmountB * currOrder.fillTokenBFeePercentage) / 1000;
          await this.addFeeBalance(feeBalances, currOrder.tokenB, this.feeRecipient, feeAmountB);
        }
        if (currOrder.splitS > 0) {
          await this.addFeeBalance(feeBalances, token, this.feeRecipient, currOrder.splitS);
        }
      }
    }

    return transferItems;
  }

  private async addFeeBalance(feeBalances: { [id: string]: any; }, token: string, owner: string, amount: number) {
    if (!feeBalances[token]) {
      feeBalances[token] = {};
    }
    if (!feeBalances[token][this.feeRecipient]) {
      feeBalances[token][this.feeRecipient] = await this.context.feeHolder.feeBalances(token, owner).toNumber();
    }
    feeBalances[token][this.feeRecipient] += amount;
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
