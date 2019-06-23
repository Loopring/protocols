import Web3 from 'web3';

import {MetaMaskAccount} from 'lib/wallet/ethereum/walletAccount';
import Transaction from 'lib/wallet/ethereum/transaction';
import walletUtil = require('lib/wallet/WalletUtils');
import {exchange} from "../sign/exchange";
import Eth from "../../lib/wallet/ethereum/eth";

export class MetaMask {

    public web3: Web3;
    public address: string;
    public ethNode: Eth;
    public account: MetaMaskAccount;

    public constructor() {
        this.web3 = new Web3(Web3.givenProvider || 'http://localhost:8545'); // TODO: replace for ruby
        this.account = walletUtil.fromMetaMask(this.web3);
        this.address = this.account.getAddress();
        this.ethNode = new Eth('') // TODO: config
    }

    public async createOrUpdateAccount(publicX: string, publicY: string, gasPrice: number) {
        exchange.createOrUpdateAccount(publicX, publicY, gasPrice).then((rawTx: Transaction) => {
            this.account.signEthereumTx(rawTx).then((signedTx) => {
                return this.account.sendTransaction(this.ethNode, signedTx)
            });
        })
    }

    public async depositTo(symbol: string, amount: number, gasPrice: number) {
        exchange.deposit(symbol, amount, gasPrice).then((rawTx: Transaction) => {
            this.account.signEthereumTx(rawTx).then((signedTx) => {
                return this.account.sendTransaction(this.ethNode, signedTx)
            });
        })
    }

    public async withdrawFrom(symbol: string, amount: number, gasPrice: number) {
        exchange.withdraw(symbol, amount, gasPrice).then((rawTx: Transaction) => {
            this.account.signEthereumTx(rawTx).then((signedTx) => {
                return this.account.sendTransaction(this.ethNode, signedTx)
            });
        })
    }
}

export const metaMask: MetaMask = new MetaMask();
