import BN = require("bn.js");
import fs = require("fs");
import Web3 from "web3";

interface StakeAmounts {
  exchangeStake: BN;
  protocolFeeStake: BN;
}

export class ProtocolV3 {
  private web3: Web3;

  private loopringAbi: string;

  private loopringAddress: string;
  private loopring: any;
  private owner: string;

  private implementationManagerAddress: string;
  private version: string;
  private enabled: boolean;

  private syncedToEthereumBlockIdx: number;

  private stakeAmounts: { [key: number]: StakeAmounts } = {};

  public async initialize(web3: Web3, loopringAddress: string, implementationManagerAddress: string, version: string) {
    this.web3 = web3;
    this.loopringAddress = loopringAddress;
    this.implementationManagerAddress = implementationManagerAddress;
    this.version = version;
    this.enabled = true;

    this.syncedToEthereumBlockIdx = 0;

    const ABIPath = "ABI/version30/";
    this.loopringAbi = fs.readFileSync(ABIPath + "ILoopringV3.abi", "ascii");

    this.loopring = new web3.eth.Contract(JSON.parse(this.loopringAbi));
    this.loopring.options.address = this.loopringAddress.toLowerCase();

    // Get the latest owner
    this.owner = await this.loopring.methods.owner().call();
  }

  public async sync(ethereumBlockTo: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    const events = await this.loopring.getPastEvents("allEvents", {fromBlock: this.syncedToEthereumBlockIdx, toBlock: ethereumBlockTo});
    for (const event of events) {
      //console.log(event.event);
      if (event.event === "ExchangeStakeDeposited") {
        await this.processExchangeStakeDeposited(event);
      } else if (event.event === "ExchangeStakeWithdrawn") {
        await this.processExchangeStakeWithdrawn(event);
      } else if (event.event === "ExchangeStakeBurned") {
        await this.processExchangeStakeBurned(event);
      } else if (event.event === "ProtocolFeeStakeDeposited") {
        await this.processProtocolFeeStakeDeposited(event);
      } else if (event.event === "ProtocolFeeStakeWithdrawn") {
        await this.processProtocolFeeStakeWithdrawn(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }
    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  public getAddress() {
    return this.loopringAddress;
  }

  public getOwner() {
    return this.owner;
  }

  public getVersion() {
    return this.version;
  }

  public getImplementationManagerAddress() {
    return this.implementationManagerAddress;
  }

  public isEnabled() {
    return this.enabled;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public getExchangeStake(exchangeId: number) {
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    return this.stakeAmounts[exchangeId].exchangeStake;
  }

  public getProtocolFeeStake(exchangeId: number) {
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    return this.stakeAmounts[exchangeId].protocolFeeStake;
  }

  /// Private

  private async processExchangeStakeDeposited(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[exchangeId].exchangeStake.add(amount);
  }

  private async processExchangeStakeWithdrawn(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[exchangeId].exchangeStake.sub(amount);
  }

  private async processExchangeStakeBurned(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[exchangeId].exchangeStake.sub(amount);
  }

  private async processProtocolFeeStakeDeposited(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[exchangeId].exchangeStake.add(amount);
  }

  private async processProtocolFeeStakeWithdrawn(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || { exchangeStake: new BN(0), protocolFeeStake: new BN(0) };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[exchangeId].exchangeStake.sub(amount);
  }

  private async processOwnershipTransferred(event: any) {
    this.owner = event.returnValues.newOwner;
  }
}