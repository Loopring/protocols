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

  private syncedToEthereumBlockIdx: number;

  private exchanges: ExchangeV3[] = [];

  /**
   * Initializes the Explorer
   * @param   web3   The web3 instance that will be used to get the necessary data from Ethereum
   * @param   ethereumBlockFrom   The Ethereum block index to sync from
   */
  public async initialize(web3: Web3, ethereumBlockFrom: number = 0) {
    this.web3 = web3;
    this.syncedToEthereumBlockIdx = ethereumBlockFrom;
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

    // Sync the exchange
    for (const exchange of this.exchanges) {
      await exchange.sync(ethereumBlockTo);
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

    // Sync the exchange
    for (const exchange of this.exchanges) {
      await exchange.sync(this.syncedToEthereumBlockIdx);
      await exchange.syncWithStep(ethereumBlockTo, exchangeStep);
    }

    this.syncedToEthereumBlockIdx = ethereumBlockTo;
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
   * @param   idx   The index of the exchange
   * @return  The exchange on the given index
   */
  public getExchange(idx: number) {
    assert(idx < this.exchanges.length, "invalid index");
    return this.exchanges[idx];
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
   * Add an exchange to track
   * @param   exchangeAddress   The address of the exchange
   * @param   owner   The owner of the exchange
   */
  public async addExchange(exchangeAddress: string, owner: string) {
    const exchange = new ExchangeV3();
    await exchange.initialize(this.web3, exchangeAddress, owner);
    this.exchanges.push(exchange);
  }
}
