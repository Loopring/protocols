import { BigNumber } from "bignumber.js";
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import Web3 = require("web3");
import { Order } from "./order";

export class Ring {
  public owner: string;
  public orders: Order[];

  public feeSelections: number[];

  public v: number;
  public r: string;
  public s: string;

  public authV: number[] = [];
  public authR: string[] = [];
  public authS: string[] = [];

  private web3Instance: Web3;

  private rate: number;

  constructor(owner: string,
              orders: Order[],
              feeSelections: number[]) {
    this.owner = owner;
    this.orders = orders;
    this.feeSelections = feeSelections;

    try {
      if (web3) {
        this.web3Instance = web3;
      }
    } catch (err) {
      // ignore.
    }
  }

  public isValidSignature() {
    if (_.isUndefined(this.v) || _.isUndefined(this.r) || _.isUndefined(this.s)) {
      throw new Error("Cannot call isValidSignature on unsigned order");
    }
    const ringHash = this.getRingHash();
    const msgHash = ethUtil.hashPersonalMessage(ringHash);
    try {
      const pubKey = ethUtil.ecrecover(msgHash, this.v,
                                       ethUtil.toBuffer(this.r),
                                       ethUtil.toBuffer(this.s));
      const recoveredAddress = ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey));
      return recoveredAddress === this.owner;
    } catch (err) {
      return false;
    }
  }

  public async signAsync() {
    const ringHash = this.getRingHash();
    // console.log("ring hash: ", ethUtil.bufferToHex(ringHash));

    const signer = promisify(this.web3Instance.eth.sign);
    const signature = await signer(this.owner, ethUtil.bufferToHex(ringHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.v = v;
    this.r = ethUtil.bufferToHex(r);
    this.s = ethUtil.bufferToHex(s);

    for (const order of this.orders) {
      const authSig = await signer(order.params.authAddr, ethUtil.bufferToHex(ringHash));
      const sigRes = ethUtil.fromRpcSig(authSig);

      this.authV.push(sigRes.v);
      this.authR.push(ethUtil.bufferToHex(sigRes.r));
      this.authS.push(ethUtil.bufferToHex(sigRes.s));
    }
  }

  public getRingHash() {
    const orderHashList: string[] = [];

    for (const order of this.orders) {
      const orderHash = order.getOrderHash();
      orderHashList.push(ethUtil.bufferToHex(orderHash));
    }

    const ringHash = ABI.soliditySHA3(
      [
        "string",
        "address",
        "uint16",
      ],
      [
        this.xorReduceStr(orderHashList),
        this.owner,
        this.feeSelectionListToNumber(this.feeSelections),
      ]);

    return ringHash;
  }

  public feeSelectionListToNumber(feeSelections: number[]) {
    let res: number = 0;
    for (let i = 0; i < feeSelections.length; i ++) {
      res += feeSelections[i] << i;
    }

    return res;
  }

  public getRingHashHex() {
    const ringHash = this.getRingHash();
    const ringHashHex = ethUtil.bufferToHex(ringHash);
    return ringHashHex;
  }

  public caculateAndSetRateAmount() {
    const size = this.orders.length;
    this.rate = 1;
    for (const order of this.orders) {
      this.rate = this.rate * order.params.amountS.toNumber() / order.params.amountB.toNumber();
    }
    this.rate = Math.pow(this.rate, 1 / size);

    for (const order of this.orders) {
      order.params.rateAmountB = order.params.amountB.toNumber();
      order.params.rateAmountS = Math.floor(order.params.amountS.toNumber() / this.rate);
    }
  }

  public printToConsole() {
    console.log("-".repeat(80));
    console.log("ring miner:", this.owner);
    console.log("rate:", this.rate);
    for (const order of this.orders) {
      console.log("-".repeat(80));
      console.log("order owner:", order.owner);
      console.log("order params:", order.params);
    }

    console.log("fee Selections:", this.feeSelections);
    console.log("-".repeat(80));
  }

  private xorReduce(numberArr: number[]) {
    const n0 = numberArr[0];
    const tail = numberArr.slice(1);
    const intRes = tail.reduce((n1: number, n2: number) => n1 ^ n2,  n0);
    return intRes;
  }

  private xorReduceStr(strArr: string[]) {
    const s0 = strArr[0];
    const tail = strArr.slice(1);
    const strXor = (s1: string, s2: string) => {
      const buf1 = Buffer.from(s1.slice(2), "hex");
      const buf2 = Buffer.from(s2.slice(2), "hex");
      const res = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        res[i] = buf1[i] ^ buf2[i];
      }

      const strRes = ethUtil.bufferToHex(res);
      return strRes;
    };

    const reduceRes = tail.reduce((a, b) => strXor(a, b), s0);
    return Buffer.from(reduceRes.slice(2), "hex");
  }
}
