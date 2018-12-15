
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Bitstream } from "protocol2-js";

interface FeePayment {
  owner: string;
  token: string;
  amount: BN;
}

export class FeePayments {

  public payments: FeePayment[] = [];

  public add(owner: string, token: string, amount: BN) {
    const feePayment: FeePayment = {
      owner,
      token,
      amount,
    };
    this.payments.push(feePayment);
  }

  public getData() {
    const batch = new Bitstream();
    for (const payment of this.payments) {
      batch.addAddress(payment.token, 32);
      batch.addAddress(payment.owner, 32);
      batch.addBN(payment.amount, 32);
    }
    return batch.getBytes32Array();
  }

  private numberToBytes32Str(n: number) {
    const encoded = abi.rawEncode(["uint256"], [new BN(n.toString(10), 10)]);
    return "0x" + encoded.toString("hex");
  }

  private addressToBytes32Str(addr: string) {
    const encoded = abi.rawEncode(["address"], [addr]);
    return "0x" + encoded.toString("hex");
  }

}
