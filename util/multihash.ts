import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { HashAlgorithm, OrderInfo, RingsInfo } from "./types";

export class MultiHashUtil {

  public web3Instance: Web3;

  constructor() {
    try {
      if (web3) {
        this.web3Instance = web3;
      }
    } catch (err) {
      console.log("get web3 instance in Order class failed. err:", err);
    }
  }

  public async signOrderAsync(order: OrderInfo) {
    // Default to standard Ethereum signing
    let algorithm = HashAlgorithm.Ethereum;
    if (order.sigAlgorithm) {
      algorithm = order.sigAlgorithm;
    }

    const sig = new Bitstream();
    sig.addNumber(algorithm, 1);
    switch (+algorithm) {
      case HashAlgorithm.Ethereum:
        await this.signOrderEthereumAsync(sig, order);
        break;
      case HashAlgorithm.EIP712:
        await this.signOrderEIP712Async(sig, order);
        break;
      default:
        throw Error("Unsupported hashing algorithm: " + algorithm);
    }
    order.sig = sig.getData();
  }

  public async signOrderEthereumAsync(sig: Bitstream, order: OrderInfo) {
    const orderHash = this.getOrderHash(order);

    const signature = await promisify(this.web3Instance.eth.sign)(order.owner, ethUtil.bufferToHex(orderHash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);

    sig.addNumber(1 + 32 + 32, 1);
    sig.addNumber(v, 1);
    sig.addHex(ethUtil.bufferToHex(r));
    sig.addHex(ethUtil.bufferToHex(s));
  }

  // TODO: Actually implement this correctly, the standard is not widely supported yet
  public async signOrderEIP712Async(sig: Bitstream, order: OrderInfo) {
    throw Error("EIP712 signing currently not implemented.");

    /*const orderHash = this.getOrderHash(order);

    const msgParams = [
      {type: "string", name: "Owner", value: order.owner},
    ];

    const signature = await web3.eth.signTypedData(msgParams, order.owner);
    const { v, r, s } = ethUtil.fromRpcSig(signature);

    // await web3.currentProvider.sendAsync({
    //   method: "eth_signTypedData",
    //   params: [msgParams, order.owner],
    //   from: order.owner,
    // }, (err?: Error, result?: Web3.JSONRPCResponsePayload) => { console.log("Hashing: " + result.result); });

    sig.addNumber(1 + 32 + 32, 1);
    sig.addNumber(v, 1);
    sig.addHex(ethUtil.bufferToHex(r));
    sig.addHex(ethUtil.bufferToHex(s));*/
  }

  private getOrderHash(order: OrderInfo) {
    const MAX_UINT = new BN("f".repeat(64), 16);
    const args = [
      order.owner,
      order.tokenS,
      order.tokenB,
      this.toBN(order.amountS),
      this.toBN(order.amountB),
      this.toBN(order.lrcFee),
      order.dualAuthAddr ? order.dualAuthAddr : "0x0",
      order.broker ? order.broker : "0x0",
      order.orderInterceptor ? order.orderInterceptor : "0x0",
      order.walletAddr ? order.walletAddr : "0x0",
      order.validSince ? order.validSince : this.toBN(0),
      order.validUntil ? order.validUntil : MAX_UINT,
      order.allOrNone,
    ];

    const argTypes = [
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "bool",
    ];
    const orderHash = ABI.soliditySHA3(argTypes, args);
    return orderHash;
  }

  private toBN(n: number) {
    return new BN((new BigNumber(n)).toString(10), 10);
  }

}
