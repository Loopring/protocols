import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { LoopringSubmitParams, OrderParams, RingInfo } from "../util/types";
import { Bitstream } from "./bitstream";
import { Order } from "./order";
import { Ring } from "./ring";

export class RingFactory {
  public delegateContractAddr: string;
  public currBlockTimeStamp: number;
  public authAddress: string;
  public walletAddr: string;

  constructor(delegateContractAddr: string,
              authAddress: string,
              currBlockTimeStamp: number) {
    this.delegateContractAddr = delegateContractAddr;
    this.authAddress = authAddress;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public async generateRing(ringInfo: RingInfo) {
    const ringSize = ringInfo.amountSList.length;
    const salt = ringInfo.salt ? ringInfo.salt : 0;

    const orders: Order[] = [];
    for (let i = 0; i < ringSize; i ++) {
      const nextIndex = (i + 1) % ringSize;

      const orderParam: OrderParams = {
        delegateContract: this.delegateContractAddr,
        tokenS: ringInfo.tokenAddressList[i],
        tokenB: ringInfo.tokenAddressList[nextIndex],
        amountS: new BigNumber(ringInfo.amountSList[i]),
        amountB: new BigNumber(ringInfo.amountBList[i]),
        validSince: new BigNumber(this.currBlockTimeStamp - 60),
        validUntil: new BigNumber(this.currBlockTimeStamp + 3600 + salt),
        lrcFee: new BigNumber(ringInfo.lrcFeeAmountList[i]),
        buyNoMoreThanAmountB: ringInfo.buyNoMoreThanAmountBList[i],
        marginSplitPercentage: ringInfo.marginSplitPercentageList[i],
        authAddr: this.authAddress,
        walletAddr: this.walletAddr,
      };

      const order = new Order(ringInfo.orderOwners[i], orderParam);
      await order.signAsync();
      orders.push(order);
    }

    const ring = new Ring(ringInfo.miner, orders, ringInfo.feeSelections);
    await ring.signAsync();

    return ring;
  }

  public ringToSubmitableParams(ring: Ring) {
    const ringSize = ring.orders.length;
    ring.caculateAndSetRateAmount();

    const bitstream = new Bitstream();

    bitstream.addNumber(ringSize, 1);
    bitstream.addAddress(ring.owner);
    bitstream.addNumber(this.feeSelectionListToNumber(ring.feeSelections), 2);

    for (let i = 0; i < ringSize; i++) {
      const order = ring.orders[i];

      let authAddr = order.params.authAddr;
      let walletAddr = order.params.walletAddr;
      let ringAuthR = ring.authR[i];
      let ringAuthS = ring.authS[i];
      let ringAuthV = ring.authV[i];
      if (i > 0) {
        const previousOrder = ring.orders[i - 1];

        // Do simple XOR compression using values of the previous order
        authAddr = this.xor(previousOrder.params.authAddr, order.params.authAddr, 20);
        walletAddr = this.xor(previousOrder.params.walletAddr, order.params.walletAddr, 20);
        ringAuthR = this.xor(ring.authR[i - 1], ring.authR[i], 32);
        ringAuthS = this.xor(ring.authS[i - 1], ring.authS[i], 32);
        ringAuthV = ring.authV[i - 1] ^ ring.authV[i];
      }

      bitstream.addAddress(order.owner, 32);
      bitstream.addAddress(order.params.tokenS, 32);
      bitstream.addAddress(walletAddr, 32);
      bitstream.addAddress(authAddr, 32);
      bitstream.addBigNumber(order.params.amountS);
      bitstream.addBigNumber(order.params.amountB);
      bitstream.addBigNumber(order.params.lrcFee);
      bitstream.addBigNumber(new BigNumber(order.params.rateAmountS.toPrecision(15)), 32);
      bitstream.addHex(order.params.r);
      bitstream.addHex(order.params.s);
      bitstream.addHex(ringAuthR);
      bitstream.addHex(ringAuthS);
      bitstream.addBigNumber(order.params.validSince, 4);
      bitstream.addBigNumber(order.params.validUntil.minus(order.params.validSince), 4);
      bitstream.addNumber(order.params.v, 1);
      bitstream.addNumber(ringAuthV, 1);
      bitstream.addNumber(((order.params.buyNoMoreThanAmountB ? 1 : 0) << 7) + order.params.marginSplitPercentage, 1);
    }

    const submitParams = {
      data: bitstream.getData(),
    };

    return submitParams;
  }

  public feeSelectionListToNumber(feeSelections: number[]) {
    let res = 0;
    for (let i = 0; i < feeSelections.length; i ++) {
      res += feeSelections[i] << i;
    }

    return res;
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(2), 16);
    const x2 = new BN(s2.slice(2), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }

}
