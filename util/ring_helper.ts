import { BigNumber } from "bignumber.js";
import { ChainReader } from "./chain_reader";
import { Order } from "./order";
import { Ring } from "./ring";
import { RingBalanceInfo, RingInfo } from "./types";

export class RingHelper {

  public tokenRegistryAddress: string;
  public chainReader: ChainReader;

  constructor(tokenRegistryAddress: string) {
    this.tokenRegistryAddress = tokenRegistryAddress;
    this.chainReader = new ChainReader();
  }

  public printRing(ring: Ring) {
    console.log("-".repeat(80));
    console.log("ring miner:", ring.owner);
    for (const order of ring.orders) {
      console.log("-".repeat(80));
      console.log("order owner:", order.owner);
      console.log("order params:", order.params);
    }
    console.log("-".repeat(80));
  }

  public async getRingBalanceInfo(ring: Ring) {
    const ringSize = ring.orders.length;
    const tokenSet = new Set();
    const participiantSet = new Set();
    for (let i = 0; i < ringSize; i++) {
      const order: Order = ring.orders[i];
      participiantSet.add(order.owner);
      participiantSet.add(order.params.walletAddr);
      tokenSet.add(order.params.tokenS);
    }
    const lrcAddr = this.chainReader.getTokenAddressBySymbol(this.tokenRegistryAddress, "LRC");
    tokenSet.add(lrcAddr);

    const tokenList: string[] = [...tokenSet];
    const tokenSymbolList: string[] = [];
    participiantSet.add(ring.owner);
    const participiants = [...participiantSet];

    const tokenBalances: number[][] = [];
    for (const participiant of participiants) {
      const participiantBalances: number[] = [];

      for (const tokenAddr of tokenList) {
        const tokenSymbol = await this.chainReader.getTokenSymbolByAddress(this.tokenRegistryAddress, tokenAddr);
        const tokenBalance = await this.chainReader.getERC20TokenBalance(tokenAddr, participiant);
        const tokenBalanceBN = new BigNumber(tokenBalance);

        tokenSymbolList.push(tokenSymbol);
        participiantBalances.push(tokenBalanceBN.toNumber());
      }

      tokenBalances.push(participiantBalances);
    }

    const balanceInfo: RingBalanceInfo = {
      participiants,
      tokenAddressList: tokenList,
      tokenSymbolList,
      tokenBalances,
    };

    return balanceInfo;
  }

}
