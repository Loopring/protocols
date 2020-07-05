import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { Account, Block, OffchainWithdrawal, ExchangeState } from "../types";

/**
 * Processes off-chain withdrawal requests.
 */
export class OffchainWithdrawalProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
    const withdrawals: OffchainWithdrawal[] = [];
    if (state.onchainDataAvailability) {
      const data = new Bitstream(block.data);
      const approvedWithdrawalOffset = 4 + 32 + 32;
      let daOffset = approvedWithdrawalOffset + block.blockSize * 8;

      const operatorAccountID = data.extractUint24(daOffset);
      daOffset += 3;

      for (let i = 0; i < block.blockSize; i++) {
        const approvedWitdrawal = data.extractUint64(
          approvedWithdrawalOffset + i * 8
        );

        const tokenID = approvedWitdrawal.shrn(48).toNumber() & 0xffff;
        const accountID = approvedWitdrawal.shrn(24).toNumber() & 0xffffff;
        const amountWithdrawn = fromFloat(
          approvedWitdrawal.and(new BN("FFFFFF", 16)).toNumber(),
          Constants.Float24Encoding
        );

        const feeTokenID = data.extractUint16(daOffset + i * 4);
        const fee = fromFloat(
          data.extractUint16(daOffset + i * 4 + 2),
          Constants.Float16Encoding
        );

        const offchainWithdrawal: OffchainWithdrawal = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID,
          tokenID,
          amountWithdrawn,
          feeTokenID,
          fee
        };
        withdrawals.push(offchainWithdrawal);

        this.processOffchainWithdrawal(
          state,
          operatorAccountID,
          offchainWithdrawal
        );
      }
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const offchainWithdrawal: OffchainWithdrawal = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID: 0,
          tokenID: 0,
          amountWithdrawn: new BN(0),
          feeTokenID: 0,
          fee: new BN(0)
        };
        withdrawals.push(offchainWithdrawal);
      }
    }
    return withdrawals;
  }

  public static processOffchainWithdrawal(
    state: ExchangeState,
    operatorAccountID: number,
    offchainWithdrawal: OffchainWithdrawal
  ) {
    const account = state.accounts[offchainWithdrawal.accountID];
    account.balances[offchainWithdrawal.tokenID] = account.balances[
      offchainWithdrawal.tokenID
    ] || { balance: new BN(0), index: new BN(0), tradeHistory: {} };
    account.balances[offchainWithdrawal.feeTokenID] = account.balances[
      offchainWithdrawal.feeTokenID
    ] || { balance: new BN(0), index: new BN(0), tradeHistory: {} };

    // Update balanceF
    account.balances[offchainWithdrawal.feeTokenID].balance = account.balances[
      offchainWithdrawal.feeTokenID
    ].balance.sub(offchainWithdrawal.fee);

    // Update balance
    account.balances[offchainWithdrawal.tokenID].balance = account.balances[
      offchainWithdrawal.tokenID
    ].balance.sub(offchainWithdrawal.amountWithdrawn);
    account.nonce++;

    // Update operator
    const operator = state.accounts[operatorAccountID];
    operator.balances[offchainWithdrawal.feeTokenID] = operator.balances[
      offchainWithdrawal.feeTokenID
    ] || { balance: new BN(0), index: new BN(0), tradeHistory: {} };
    operator.balances[
      offchainWithdrawal.feeTokenID
    ].balance = operator.balances[offchainWithdrawal.feeTokenID].balance.add(
      offchainWithdrawal.fee
    );
  }
}
