const fs = require("fs");
import Web3 from "web3";
import { Constants } from "./constants";
import { ProtocolV3 } from "./protocol_v3";
import { ExchangeV3 } from "./exchange_v3";
import * as log from "./logs";

/**
 * Processes all on-chain data from Loopring in an easy to access way.
 */
export class Explorer {
  private web3: Web3;

  private universalRegistryAbi: string;

  private universalRegistryAddress: string;
  private universalRegistry: any;
  private owner: string;

  private syncedToEthereumBlockIdx: number;

  private protocols: ProtocolV3[] = [];
  private defaultProtocolAddress = Constants.zeroAddress;

  private exchanges: ExchangeV3[] = [];

  /**
   * Initializes the Explorer
   * @param   web3                       The web3 instance that will be used to get the necessary data from Ethereum
   * @param   universalRegistryAddress   The address of the universal registry address
   */
  public async initialize(
    web3: Web3,
    universalRegistryAddress: string,
    ethereumBlockFrom: number = 0
  ) {
    this.web3 = web3;
    this.universalRegistryAddress = universalRegistryAddress;
    this.syncedToEthereumBlockIdx = ethereumBlockFrom;

    const ABIPath = "ABI/version36/";
    this.universalRegistryAbi = fs.readFileSync(
      ABIPath + "IUniversalRegistry.abi",
      "ascii"
    );

    this.universalRegistry = new web3.eth.Contract(
      JSON.parse(this.universalRegistryAbi)
    );
    this.universalRegistry.options.address = this.universalRegistryAddress.toLowerCase();

    // Get the latest owner
    this.owner = await this.universalRegistry.methods.owner().call();
  }

  /**
   * Syncs the explorer up to (and including) the given Ethereum block index.
   * @param   ethereumBlockTo   The Ethereum block index to sync to
   */
  public async sync(ethereumBlockTo: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    log.DEBUG("sync from block:", this.syncedToEthereumBlockIdx + 1);
    log.DEBUG("sync to block:", ethereumBlockTo);

    // Process the events
    const events = await this.universalRegistry.getPastEvents("allEvents", {
      fromBlock: this.syncedToEthereumBlockIdx + 1,
      toBlock: ethereumBlockTo
    });
    for (const event of events) {
      if (event.event === "ProtocolRegistered") {
        await this.processProtocolRegistered(event);
      } else if (event.event === "ProtocolEnabled") {
        await this.processProtocolEnabled(event);
      } else if (event.event === "ProtocolDisabled") {
        await this.processProtocolDisabled(event);
      } else if (event.event === "DefaultProtocolChanged") {
        await this.processDefaultProtocolChanged(event);
      } else if (event.event === "ExchangeForged") {
        await this.processExchangeForged(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }

    // Sync the exchange
    for (const exchange of this.exchanges) {
      await exchange.sync(ethereumBlockTo);
    }

    // Sync the protocols
    for (const protocol of this.protocols) {
      await protocol.sync(ethereumBlockTo);
    }

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  /**
   * Syncs the explorer up to (and including) the given Ethereum block index.
   * @param   ethereumBlockTo   The Ethereum block index to sync to
   * @param   exchangeStep    The Ethereum block numbers to sync each time.
   */
  public async syncWithStep(ethereumBlockTo: number, exchangeStep: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    log.DEBUG("sync from block:", this.syncedToEthereumBlockIdx + 1);
    log.DEBUG("sync to block:", ethereumBlockTo);

    // Process the events
    const events = await this.universalRegistry.getPastEvents("allEvents", {
      fromBlock: this.syncedToEthereumBlockIdx + 1,
      toBlock: ethereumBlockTo
    });
    for (const event of events) {
      if (event.event === "ProtocolRegistered") {
        await this.processProtocolRegistered(event);
      } else if (event.event === "ProtocolEnabled") {
        await this.processProtocolEnabled(event);
      } else if (event.event === "ProtocolDisabled") {
        await this.processProtocolDisabled(event);
      } else if (event.event === "DefaultProtocolChanged") {
        await this.processDefaultProtocolChanged(event);
      } else if (event.event === "ExchangeForged") {
        await this.processExchangeForged(event);
      } else if (event.event === "OwnershipTransferred") {
        await this.processOwnershipTransferred(event);
      }
    }

    // Sync the exchange
    for (const exchange of this.exchanges) {
      await exchange.sync(this.syncedToEthereumBlockIdx);
      await exchange.syncWithStep(ethereumBlockTo, exchangeStep);
    }

    // Sync the protocols
    for (const protocol of this.protocols) {
      await protocol.sync(ethereumBlockTo);
    }

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  /**
   * Gets a protocol using the protocol's address
   * @param   address   The address of the protocol
   * @return  The protocol with the address that was given
   */
  public getProtocolByAddress(address: string) {
    for (let i = 0; i < this.protocols.length; i++) {
      if (this.protocols[i].getAddress() === address) {
        return this.protocols[i];
      }
    }
    return undefined;
  }

  /**
   * Gets a protocol using the protocol's version
   * @param   version   The version of the protocol
   * @return   The protocol with the version that was given
   */
  public getProtocolByVersion(version: string) {
    for (let i = 0; i < this.protocols.length; i++) {
      if (this.protocols[i].getVersion() === version) {
        return this.protocols[i];
      }
    }
    return undefined;
  }

  /**
   * The total number of exchanges created through the universal registry contract
   * @return  The total number of exchanges
   */
  public getNumExchanges() {
    return this.exchanges.length;
  }

  /**
   * Gets an exchange using the exchange's index in the list of all exchanges
   * @param   index   The index of the exchange
   * @return  The exchange on the given index
   */
  public getExchange(idx: number) {
    assert(idx < this.exchanges.length, "invalid index");
    return this.exchanges[idx];
  }

  /**
   * Gets an exchange using the exchange's ID
   * @param   exchangeId   The ID of the exchange
   * @return  The exchange with the ID
   */
  public getExchangeById(exchangeId: number) {
    assert(
      exchangeId > 0 && exchangeId <= this.exchanges.length,
      "invalid exchangeId"
    );
    return this.exchanges[exchangeId - 1];
  }

  /**
   * Gets an exchange using the exchange's address
   * @param   exchangeAddress   The address of the exchange
   * @return  The exchange with the given address
   */
  public getExchangeByAddress(exchangeAddress: string) {
    for (const exchange of this.exchanges) {
      if (exchange.getAddress() === exchangeAddress) {
        return exchange;
      }
    }
    return undefined;
  }

  /**
   * The total number of protocols registered in the universal registry contract
   * @return  The total number of protocols
   */
  public getNumProtocols() {
    return this.protocols.length;
  }

  /**
   * Gets a protocol using the prtoocols's index in the list of all protocols
   * @param   index   The index of the protocol
   * @return  The protocol on the given index
   */
  public getProtocol(idx: number) {
    return this.protocols[idx];
  }

  /**
   * Gets the owner of the universal registry contract
   * @return  The owner of the contract
   */
  public getOwner() {
    return this.owner;
  }

  /// Private

  private async processProtocolRegistered(event: any) {
    const version = event.returnValues.version;
    if (
      version === "3.0" ||
      version === "3.1" ||
      version === "3.5" ||
      version === "3.6"
    ) {
      const protocol = new ProtocolV3();
      protocol.initialize(
        this.web3,
        event.returnValues.protocol,
        event.returnValues.implementationManager,
        version
      );
      this.protocols.push(protocol);
      if (this.defaultProtocolAddress === Constants.zeroAddress) {
        this.defaultProtocolAddress = protocol.getAddress();
      }
    } else {
      assert(false, "unknown protocol version: " + version);
    }
  }

  private async processProtocolEnabled(event: any) {
    const protocol = this.getProtocolByAddress(event.returnValues.protocol);
    protocol.setEnabled(true);
  }

  private async processProtocolDisabled(event: any) {
    const protocol = this.getProtocolByAddress(event.returnValues.protocol);
    protocol.setEnabled(false);
  }

  private async processDefaultProtocolChanged(event: any) {
    this.defaultProtocolAddress = event.returnValues.newDefault;
  }

  private async processExchangeForged(event: any) {
    const protocol = this.getProtocolByAddress(event.returnValues.protocol);
    assert(protocol !== undefined, "unknown protocol");

    const exchange = new ExchangeV3();
    await exchange.initialize(
      this.web3,
      event.returnValues.exchangeAddress,
      parseInt(event.returnValues.exchangeId),
      event.returnValues.owner,
      parseInt(event.returnValues.forgeMode),
      protocol,
      event.returnValues.implementation
    );
    assert.equal(
      exchange.getExchangeId(),
      this.exchanges.length + 1,
      "unexpected exchange id"
    );
    this.exchanges.push(exchange);
  }

  private async processOwnershipTransferred(event: any) {
    this.owner = event.returnValues.newOwner;
  }
}
