import fs = require("fs");
import Web3 from "web3";
import * as constants from "./constants";
import { ProtocolV3 } from "./ProtocolV3";
import { ExchangeV3 } from "./ExchangeV3";

export class LoopringExplorer {
  private web3: Web3;

  private universalRegistryAbi: string;

  private universalRegistryAddress: string;
  private universalRegistry: any;
  private owner: string;

  private syncedToEthereumBlockIdx: number;

  private protocols: ProtocolV3[] = [];
  private defaultProtocolAddress = constants.zeroAddress;

  private exchanges: ExchangeV3[] = [];

  public async initialize(web3: Web3, universalRegistryAddress: string) {
    this.web3 = web3;
    this.universalRegistryAddress = universalRegistryAddress;
    this.syncedToEthereumBlockIdx = 0;

    const ABIPath = "ABI/version30/";
    this.universalRegistryAbi = fs.readFileSync(ABIPath + "IUniversalRegistry.abi", "ascii");

    this.universalRegistry = new web3.eth.Contract(JSON.parse(this.universalRegistryAbi));
    this.universalRegistry.options.address = this.universalRegistryAddress.toLowerCase();

    // Get the latest owner
    this.owner = await this.universalRegistry.methods.owner().call();
  }

  public async sync(ethereumBlockTo: number) {
    if (ethereumBlockTo <= this.syncedToEthereumBlockIdx) {
      return;
    }

    const events = await this.universalRegistry.getPastEvents("allEvents", {fromBlock: this.syncedToEthereumBlockIdx, toBlock: ethereumBlockTo});
    for (const event of events) {
      //console.log(event.event);
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

    for (const exchange of this.exchanges) {
      await exchange.sync(ethereumBlockTo);
    }

    for (const protocol of this.protocols) {
      await protocol.sync(ethereumBlockTo);
    }

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
  }

  public getProtocolByAddress(address: string) {
    for (let i = 0; i < this.protocols.length; i++) {
      if (this.protocols[i].getAddress() === address) {
        return this.protocols[i];
      }
    }
    return undefined;
  }

  public getProtocolByVersion(version: string) {
    for (let i = 0; i < this.protocols.length; i++) {
      if (this.protocols[i].getVersion() === version) {
        return this.protocols[i];
      }
    }
    return undefined;
  }

  public getNumExchanges() {
    return this.exchanges.length;
  }

  public getExchange(idx: number) {
    assert(idx < this.exchanges.length, "invalid index");
    return this.exchanges[idx];
  }

  public getExchangeById(exchangeId: number) {
    assert(exchangeId > 0 && exchangeId <= this.exchanges.length, "invalid exchangeId");
    return this.exchanges[exchangeId - 1];
  }

  public getExchangeByAddress(exchangeAddress: string) {
    for (const exchange of this.exchanges) {
      if (exchange.getAddress() === exchangeAddress) {
        return exchange;
      }
    }
    return undefined;
  }

  public getNumProtocols() {
    return this.protocols.length;
  }

  public getProtocol(idx: number) {
    return this.protocols[idx];
  }

  public getOwner() {
    return this.owner;
  }

  /// Private

  private async processProtocolRegistered(event: any) {
    const version = event.returnValues.version;
    if(version === "3.0") {
      const protocol = new ProtocolV3();
      protocol.initialize(this.web3, event.returnValues.protocol,  event.returnValues.implementationManager, version);
      this.protocols.push(protocol);
      if (this.defaultProtocolAddress === constants.zeroAddress) {
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
    await exchange.initialize(this.web3, event.returnValues.exchangeAddress, parseInt(event.returnValues.exchangeId), event.returnValues.owner,
                              JSON.parse(event.returnValues.onchainDataAvailability), parseInt(event.returnValues.forgeMode),
                              protocol, event.returnValues.implementation);
    assert(exchange.getExchangeId() === this.exchanges.length + 1, "unexpected exchange id");
    this.exchanges.push(exchange);
  }

  private async processOwnershipTransferred(event: any) {
    this.owner = event.returnValues.newOwner;
  }
}