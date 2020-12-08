import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { Account, BlockContext, ExchangeState } from "../types";

interface AmmUpdate {
  owner?: string;
  accountID?: number;
  tokenID?: number;
  feeBips?: number;
  tokenWeight?: BN;
  nonce?: number;
  balance?: BN;
}

/**
 * Processes amm update requests.
 */
export class AmmUpdateProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const update = this.extractData(txData);

    const account = state.getAccount(update.accountID);
    const balance = account.getBalance(update.tokenID);

    account.nonce++;
    account.feeBipsAMM = update.feeBips;
    balance.weightAMM = update.tokenWeight;

    return update;
  }

  public static extractData(data: Bitstream) {
    const update: AmmUpdate = {};
    let offset = 1;

    // Read in the AMM update data
    update.owner = data.extractAddress(offset);
    offset += 20;
    update.accountID = data.extractUint32(offset);
    offset += 4;
    update.tokenID = data.extractUint16(offset);
    offset += 2;
    update.feeBips = data.extractUint8(offset);
    offset += 1;
    update.tokenWeight = data.extractUint96(offset);
    offset += 12;
    update.nonce = data.extractUint32(offset);
    offset += 4;
    update.balance = data.extractUint96(offset);
    offset += 12;

    return update;
  }
}
