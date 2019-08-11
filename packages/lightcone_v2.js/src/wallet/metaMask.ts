import Web3 from "web3";

import Eth from "../lib/wallet/ethereum/eth";
import Transaction from "../lib/wallet/ethereum/transaction";
import { MetaMaskAccount } from "../lib/wallet/ethereum/walletAccount";
import { fromMetaMask } from "../lib/wallet/WalletUtils";
import { exchange } from "..";

export class MetaMask {
  public web3: Web3;
  public address: string;
  public ethNode: Eth;
  public account: MetaMaskAccount;

  public constructor() {
    this.web3 = new Web3(
      "http://a9649c5e4b66b11e985860aa2b459f18-1745823248.us-west-2.elb.amazonaws.com:8545"
    );
    this.account = fromMetaMask(this.web3);
    this.address = this.account.getAddress();
    this.ethNode = new Eth(
      "http://a9649c5e4b66b11e985860aa2b459f18-1745823248.us-west-2.elb.amazonaws.com:8545"
    );
  }

  public async createOrUpdateAccount(
    publicX: string,
    publicY: string,
    gasPrice: number
  ) {
    exchange
      .createOrUpdateAccount(publicX, publicY, gasPrice)
      .then((rawTx: Transaction) => {
        this.account.signEthereumTx(rawTx).then(signedTx => {
          return this.account.sendTransaction(this.ethNode, signedTx);
        });
      });
  }

  public async depositTo(symbol: string, amount: number, gasPrice: number) {
    exchange
      .deposit(this.account, symbol, amount, gasPrice)
      .then((rawTx: Transaction) => {
        this.account.signEthereumTx(rawTx).then(signedTx => {
          return this.account.sendTransaction(this.ethNode, signedTx);
        });
      });
  }

  public async withdrawFrom(symbol: string, amount: number, gasPrice: number) {
    exchange
      .withdraw(this.account, symbol, amount, gasPrice)
      .then((rawTx: Transaction) => {
        this.account.signEthereumTx(rawTx).then(signedTx => {
          return this.account.sendTransaction(this.ethNode, signedTx);
        });
      });
  }
}
