import BN from "bn.js";
const fs = require("fs");
import Web3 from "web3";

interface StakeAmounts {
  exchangeStake: BN;
  protocolFeeStake: BN;
}

/**
 * Processes all data of the Loopring v3 protocol contract.
 */
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

  /**
   * Initializes a Protocol
   * @param   web3                           The web3 instance that will be used to get the necessary data from Ethereum
   * @param   implementationManagerAddress   The address of the implementation manager
   * @param   loopringAddress                The address of the protocol address
   * @param   version                        The version of the protocol
   */
  public async initialize(
    web3: Web3,
    loopringAddress: string,
    implementationManagerAddress: string,
    version: string
  ) {
    this.web3 = web3;
    this.loopringAddress = loopringAddress;
    this.implementationManagerAddress = implementationManagerAddress;
    this.version = version;
    this.enabled = true;

    this.syncedToEthereumBlockIdx = 0;

    const ABIPath = "ABI/version3x/";
    this.loopringAbi = fs.readFileSync(ABIPath + "ILoopringV3.abi", "ascii");

    this.loopring = new web3.eth.Contract(JSON.parse(this.loopringAbi));
    this.loopring.options.address = this.loopringAddress.toLowerCase();

    // Get the latest owner
    this.owner = await this.loopring.methods.owner().call();
  }

  /**
   * Syncs the protocol up to (and including) the given Ethereum block index.
   * @param   ethereumBlockTo   The Ethereum block index to sync to
   */
  public async sync(ethereumBlockTo: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    // Process the events
    const events = await this.loopring.getPastEvents("allEvents", {
      fromBlock: this.syncedToEthereumBlockIdx + 1,
      toBlock: ethereumBlockTo
    });
    for (const event of events) {
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

  /**
   * Gets the address of the contract
   * @return  The address of the contract
   */
  public getAddress() {
    return this.loopringAddress;
  }

  /**
   * Gets the owner of the contract
   * @return  The owner of the contract
   */
  public getOwner() {
    return this.owner;
  }

  /**
   * Gets the version of the protocol
   * @return  The version of the protcol
   */
  public getVersion() {
    return this.version;
  }

  /**
   * Gets the implementation manager contract address of the protocol
   * @return  The address of the implementation manager
   */
  public getImplementationManagerAddress() {
    return this.implementationManagerAddress;
  }

  /**
   * Returns if this protocol is enabled or not
   * @return  True if the protcol is enabled, else false
   */
  public isEnabled() {
    return this.enabled;
  }

  /**
   * Enables or disables this protocol
   * @param   enabled   True to enable, false to disable this protocol
   */
  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Returns the amount of LRC staked as exchange stake for an exchange
   * @param   exchangeId   The exchange ID of the exchange to get the exchange stake for
   * @return  The amount staked in LRC
   */
  public getExchangeStake(exchangeId: number) {
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    return this.stakeAmounts[exchangeId].exchangeStake;
  }

  /**
   * Returns the amount of LRC staked as protocol fee stake for an exchange
   * @param   exchangeId   The exchange ID of the exchange to get the protocol fee stake for
   * @return  The amount staked in LRC
   */
  public getProtocolFeeStake(exchangeId: number) {
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    return this.stakeAmounts[exchangeId].protocolFeeStake;
  }

  /// Private

  private async processExchangeStakeDeposited(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[
      exchangeId
    ].exchangeStake.add(amount);
  }

  private async processExchangeStakeWithdrawn(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[
      exchangeId
    ].exchangeStake.sub(amount);
  }

  private async processExchangeStakeBurned(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[
      exchangeId
    ].exchangeStake.sub(amount);
  }

  private async processProtocolFeeStakeDeposited(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[
      exchangeId
    ].exchangeStake.add(amount);
  }

  private async processProtocolFeeStakeWithdrawn(event: any) {
    const exchangeId = parseInt(event.returnValues.exchangeId);
    const amount = new BN(event.returnValues.amount);
    this.stakeAmounts[exchangeId] = this.stakeAmounts[exchangeId] || {
      exchangeStake: new BN(0),
      protocolFeeStake: new BN(0)
    };
    this.stakeAmounts[exchangeId].exchangeStake = this.stakeAmounts[
      exchangeId
    ].exchangeStake.sub(amount);
  }

  private async processOwnershipTransferred(event: any) {
    this.owner = event.returnValues.newOwner;
  }
}
