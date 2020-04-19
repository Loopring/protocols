import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { Account, Block, OnchainWithdrawal, ExchangeState } from "../types";

/**
 * Processes on-chain withdrawal requests.
 */
export class OnchainWithdrawalProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
    let offset = 4 + 32 + 32 + 32 + 32;
    const data = new Bitstream(block.data);
    const startIdx = data.extractUint32(offset);
    offset += 4;
    const length = data.extractUint32(offset);
    offset += 4;

    const shutdown = length === 0;

    const withdrawals: OnchainWithdrawal[] = [];
    for (let i = 0; i < (shutdown ? block.blockSize : length); i++) {
      const approvedWitdrawal = data.extractUint56(offset + i * 7);

      const tokenID = approvedWitdrawal.shrn(48).toNumber() & 0xff;
      const accountID = approvedWitdrawal.shrn(24).toNumber() & 0xffffff;
      const amountWithdrawn = fromFloat(
        approvedWitdrawal.and(new BN("FFFFFF", 16)).toNumber(),
        Constants.Float24Encoding
      );

      if (!shutdown) {
        const onchainWithdrawal = state.onchainWithdrawals[startIdx + i];
        assert.equal(tokenID, onchainWithdrawal.tokenID, "unexpected tokenID");
        assert.equal(
          accountID,
          onchainWithdrawal.accountID,
          "unexpected accountID"
        );

        onchainWithdrawal.amountWithdrawn = amountWithdrawn;
        onchainWithdrawal.blockIdx = block.blockIdx;
        onchainWithdrawal.requestIdx = state.processedRequests.length + i;
        withdrawals.push(onchainWithdrawal);

        this.processOnchainWithdrawal(state, shutdown, onchainWithdrawal);
      } else {
        const onchainWithdrawal: OnchainWithdrawal = {
          exchangeId: state.exchangeId,
          withdrawalIdx: 0,
          timestamp: 0,
          accountID,
          tokenID,
          amountRequested: new BN(0),
          amountWithdrawn,
          transactionHash: Constants.zeroAddress
        };
        this.processOnchainWithdrawal(state, shutdown, onchainWithdrawal);
      }
    }
    return withdrawals;
  }

  public static processOnchainWithdrawal(
    state: ExchangeState,
    shutdown: boolean,
    onchainWithdrawal: OnchainWithdrawal
  ) {
    // When a withdrawal is done before the deposit (account creation) we shouldn't
    // do anything. Just leave everything as it is.
    if (onchainWithdrawal.accountID < state.accounts.length) {
      const account = state.accounts[onchainWithdrawal.accountID];
      account.balances[onchainWithdrawal.tokenID] = account.balances[
        onchainWithdrawal.tokenID
      ] || { balance: new BN(0), tradeHistory: {} };

      const balance = account.balances[onchainWithdrawal.tokenID].balance;
      const amountToSubtract = shutdown
        ? balance
        : onchainWithdrawal.amountWithdrawn;

      // Update balance
      account.balances[onchainWithdrawal.tokenID].balance = account.balances[
        onchainWithdrawal.tokenID
      ].balance.sub(amountToSubtract);

      if (shutdown) {
        account.publicKeyX = "0";
        account.publicKeyY = "0";
        account.nonce = 0;
        account.balances[onchainWithdrawal.tokenID].tradeHistory = {};
      }
    }
  }
}
