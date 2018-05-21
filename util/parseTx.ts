import BN = require("bn.js");
import txDecoder = require("ethereum-tx-decoder");
import abi = require("ethereumjs-abi");
import {RawTx, RingInfo} from "./types";

export class TxParser {
  public protocolAbi: string;

  constructor(protocolAbi: string) {
    this.protocolAbi = protocolAbi;
  }

  public parseSubmitRingTx(txRaw: RawTx) {
    const fnDecoder = new txDecoder.FunctionDecoder(this.protocolAbi);
    const decodedTx = txDecoder.decodeTx(txRaw.content);
    const arrayish = fnDecoder.decodeFn(decodedTx.data);

    const miner = arrayish[7];

    const orderOwners: string[] = [];
    const tokenAddressList: string[] = [];
    for (const addrs of arrayish[0]) {
      orderOwners.push(addrs[0]);
      tokenAddressList.push(addrs[1]);
    }

    const amountSList: number[] = [];
    const amountBList: number[] = [];
    const lrcFeeAmountList: number[] = [];
    for (const amounts of arrayish[1]) {
      amountSList.push(this.bnToNumber(amounts[0]));
      amountBList.push(this.bnToNumber(amounts[1]));
      lrcFeeAmountList.push(this.bnToNumber(amounts[4]));
    }

    const marginSplitPercentageList = [].concat(...arrayish[2]); // flatten array
    const buyNoMoreThanAmountBList = arrayish[3];

    const feeSelectionNumber = arrayish[8];
    const ringSize = tokenAddressList.length;
    const feeSelections = this.feeSelectionNumberToArray(feeSelectionNumber, ringSize);

    const ringInfo: RingInfo = {
      amountSList,
      amountBList,
      lrcFeeAmountList,
      miner,
      orderOwners,
      tokenAddressList,
      marginSplitPercentageList,
      buyNoMoreThanAmountBList,
      feeSelections,
      description: "raw tx " + txRaw.id,
      id: txRaw.id,
      verbose: txRaw.verbose,
    };

    return ringInfo;
  }

  private feeSelectionNumberToArray(fsn: number, ringSize: number) {
    const feeSelectionList: number[] = [];
    for (let i = ringSize - 1; i >= 0; i--) {
      const feeSelection = (fsn >> i) % 2;
      feeSelectionList.push(feeSelection);
    }
    return feeSelectionList;
  }

  private bnToNumber(bn: any) {
    const bnStr = bn.toString(10);
    return parseInt(bnStr, 10);
  }

}
