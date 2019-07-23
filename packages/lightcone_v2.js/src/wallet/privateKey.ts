// @ts-ignore
import {ethereum} from '../lib/wallet';
import * as fm from '../lib/wallet/common/formatter';
import config from '../lib/wallet/config';
import * as datas from '../lib/wallet/config/data';
import Contracts from '../lib/wallet/ethereum/contracts/Contracts';
import Eth from '../lib/wallet/ethereum/eth';
import Transaction from '../lib/wallet/ethereum/transaction';
import {KeyAccount} from '../lib/wallet/ethereum/walletAccount';
import {exchange} from '../sign/exchange';

export class PrivateKey {

    public account: KeyAccount;
    public address: string;
    public ethNode: Eth;

    public constructor() {
        this.ethNode = new Eth(''); // TODO: config
        // this.account = walletUtil.fromPrivateKey('');
    }

    public getAddress() {
        return this.account.getAddress();
    }

    /**
     * Transfer token
     * @param toAddr string to address
     * @param symbol string symbol of token to transfer
     * @param amount number amount to transfer, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async transfer(toAddr: string, symbol: string, amount: number, gasPrice: number) {
        let to, value, data: string;
        const token = config.getTokenBySymbol(symbol);
        value = fm.toHex(fm.toBig(amount).times('1e' + token.digits));
        if (symbol === 'ETH') {
            to = toAddr;
            data = fm.toHex('0x');
        } else {
            to = token.address;
            data = ethereum.abi.Contracts.ERC20Token.encodeInputs('transfer', {
                _to: to,
                _value: value
            });
            value = '0x0';
        }
        const rawTx = new Transaction({
            to: to,
            value: value,
            data: data,
            chainId: config.getChainId(),
            nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
            gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
            gasLimit: fm.toHex(config.getGasLimitByType('token_transfer').gasLimit) // TODO: new gas limit
        });
        const signedTx = this.account.signEthereumTx(rawTx);

        return this.account.sendTransaction(this.ethNode, signedTx);
    }

    /**
     * Approve
     * @param symbol approve token symbol
     * @param amount number amount to approve, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async approve(symbol: string, amount: number, gasPrice: number) {
        const token = config.getTokenBySymbol(symbol);
        const rawTx = new Transaction({
            to: token.address,
            value: '0x0',
            data: Contracts.ERC20Token.encodeInputs('approve', {
                _spender: datas.configs.delegateAddress,
                _value: amount
            }),
            chainId: config.getChainId(),
            nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
            gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
            gasLimit: fm.toHex(config.getGasLimitByType('approve').gasLimit)
        });
        const signedTx = this.account.signEthereumTx(rawTx);

        return this.account.sendTransaction(this.ethNode, signedTx);
    }

    /**
     * Convert eth -> weth
     * @param amount number amount to deposit, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async deposit(amount: number, gasPrice: number) {
        const weth = config.getTokenBySymbol('WETH');
        const value = fm.toHex(fm.toBig(amount).times(1e18));
        const rawTx = new Transaction({
            to: weth.address,
            value: value,
            data: Contracts.WETH.encodeInputs('deposit', {}),
            chainId: config.getChainId(),
            nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
            gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
            gasLimit: fm.toHex(config.getGasLimitByType('deposit').gasLimit)
        });
        const signedTx = this.account.signEthereumTx(rawTx);

        return this.account.sendTransaction(this.ethNode, signedTx);
    }

    /**
     * Convert weth -> eth
     * @param amount number amount to withdraw, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async withdraw(amount: number, gasPrice: number) {
        const weth = config.getTokenBySymbol('WETH');
        const value = fm.toHex(fm.toBig(amount).times(1e18));
        const rawTx = new Transaction({
            to: weth.address,
            value: '0x0',
            data: Contracts.WETH.encodeInputs('withdraw', {
                wad: value
            }),
            chainId: config.getChainId(),
            nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
            gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
            gasLimit: fm.toHex(config.getGasLimitByType('withdraw').gasLimit)
        });
        const signedTx = this.account.signEthereumTx(rawTx);

        return this.account.sendTransaction(this.ethNode, signedTx);
    }

    /**
     * Deposit to Dex
     * @param symbol string symbol of token to deposit
     * @param amount number amount to deposit, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async depositTo(symbol: string, amount: number, gasPrice: number) {
        exchange.deposit(this.account, symbol, amount, gasPrice).then((rawTx: Transaction) => {
            const signedTx = this.account.signEthereumTx(rawTx);
            return this.account.sendTransaction(this.ethNode, signedTx);
        });
    }

    /**
     * Withdraw from Dex
     * @param symbol string symbol of token to withdraw
     * @param amount number amount to withdraw, e.g. 1.5
     * @param gasPrice in gwei
     */
    public async withdrawFrom(symbol: string, amount: number, gasPrice: number) {
        exchange.withdraw(this.account, symbol, amount, gasPrice).then((rawTx: Transaction) => {
            const signedTx = this.account.signEthereumTx(rawTx);

            return this.account.sendTransaction(this.ethNode, signedTx);
        });
    }
}

export const privateKey: PrivateKey = new PrivateKey();
