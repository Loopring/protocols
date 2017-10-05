/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/
import * as _ from 'lodash';
import ethUtil = require('ethereumjs-util');
import promisify = require('es6-promisify');
import Web3 = require('web3');
import { crypto } from './crypto';
import { Order } from './order';
var BigNumber = require('bignumber.js');

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
    const orderHash = this.getRingHash();
    const msgHash = ethUtil.hashPersonalMessage(orderHash);
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
    const orderHash = this.getRingHash();
    const signature = await promisify(web3Instance.eth.sign)(this.owner, ethUtil.bufferToHex(orderHash));
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

    const orderHash = crypto.solSHA3([
      this.xorReduce(vList),
      this.xorReduceStr(rList),
      this.xorReduceStr(sList),
    ]);
    return orderHash;
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
