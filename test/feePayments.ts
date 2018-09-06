
import BN = require("bn.js");
import abi = require("ethereumjs-abi");

interface FeePayment {
  owner: string;
  token: string;
  amount: number;
}

export class FeePayments {

  public payments: FeePayment[] = [];

  public add(owner: string, token: string, amount: number) {
    const feePayment: FeePayment = {
      owner,
      token,
      amount,
    };
    this.payments.push(feePayment);
  }

  public getData() {
    const batch: string[] = [];
    for (const payment of this.payments) {
      batch.push(this.addressToBytes32Str(payment.token));
      batch.push(this.addressToBytes32Str(payment.owner));
      batch.push(this.numberToBytes32Str(payment.amount));
    }
    return batch;
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
