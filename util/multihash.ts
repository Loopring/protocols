import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { OrderInfo, RingsInfo, SignAlgorithm } from "./types";

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
    order.sig = await this.signAsync(order.signAlgorithm, order.hash, order.owner);
  }

  public async signAsync(algorithm: SignAlgorithm, hash: Buffer, address: string) {
    // Default to standard Ethereum signing
    algorithm = Object.is(algorithm, undefined) ? SignAlgorithm.Ethereum : algorithm;

    const sig = new Bitstream();
    sig.addNumber(algorithm, 1);
    switch (+algorithm) {
      case SignAlgorithm.Ethereum:
        await this.signEthereumAsync(sig, hash, address);
        break;
      case SignAlgorithm.EIP712:
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

}
