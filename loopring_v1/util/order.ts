import { BigNumber } from "bignumber.js";
import xor = require("bitwise-xor");
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import Web3 = require("web3");
import { OrderParams } from "./types";

export class Order {
  public owner: string;
  public params: OrderParams;

  public web3Instance: Web3;

  constructor(owner: string, params: OrderParams) {
    this.owner = owner;
    this.params = params;

    try {
      if (web3) {
        this.web3Instance = web3;
      }
    } catch (err) {
      console.log("get web3 instance in Order class failed. err:", err);
    }
  }

  public isValidSignature() {
    const { v, r, s } = this.params;
    if (_.isUndefined(v) || _.isUndefined(r) || _.isUndefined(s)) {
      throw new Error("Cannot call isValidSignature on unsigned order");
    }
    const orderHash = this.getOrderHash();
    // console.log("hash len:", orderHash.length.toString());
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

    const signature = await promisify(this.web3Instance.eth.sign)(this.owner, ethUtil.bufferToHex(orderHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);
    this.params = _.assign(this.params, {
      orderHashHex: ethUtil.bufferToHex(orderHash),
      r: ethUtil.bufferToHex(r),
      s: ethUtil.bufferToHex(s),
      v,
    });
  }

  public getOrderHash() {
    const args = [
      this.params.delegateContract,
      this.owner,
      this.params.tokenS,
      this.params.tokenB,
      this.params.walletAddr,
      this.params.authAddr,
      this.toBN(this.params.amountS),
      this.toBN(this.params.amountB),
      this.toBN(this.params.validSince),
      this.toBN(this.params.validUntil),
      this.toBN(this.params.lrcFee),
      this.params.buyNoMoreThanAmountB,
      this.params.marginSplitPercentage,
    ];

    const argTypes = [
      "address",
      "address",
      "address",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "bool",
      "uint8",
    ];
    const orderHash = ABI.soliditySHA3(argTypes, args);
    return orderHash;
  }

  private toBN(bg: BigNumber) {
    return new BN(bg.toString(10), 10);
  }

}
