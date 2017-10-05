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
import { OrderParams } from './types';
var BigNumber = require('bignumber.js');

const web3Instance: Web3 = web3;

export class Order {
  public owner: string;
  public params: OrderParams;

  constructor(owner: string, params: OrderParams) {
    this.owner = owner;
    this.params = params;
  }

  public isValidSignature() {
    const { v, r, s } = this.params;
    if (_.isUndefined(v) || _.isUndefined(r) || _.isUndefined(s)) {
      throw new Error('Cannot call isValidSignature on unsigned order');
    }
    const orderHash = this.getOrderHash();
    const msgHash = ethUtil.hashPersonalMessage(orderHash);
    try {
      const pubKey = ethUtil.ecrecover(msgHash, v, ethUtil.toBuffer(r), ethUtil.toBuffer(s));
      const recoveredAddress = ethUtil.bufferToHex(ethUtil.pubToAddress(pubKey));
      return recoveredAddress === this.owner;
    } catch (err) {
      return false;
    }
  }

  public async signAsync() {
    const orderHash = this.getOrderHash();
    const signature = await promisify(web3Instance.eth.sign)(this.owner, ethUtil.bufferToHex(orderHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.params = _.assign(this.params, {
      orderHashHex: ethUtil.bufferToHex(orderHash),
      v,
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
    });
  }

  private getOrderHash() {
    const orderHash = crypto.solSHA3([
      this.params.loopringProtocol,
      this.params.tokenS,
      this.params.tokenB,
      this.params.amountS,
      this.params.amountB,
      this.params.expiration,
      this.params.rand,
      this.params.lrcFee,
      this.params.buyNoMoreThanAmountB,
      this.params.marginSplitPercentage,
    ]);
    return orderHash;
  }
}
