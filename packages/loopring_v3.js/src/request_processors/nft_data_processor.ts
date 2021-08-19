import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { BlockContext, ExchangeState } from "../types";

interface NftData {
  type?: number;
  accountID?: number;
  tokenID?: number;
  minter?: string;
  nftID?: string;
  nftType?: number;
  tokenAddress?: string;
  creatorFeeBips?: number;
}

/**
 * Processes nft data requests.
 */
export class NftDataProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    txData: Bitstream
  ) {
    const nftData = this.extractData(txData);
    return nftData;
  }

  public static extractData(data: Bitstream, offset: number = 1) {
    const nftData: NftData = {};

    nftData.type = data.extractUint8(offset);
    offset += 1;

    nftData.accountID = data.extractUint32(offset);
    offset += 4;
    nftData.tokenID = data.extractUint16(offset);
    offset += 2;
    nftData.nftID = "0x" + data.extractBytes32(offset).toString("hex");
    offset += 32;
    nftData.creatorFeeBips = data.extractUint8(offset);
    offset += 1;
    nftData.nftType = data.extractUint8(offset);
    offset += 1;
    if (nftData.type === 0) {
      nftData.minter = data.extractAddress(offset);
      offset += 20;
    } else {
      nftData.tokenAddress = data.extractAddress(offset);
      offset += 20;
    }

    return nftData;
  }
}
