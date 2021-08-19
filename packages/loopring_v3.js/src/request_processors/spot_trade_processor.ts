import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import {
  AccountLeaf,
  BalanceLeaf,
  BlockContext,
  ExchangeState,
  SpotTrade
} from "../types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeSA: BN;
  feeBA: BN;
  protocolFeeSA: BN;
  protocolFeeBA: BN;

  fillSB: BN;
  fillBB: BN;
  feeSB: BN;
  feeBB: BN;
  protocolFeeSB: BN;
  protocolFeeBB: BN;
}

/**
 * Processes spot trade requests.
 */
export class SpotTradeProcessor {
  public static process(
    state: ExchangeState,
    block: BlockContext,
    data: Bitstream
  ) {
    let offset = 1;

    // Storage IDs
    const storageIdA = data.extractUint32(offset);
    offset += 4;
    const storageIdB = data.extractUint32(offset);
    offset += 4;

    // Accounts
    const accountIdA = data.extractUint32(offset);
    offset += 4;
    const accountIdB = data.extractUint32(offset);
    offset += 4;

    // Tokens
    const tokenAS = data.extractUint16(offset);
    offset += 2;
    const tokenBS = data.extractUint16(offset);
    offset += 2;

    // Fills
    const fFillSA = data.extractUint24(offset);
    offset += 3;
    const fFillSB = data.extractUint24(offset);
    offset += 3;

    // Order data
    const orderDataA = data.extractUint8(offset);
    offset += 1;
    const orderDataB = data.extractUint8(offset);
    offset += 1;

    // Target tokenIDs
    let tokenAB = data.extractUint16(offset);
    offset += 2;
    let tokenBB = data.extractUint16(offset);
    offset += 2;

    // Extra fee data
    let feeBipsHiA = data.extractUint8(offset);
    offset += 1;
    let feeBipsHiB = data.extractUint8(offset);
    offset += 1;

    // Further extraction of packed data
    const limitMaskA = orderDataA & 0b10000000;
    const feeBipsA = (feeBipsHiA << 6) | (orderDataA & 0b00111111);
    const fillAmountBorSA = limitMaskA > 0;

    const limitMaskB = orderDataB & 0b10000000;
    const feeBipsB = (feeBipsHiB << 6) | (orderDataB & 0b00111111);
    const fillAmountBorSB = limitMaskB > 0;

    // Decode the float values
    const fillSA = fromFloat(fFillSA, Constants.Float24Encoding);
    const fillSB = fromFloat(fFillSB, Constants.Float24Encoding);

    // Decode target tokenIDs
    tokenAB = tokenAB !== 0 ? tokenAB : tokenBS;
    tokenBB = tokenBB !== 0 ? tokenBB : tokenAS;

    const s = this.calculateSettlementValues(
      tokenAS,
      tokenBS,
      block.protocolFeeTakerBips,
      block.protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB
    );

    // Update accountA
    {
      const accountA = state.getAccount(accountIdA);
      accountA
        .getBalance(tokenAS)
        .balance.isub(s.fillSA)
        .isub(s.feeSA);
      accountA
        .getBalance(tokenAB)
        .balance.iadd(s.fillBA)
        .isub(s.feeBA);

      // virtual balances
      if (
        tokenAS < Constants.NFT_TOKEN_ID_START &&
        tokenAB < Constants.NFT_TOKEN_ID_START &&
        accountA.getBalance(tokenAS).weightAMM.gt(new BN(0)) &&
        accountA.getBalance(tokenAB).weightAMM.gt(new BN(0))
      ) {
        accountA.getBalance(tokenAS).weightAMM.isub(s.fillSA);
        accountA.getBalance(tokenAB).weightAMM.iadd(s.fillBA);
      }

      const tradeHistoryA = accountA.getBalance(tokenAS).getStorage(storageIdA);
      if (tradeHistoryA.storageID !== storageIdA) {
        tradeHistoryA.data = new BN(0);
      }
      tradeHistoryA.storageID = storageIdA;
      tradeHistoryA.data.iadd(fillAmountBorSA ? s.fillBA : s.fillSA);

      if (Constants.isNFT(tokenAS)) {
        const accountB = state.getAccount(accountIdB);
        const nftData = accountA.getBalance(tokenAS).weightAMM;
        if (accountA.getBalance(tokenAS).balance.eq(new BN(0))) {
          accountA.getBalance(tokenAS).weightAMM = new BN(0);
        }
        accountB.getBalance(tokenBB).weightAMM = nftData;
      }
    }
    // Update accountB
    {
      const accountB = state.getAccount(accountIdB);
      accountB
        .getBalance(tokenBS)
        .balance.isub(s.fillSB)
        .isub(s.feeSB);
      accountB
        .getBalance(tokenBB)
        .balance.iadd(s.fillBB)
        .isub(s.feeBB);

      // virtual balances
      if (
        tokenBS < Constants.NFT_TOKEN_ID_START &&
        tokenBB < Constants.NFT_TOKEN_ID_START &&
        accountB.getBalance(tokenBS).weightAMM.gt(new BN(0)) &&
        accountB.getBalance(tokenBB).weightAMM.gt(new BN(0))
      ) {
        accountB.getBalance(tokenBS).weightAMM.isub(s.fillBA);
        accountB.getBalance(tokenBB).weightAMM.iadd(s.fillSA);
      }

      const tradeHistoryB = accountB.getBalance(tokenBS).getStorage(storageIdB);
      if (tradeHistoryB.storageID !== storageIdB) {
        tradeHistoryB.data = new BN(0);
      }
      tradeHistoryB.storageID = storageIdB;
      tradeHistoryB.data.iadd(fillAmountBorSB ? s.fillBB : s.fillSB);

      if (Constants.isNFT(tokenBS)) {
        const accountA = state.getAccount(accountIdA);
        const nftData = accountB.getBalance(tokenBS).weightAMM;
        if (accountB.getBalance(tokenBS).balance.eq(new BN(0))) {
          accountB.getBalance(tokenBS).weightAMM = new BN(0);
        }
        accountA.getBalance(tokenAB).weightAMM = nftData;
      }
    }

    // Update protocol fee
    const protocol = state.getAccount(0);
    protocol
      .getBalance(tokenAS)
      .balance.iadd(s.protocolFeeSA)
      .iadd(s.protocolFeeBB);
    protocol
      .getBalance(tokenBS)
      .balance.iadd(s.protocolFeeBA)
      .iadd(s.protocolFeeSB);

    // Update operator
    const operator = state.getAccount(block.operatorAccountID);
    operator
      .getBalance(tokenAS)
      .balance.iadd(s.feeSA)
      .iadd(s.feeBB)
      .isub(s.protocolFeeSA)
      .isub(s.protocolFeeBB);
    operator
      .getBalance(tokenBS)
      .balance.iadd(s.feeBA)
      .iadd(s.feeSB)
      .isub(s.protocolFeeBA)
      .isub(s.protocolFeeSB);

    // Create struct
    const trade: SpotTrade = {
      exchange: state.exchange,
      requestIdx: state.processedRequests.length,
      blockIdx: /*block.blockIdx*/ 0,

      accountIdA,
      orderIdA: storageIdA,
      fillAmountBorSA,
      tokenAS,
      tokenAB,
      fillSA: s.fillSA,
      feeA: s.feeBA,
      protocolFeeA: s.protocolFeeBA,

      accountIdB,
      orderIdB: storageIdB,
      fillAmountBorSB,
      tokenBS,
      tokenBB,
      fillSB: s.fillSB,
      feeB: s.feeBB,
      protocolFeeB: s.protocolFeeBB
    };

    return trade;
  }

  private static calculateSettlementValues(
    tokenAS: number,
    tokenBS: number,
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    fillSA: BN,
    fillSB: BN,
    feeBipsA: number,
    feeBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;

    const feeBipsSA = !Constants.isNFT(tokenBS) ? 0 : feeBipsA;
    const feeBipsBA = !Constants.isNFT(tokenBS) ? feeBipsA : 0;
    const feeBipsSB = !Constants.isNFT(tokenAS) ? 0 : feeBipsB;
    const feeBipsBB = !Constants.isNFT(tokenAS) ? feeBipsB : 0;

    const allNFT = Constants.isNFT(tokenAS) && Constants.isNFT(tokenBS);
    const _protocolTakerFeeBips = allNFT ? 0 : protocolFeeTakerBips;
    const _protocolMakerFeeBips = allNFT ? 0 : protocolFeeMakerBips;
    const protocolFeeBipsSA = !Constants.isNFT(tokenBS)
      ? 0
      : _protocolTakerFeeBips;
    const protocolFeeBipsBA = !Constants.isNFT(tokenBS)
      ? _protocolTakerFeeBips
      : 0;
    const protocolFeeBipsSB = !Constants.isNFT(tokenAS)
      ? 0
      : _protocolMakerFeeBips;
    const protocolFeeBipsBB = !Constants.isNFT(tokenAS)
      ? _protocolMakerFeeBips
      : 0;

    const [feeSA, protocolFeeSA] = this.calculateFees(
      fillSA,
      protocolFeeBipsSA,
      feeBipsSA
    );
    const [feeBA, protocolFeeBA] = this.calculateFees(
      fillBA,
      protocolFeeBipsBA,
      feeBipsBA
    );
    const [feeSB, protocolFeeSB] = this.calculateFees(
      fillSB,
      protocolFeeBipsSB,
      feeBipsSB
    );
    const [feeBB, protocolFeeBB] = this.calculateFees(
      fillBB,
      protocolFeeBipsBB,
      feeBipsBB
    );

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeSA,
      feeBA,
      protocolFeeSA,
      protocolFeeBA,

      fillSB,
      fillBB,
      feeSB,
      feeBB,
      protocolFeeSB,
      protocolFeeBB
    };
    return settlementValues;
  }

  private static calculateFees(
    fillB: BN,
    protocolFeeBips: number,
    feeBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    return [fee, protocolFee];
  }
}
