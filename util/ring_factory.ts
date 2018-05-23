import { BigNumber } from "bignumber.js";
import ethUtil = require("ethereumjs-util");
import { LoopringSubmitParams, OrderParams, RingInfo } from "../util/types";
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

  public bnToHex(x: BigNumber) {
    return web3.toHex(x.round(0, BigNumber.ROUND_DOWN)).substring(2).padStart(64, "0");
  }

  public addressToHex(x: string) {
    return "000000000000000000000000" + x.substring(2);
  }

  public padRight(x: string, n: number) {
    for (let i = 0; i < n; i++) {
        x = x + "0";
    }
    return x;
  }

  public addressXOR(s1: string, s2: string) {
    const buf1 = Buffer.from(s1.slice(2), "hex");
    const buf2 = Buffer.from(s2.slice(2), "hex");
    const res = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      res[i] = buf1[i] ^ buf2[i];
    }
    const strRes = ethUtil.bufferToHex(res);
    return strRes;
  }

  public ringToSubmitableParams(ring: Ring) {
    const ringSize = ring.orders.length;
    const addressList: string[][] = [];
    const uintArgsList: BigNumber[][] = [];
    const uint8ArgsList: number[][] = [];
    const buyNoMoreThanAmountBList: boolean[] = [];
    const vList: number[] = [];
    const rList: string[] = [];
    const sList: string[] = [];
    let data = "0x";

    ring.caculateAndSetRateAmount();
    const rateAmountSList = ring.orders.map((o) => new BigNumber(o.params.rateAmountS.toPrecision(15)));

    const ringSizeHex = this.bnToHex(new BigNumber(ringSize));
    const feeSelectionHex = this.bnToHex(new BigNumber(this.feeSelectionListToNumber(ring.feeSelections)));
    const feeRecipientHex = this.addressToHex(ring.owner);

    let ringHeaderData = "";
    ringHeaderData += ringSizeHex.substring(64 - 2);
    ringHeaderData += feeSelectionHex.substring(64 - 4);
    ringHeaderData += feeRecipientHex.substring(64 - 40);
    data += this.padRight(ringHeaderData, 64 - ringHeaderData.length);

    for (let i = 0; i < ringSize; i++) {
      const order = ring.orders[i];
      const addressListItem = [order.owner,
                               order.params.tokenS,
                               order.params.walletAddr,
                               order.params.authAddr];

      addressList.push(addressListItem);

      const uintArgsListItem = [
        order.params.amountS,
        order.params.amountB,
        order.params.validSince,
        order.params.validUntil,
        order.params.lrcFee,
        rateAmountSList[i],
      ];
      uintArgsList.push(uintArgsListItem);

      const uint8ArgsListItem = [order.params.marginSplitPercentage];

      uint8ArgsList.push(uint8ArgsListItem);

      buyNoMoreThanAmountBList.push(order.params.buyNoMoreThanAmountB);

      vList.push(order.params.v);
      rList.push(order.params.r);
      sList.push(order.params.s);

      let authAddrHex = this.addressToHex(order.params.authAddr);
      let walletAddrHex = this.addressToHex(order.params.walletAddr);
      let ringAuthRHex = ring.authR[i].substring(2);
      let ringAuthSHex = ring.authS[i].substring(2);
      let ringAuthV = ring.authV[i];
      if (i > 0) {
        // Do some simple XOR compression
        const previousOrder = ring.orders[i - 1];
        authAddrHex = this.addressXOR(previousOrder.params.authAddr, order.params.authAddr).slice(2);
        walletAddrHex = this.addressXOR(previousOrder.params.walletAddr, order.params.walletAddr).slice(2);
        ringAuthRHex = this.addressXOR(ring.authR[i - 1], ring.authR[i]).slice(2);
        ringAuthSHex = this.addressXOR(ring.authS[i - 1], ring.authS[i]).slice(2);
        ringAuthV = ring.authV[i - 1] ^ ring.authV[i];
      }

      data += this.addressToHex(order.owner);
      data += this.addressToHex(order.params.tokenS);
      data += walletAddrHex;
      data += authAddrHex;

      data += this.bnToHex(order.params.validSince);
      data += this.bnToHex(order.params.validUntil);
      data += this.bnToHex(order.params.amountS);
      data += this.bnToHex(order.params.amountB);
      data += this.bnToHex(order.params.lrcFee);
      data += this.bnToHex(rateAmountSList[i]);

      data += ringAuthRHex;
      data += ringAuthSHex;

      data += order.params.r.substring(2);
      data += order.params.s.substring(2);

      let packedData = 0;
      packedData += (order.params.v << 16);
      packedData += (ringAuthV << 8);
      packedData += ((order.params.buyNoMoreThanAmountB ? 1 : 0) << 7) + order.params.marginSplitPercentage;
      data += this.bnToHex(new BigNumber(packedData)).substring(58);
    }

    vList.push(...ring.authV);
    rList.push(...ring.authR);
    sList.push(...ring.authS);

    // vList.push(ring.v);
    // rList.push(ring.r);
    // sList.push(ring.s);

    const submitParams = {
      data,
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

}
