import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { logDebug } from "./logs";
import { OrderInfo, RingsInfo, SignAlgorithm } from "./types";

export class MultiHashUtil {

  web3Instance: Web3;

  constructor() {
    try {
      if (web3) {
        this.web3Instance = web3;
      } else {
        this.web3Instance = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
      }
    } catch (err) {
      logDebug("get web3 instance in Order class failed. err:", err);
    }
  }

  async signOrderAsync(order: OrderInfo) {
    const signer = order.owner;
    return await this.signAsync(order.signAlgorithm, order.hash, signer, order.signerPrivateKey);
  }

  async signAsync(algorithm: SignAlgorithm, hash: Buffer, address: string, privateKey?: string) {
    // Default to standard Ethereum signing
    algorithm = Object.is(algorithm, undefined) ? SignAlgorithm.Ethereum : algorithm;

    const sig = new Bitstream();
    sig.addNumber(algorithm, 1);
    switch (+algorithm) {
      case SignAlgorithm.Ethereum:
        await this.signEthereumAsync(sig, hash, privateKey);
        return sig.getData();
      case SignAlgorithm.EIP712:
        await this.signEIP712Async(sig, hash, privateKey);
        return sig.getData();
      case SignAlgorithm.None:
        return null;
      default:
        throw Error("Unsupported hashing algorithm: " + algorithm);
    }
  }

  verifySignature(signer: string, hash: Buffer, multihash: string) {
    const bitstream = new Bitstream(multihash);
    assert(bitstream.length() >= 2, "invalid multihash format");
    const algorithm = bitstream.extractUint8(0);
    const size = bitstream.extractUint8(1);
    assert.equal(bitstream.length(), (2 + size), "bad multihash size");

    if (algorithm === SignAlgorithm.Ethereum) {
      assert.notEqual(signer, "0x0", "invalid signer address");
      assert.equal(size, 65, "bad Ethereum multihash size");

      const v = bitstream.extractUint8(2);
      const r = bitstream.extractBytes32(3);
      const s = bitstream.extractBytes32(3 + 32);

      try {
        const msgHash = ethUtil.hashPersonalMessage(hash);
        const pub = ethUtil.ecrecover(msgHash, v, r, s);
        const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
        return signer.toLowerCase() === recoveredAddress.toLowerCase();
      } catch {
        return false;
      }
    } else if (algorithm === SignAlgorithm.EIP712) {
      assert.notEqual(signer, "0x0", "invalid signer address");
      assert.equal(size, 65, "bad EIP712 multihash size");

      const v = bitstream.extractUint8(2);
      const r = bitstream.extractBytes32(3);
      const s = bitstream.extractBytes32(3 + 32);

      try {
        const pub = ethUtil.ecrecover(hash, v, r, s);
        const recoveredAddress = "0x" + ethUtil.pubToAddress(pub).toString("hex");
        return signer.toLowerCase() === recoveredAddress.toLowerCase();
      } catch {
        return false;
      }
    } else {
      return false;
    }
  }

  private async signEthereumAsync(sig: Bitstream, hash: Buffer, privateKey: string) {
    const parts = [Buffer.from("\x19Ethereum Signed Message:\n32", "utf8"), hash];
    const totalHash = ethUtil.sha3(Buffer.concat(parts));
    const signature = ethUtil.ecsign(totalHash, new Buffer(privateKey, "hex"));
    sig.addNumber(1 + 32 + 32, 1);
    sig.addNumber(signature.v, 1);
    sig.addHex(ethUtil.bufferToHex(signature.r));
    sig.addHex(ethUtil.bufferToHex(signature.s));
  }

  private async signEIP712Async(sig: Bitstream, hash: Buffer, privateKey: string) {
    const signature = ethUtil.ecsign(hash, new Buffer(privateKey, "hex"));
    sig.addNumber(1 + 32 + 32, 1);
    sig.addNumber(signature.v, 1);
    sig.addHex(ethUtil.bufferToHex(signature.r));
    sig.addHex(ethUtil.bufferToHex(signature.s));
  }

}
