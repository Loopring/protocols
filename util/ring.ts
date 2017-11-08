import * as _ from 'lodash';
import ethUtil = require('ethereumjs-util');
import promisify = require('es6-promisify');
import Web3 = require('web3');
import { crypto } from './crypto';
import { Order } from './order';

export class Ring {
  public owner: string;
  public orders: Order[];
  public v: number;
  public r: string;
  public s: string;

  public web3Instance: Web3;

  constructor(owner: string, orders: Order[]) {
    this.owner = owner;
    this.orders = orders;

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
      throw new Error('Cannot call isValidSignature on unsigned order');
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
    //console.log("ring hash: ", ethUtil.bufferToHex(ringHash));
    const signature = await promisify(this.web3Instance.eth.sign)(this.owner, ethUtil.bufferToHex(ringHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.v = v;
    this.r = ethUtil.bufferToHex(r);
    this.s = ethUtil.bufferToHex(s);
  }

  public getRingHash() {
    const size = this.orders.length;
    let vList: number[] = [];
    let rList: string[] = [];
    let sList: string[] = [];

    for (let i = 0; i < size; i++) {
      vList[i] = this.orders[i].params.v;
      rList[i] = this.orders[i].params.r;
      sList[i] = this.orders[i].params.s;
    }

    const ringHash = crypto.solSHA3([
      this.xorReduce(vList),
      this.xorReduceStr(rList),
      this.xorReduceStr(sList),
    ]);

    return ringHash;
  }

  public getRingHashHex() {
    const ringHash = this.getRingHash();
    const ringHashHex = ethUtil.bufferToHex(ringHash);
    return ringHashHex;
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
      let res = Buffer.alloc(32);
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
