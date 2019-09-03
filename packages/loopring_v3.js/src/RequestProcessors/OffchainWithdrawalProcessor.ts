import BN = require("bn.js");
import { Bitstream } from "../bitstream";
import * as constants from "../constants";
import { fromFloat } from "../float";
import {Account, Block, OffchainWithdrawal, State} from "../types";

export class OffchainWithdrawalProcessor {
  public static processBlock(state: State, block: Block) {
    const withdrawals: OffchainWithdrawal[] = [];
    if (state.onchainDataAvailability) {
      const data = new Bitstream(block.data);
      const approvedWithdrawalOffset = 4 + 32 + 32;
      let daOffset = approvedWithdrawalOffset + block.blockSize * 7 + 32;

      const operatorAccountID = data.extractUint24(daOffset);
      daOffset += 3;

      for (let i = 0; i < block.blockSize; i++) {
        const approvedWitdrawal = data.extractUint56(approvedWithdrawalOffset + i * 7);

        const tokenID = Math.floor(approvedWitdrawal / 2 ** 48) & 0xFF;
        const accountID = Math.floor(approvedWitdrawal / 2 ** 28) & 0xFFFFF;
        const amount = fromFloat(approvedWitdrawal & 0xFFFFFFF, constants.Float28Encoding);

        const feeTokenID = data.extractUint8(daOffset + i * 3);
        const fee = fromFloat(data.extractUint16(daOffset + i * 3 + 1), constants.Float16Encoding);

        const account = state.accounts[accountID];
        account.balances[tokenID] = account.balances[tokenID] || { balance: new BN(0), tradeHistory: {} };
        account.balances[feeTokenID] = account.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };

        // Update balanceF
        account.balances[feeTokenID].balance = account.balances[feeTokenID].balance.sub(fee);

        // Update balance
        account.balances[tokenID].balance = account.balances[tokenID].balance.sub(amount);
        account.nonce++;

        // Update operator
        const operator = state.accounts[operatorAccountID];
        operator.balances[feeTokenID] = operator.balances[feeTokenID] || { balance: new BN(0), tradeHistory: {} };
        operator.balances[feeTokenID].balance = operator.balances[feeTokenID].balance.add(fee);

        const offchainWithdrawal: OffchainWithdrawal = {
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID,
          tokenID,
          amount,
          feeTokenID,
          fee,
        };
        withdrawals.push(offchainWithdrawal);
      }
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const offchainWithdrawal: OffchainWithdrawal = {
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountID: 0,
          tokenID: 0,
          amount: new BN(0),
          feeTokenID: 0,
          fee: new BN(0),
        };
        withdrawals.push(offchainWithdrawal);
      }
    }
    return withdrawals;
  }

  public static revertBlock(state: State, block: Block) {
    // Nothing to do
  }
}