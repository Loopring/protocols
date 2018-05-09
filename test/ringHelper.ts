import { BigNumber } from "bignumber.js";
import { Order } from "../util/order";
import { Ring } from "../util/ring";
import { RingBalanceInfo, RingInfo } from "../util/types";

export class RingHelper {

  public tokenSymbols: string[];
  public tokenAddressSymbolMap = new Map();
  public tokenSymbolAddressMap = new Map();
  public tokenContractMap = new Map();

  constructor(tokenSymbols: string[]) {
    this.tokenSymbols = tokenSymbols;
  }

  public async init(tokenAddrFunc: (symbol: string) => Promise<string>,
                    tokenContractFunc: (symbol: string) => Promise<any>) {
    for (const symbol of this.tokenSymbols) {
      const addr = await tokenAddrFunc(symbol);
      const tokenContract = await tokenContractFunc(symbol);
      this.tokenAddressSymbolMap.set(addr, symbol);
      this.tokenSymbolAddressMap.set(symbol, addr);
      this.tokenContractMap.set(addr, tokenContract);
    }
  }

  public printRing(ring: Ring) {
    console.log("-".repeat(80));
    console.log("ring miner:", ring.owner);
    for (const order of ring.orders) {
      console.log("-".repeat(80));
      console.log("order owner:", order.owner);
      console.log("tokenS:", order.params.tokenS, "; amount:", order.params.amountS.toNumber());
      console.log("tokenB:", order.params.tokenB, "; amount:", order.params.amountB.toNumber());
      console.log("lrcFee:", order.params.lrcFee.toNumber());
      console.log("buyNoMoreThanAmountB:", order.params.buyNoMoreThanAmountB);
    }
    console.log("-".repeat(80));
  }

  public async getRingBalanceInfo(ring: Ring) {
    const participiants: string[] = [];
    const tokenBalances: number[][] = [];

    const ringSize = ring.orders.length;
    const tokenSet = new Set();
    for (let i = 0; i < ringSize; i++) {
      const order: Order = ring.orders[i];
      participiants.push(order.owner);
      participiants.push(order.params.walletAddr);

      const tokenSAddr = order.params.tokenS;
      const tokenBAddr = order.params.tokenB;
      tokenSet.add(tokenSAddr);
      tokenSet.add(tokenBAddr);
    }

    tokenSet.add(this.tokenSymbolAddressMap.get("LRC")); // add lrc address.
    const tokenList: string[] = [...tokenSet];
    const tokenSymbolList = tokenList.map((addr) => this.tokenAddressSymbolMap.get(addr));
    participiants.push(ring.owner);

    for (const participiant of participiants) {
      const participiantBalances: number[] = [];

      for (const tokenAddr of tokenList) {
        const tokenInstance = this.tokenContractMap.get(tokenAddr);
        const tokenBalance = await tokenInstance.balanceOf(participiant);
        const tokenBalanceBN = new BigNumber(tokenBalance);
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
