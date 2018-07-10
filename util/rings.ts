import { BigNumber } from "bignumber.js";
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import * as _ from "lodash";
import Web3 = require("web3");
import { Order } from "./order";
import { RingsInfo } from "./types";

export class Rings {
  public ringsInfo: RingsInfo;

  constructor(ringsInfo: RingsInfo) {
    this.ringsInfo = ringsInfo;
  }

  public getRingHash() {
    const hash = "xxx";

    return hash;
  }

}
