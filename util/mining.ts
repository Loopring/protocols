import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import fs = require("fs");
import { MultiHashUtil } from "./multihash";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, TransferItem } from "./types";

export class Mining {

  public feeRecipient: string;

  public miner?: string;
  public sig?: string;

  public hash?: Buffer;
  public interceptor?: string;

  private BrokerRegistryContract: any;

  private multiHashUtil = new MultiHashUtil();

  constructor(feeRecipient: string,
              miner: string,
              sig: string) {
    this.feeRecipient = feeRecipient;
    this.miner = miner;
    this.sig = sig;

    const brokerRegistryAbi = fs.readFileSync("ABI/latest/IBrokerRegistry.abi", "ascii");
    this.BrokerRegistryContract = web3.eth.contract(JSON.parse(brokerRegistryAbi));
  }

  public updateMinerAndInterceptor() {
    if (!this.miner) {
      this.miner = this.feeRecipient;
    } else {
      const [registered, interceptor] = this.BrokerRegistryContract.getBroker(
        this.feeRecipient,
        this.miner,
      );
      assert(registered, "miner unregistered");
      this.interceptor = interceptor;
    }
  }

  public updateHash(rings: Ring[]) {
    let ringHashes = rings[0].hash;
    for (let i = 1; i < rings.length; i++) {
      ringHashes = this.xor(ringHashes, rings[i].hash);
    }
    const args = [
      this.feeRecipient,
      this.miner ? this.miner : "0x0",
      "0x" + ringHashes.toString("hex"),
    ];
    const argTypes = [
      "address",
      "address",
      "bytes32",
    ];
    this.hash = ABI.soliditySHA3(argTypes, args);
  }

  public checkMinerSignature(transactionOrigin: string) {
    if (!this.sig) {
      return (transactionOrigin === this.miner);
    } else {
      return this.multiHashUtil.verifySignature(this.miner, this.hash, this.sig);
    }
  }

  private xor(s1: Buffer, s2: Buffer) {
    assert(s1.length === s2.length, "can't xor buffers of unequal length");
    const x1 = new BN(s1.toString("hex"), 16);
    const x2 = new BN(s2.toString("hex"), 16);
    const result = x1.xor(x2);
    return new Buffer(result.toString(16, s1.length), "hex");
  }
}
