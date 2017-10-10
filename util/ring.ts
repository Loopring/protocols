import * as _ from 'lodash';
import ethUtil = require('ethereumjs-util');
import promisify = require('es6-promisify');
import Web3 = require('web3');
import { crypto } from './crypto';
import { Order } from './order';

const web3Instance: Web3 = web3;

export class Ring {
  public owner: string;
  public orders: Order[];
  public v: number;
  public r: string;
  public s: string;

  constructor(owner: string, orders: Order[]) {
    this.owner = owner;
    this.orders = orders;
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
    console.log("ring.ts-ringhash:", ethUtil.bufferToHex(ringHash));
    const signature = await promisify(web3Instance.eth.sign)(this.owner, ethUtil.bufferToHex(ringHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.v = v;
    this.r = ethUtil.bufferToHex(r);
    this.s = ethUtil.bufferToHex(s);
  }

  private getRingHash() {
    const size = this.orders.length;
    let vList = new Uint8Array(size);
    let rList: string[] = [];
    let sList: string[] = [];

    for (let i = 0; i < size; i++) {
      vList[i] = this.orders[i].params.v;
      rList[i] = this.orders[i].params.r;
      sList[i] = this.orders[i].params.s;
    }

    // console.log("vlist xor:", this.xorReduce(vList));
    // console.log("rlist xor: ", this.xorReduceStr(rList) + "");

    const ringHash = crypto.solSHA3([
      this.xorReduce(vList),
      this.xorReduceStr(rList),
      this.xorReduceStr(sList),
    ]);

    return ringHash;
  }

  private xorReduce(numberArr: Uint8Array) {
    const n0 = numberArr[0];
    const tail = numberArr.slice(1);
    return tail.reduce((n1: number, n2: number) => n1 ^ n2,  n0);
  }

  private xorReduceStr(strArr: string[]) {
    const s0 = strArr[0];
    const tail = strArr.slice(1);
    const strXor = (s1: string, s2: string) => {
      const buf1 = Buffer.from(s1);
      const buf2 = Buffer.from(s2);
      let res = Buffer.alloc(32);
      for (let i = 0; i < 32; i++) {
        res[i] = buf1[i] ^ buf2[i];
      }
      return res.toString();
    };

    return tail.reduce((s1, s2) => strXor(s1, s2), s0);
  }
}
