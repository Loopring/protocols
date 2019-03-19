import { BigNumber } from "bignumber.js";
import fs = require("fs");
import Web3 = require("web3");

export class ChainReader {
  private web3Instance: Web3;
  private ERC20Contract: any;
  private DelegateContract: any;
  private TokenRegistryContract: any;
  private connected: boolean;

  constructor() {
    try {
      if (web3) {
        this.web3Instance = web3; // inject by truffle.
      } else {
        this.web3Instance = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
        // connect to main-net via a public node:
        // new Web3.providers.HttpProvider('https://api.myetherapi.com/eth')
      }
      this.connected = true;
    } catch (err) {
      console.log("get web3 instance in class ChainReader failed. err:", err);
      this.connected = false;
      throw err;
    }

    const erc20Abi = fs.readFileSync("ABI/version151/ERC20.abi", "ascii");
    const delegateAbi = fs.readFileSync("ABI/version151/TokenTransferDelegate.abi", "ascii");
    const tokenRegistryAbi = fs.readFileSync("ABI/version151/TokenRegistryImpl.abi", "ascii");
    this.ERC20Contract = this.web3Instance.eth.contract(JSON.parse(erc20Abi));
    this.DelegateContract = this.web3Instance.eth.contract(JSON.parse(delegateAbi));
    this.TokenRegistryContract = this.web3Instance.eth.contract(JSON.parse(tokenRegistryAbi));
  }

  public isConnected() {
    return this.connected;
  }

  public async getERC20TokenBalance(tokenAddr: string, ownerAddr: string) {
    const tokenContractInstance = this.ERC20Contract.at(tokenAddr);
    const balance = await tokenContractInstance.balanceOf(ownerAddr);
    const balanceBN = new BigNumber(balance);
    return balanceBN.toNumber();
  }

  public async getERC20TokenAllowance(tokenAddr: string,
                                      ownerAddr: string,
                                      spenderAddr: string) {
    const tokenContractInstance = this.ERC20Contract.at(tokenAddr);
    const balance = await tokenContractInstance.allowance(ownerAddr, spenderAddr);
    const balanceBN = new BigNumber(balance);
    return balanceBN.toNumber();
  }

  public async getERC20TokenSpendable(tokenAddr: string,
                                      ownerAddr: string,
                                      spenderAddr: string) {
    const balance = await this.getERC20TokenBalance(tokenAddr, ownerAddr);
    const allowance = await this.getERC20TokenAllowance(tokenAddr, ownerAddr, spenderAddr);
    return Math.min(balance, allowance);
  }

  public async getOrderCancelledOrFilledAmount(orderHash: string, delegateAddr: string) {
    const delegateContractInstance = this.DelegateContract.at(delegateAddr);
    const amount = await delegateContractInstance.cancelledOrFilled(orderHash);
    const amountBN = new BigNumber(amount);
    return amount.toNumber();
  }

  public async getTokenAddressBySymbol(tokenRegistryAddr: string,
                                       symbol: string) {
    const tokenRegistryInstance = this.TokenRegistryContract.at(tokenRegistryAddr);
    const tokenAddr = await tokenRegistryInstance.getAddressBySymbol(symbol);
    return tokenAddr;
  }

  public async getTokenSymbolByAddress(tokenRegistryAddr: string,
                                       tokenAddr: string) {
    const tokenRegistryInstance = this.TokenRegistryContract.at(tokenRegistryAddr);
    const tokenInfo = await tokenRegistryInstance.addressMap(tokenAddr);
    return tokenInfo[1];
  }

}
