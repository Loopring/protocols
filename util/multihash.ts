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
    const hash = this.getOrderHash(order);
    order.orderHashHex = hash.toString("hex");
    order.sig = await this.signAsync(order.sigAlgorithm, hash, order.owner);
  }

  public async signRingsAsync(rings: RingsInfo, transactionOrigin: string) {
    // Calculate all ring hashes
    const ringHashes: string[] = [];
    for (const ring of rings.rings) {
      const orderHashes = new Bitstream();
      for (const order of ring) {
        orderHashes.addHex(rings.orders[order].orderHashHex);
      }
      const ringHash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
      ringHashes.push(ringHash.toString("hex"));
    }

    // XOR ring hashes together for the mining hash
    let ringHashesXOR = ringHashes[0];
    for (let i = 1; i < ringHashes.length; i++) {
      ringHashesXOR = this.xor(ringHashesXOR, ringHashes[i], 32);
    }

    // Calculate mining hash
    const feeRecipient = rings.feeRecipient ? rings.feeRecipient : transactionOrigin;
    const args = [
      feeRecipient,
      rings.miner ? rings.miner : "0x0",
      ringHashesXOR,
    ];
    const argTypes = [
      "address",
      "address",
      "bytes32",
    ];
    rings.hash = ABI.soliditySHA3(argTypes, args);

    // Calculate mining signature
    const miner = rings.miner ? rings.miner : feeRecipient;
    rings.sig = await this.signAsync(HashAlgorithm.Ethereum, rings.hash, miner);
  }

  public async signAsync(algorithm: HashAlgorithm, hash: Buffer, address: string) {
    // Default to standard Ethereum signing
    algorithm = Object.is(algorithm, undefined) ? HashAlgorithm.Ethereum : algorithm;

    const sig = new Bitstream();
    sig.addNumber(algorithm, 1);
    switch (+algorithm) {
      case HashAlgorithm.Ethereum:
        await this.signEthereumAsync(sig, hash, address);
        break;
      case HashAlgorithm.EIP712:
        await this.signEIP712Async(sig, hash, address);
        break;
      default:
        throw Error("Unsupported hashing algorithm: " + algorithm);
    }
    return sig.getData();
  }

  private async signEthereumAsync(sig: Bitstream, hash: Buffer, address: string) {
    const signature = await promisify(this.web3Instance.eth.sign)(address, ethUtil.bufferToHex(hash));
    const { v, r, s } = ethUtil.fromRpcSig(signature);

    sig.addNumber(1 + 32 + 32, 1);
    sig.addNumber(v, 1);
    sig.addHex(ethUtil.bufferToHex(r));
    sig.addHex(ethUtil.bufferToHex(s));
  }

  // TODO: Actually implement this correctly, the standard is not widely supported yet
  private async signEIP712Async(sig: Bitstream, hash: Buffer, address: string) {
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

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(0), 16);
    const x2 = new BN(s2.slice(0), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
