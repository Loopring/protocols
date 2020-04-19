import BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";
import { fromFloat } from "../float";
import { Account, Block, InternalTransfer, ExchangeState } from "../types";

/**
 * Processes internal transfer requests.
 */
export class InternalTransferProcessor {
  public static processBlock(state: ExchangeState, block: Block) {
    const data = new Bitstream(block.data);
    // Skip before and after merkle root + label + numConditionalTransfers
    let offset = 4 + 32 + 32 + 32 + 4;

    const transfers: InternalTransfer[] = [];
    if (state.onchainDataAvailability) {
      // General data
      const operatorAccountID = data.extractUint24(offset);
      offset += 3;

      // Jump to the specified transfer
      const onchainDataSize = 14;

      const startOffset = offset;
      for (let i = 0; i < block.blockSize; i++) {
        offset = startOffset + i * onchainDataSize;

        // Extract onchain data
        const type = data.extractUint8(offset);
        offset += 1;
        const accountFromID = data.extractUint24(offset);
        offset += 3;
        const accountToID = data.extractUint24(offset);
        offset += 3;
        const tokenID = data.extractUint8(offset);
        offset += 1;
        const fAmount = data.extractUint24(offset);
        offset += 3;
        const feeTokenID = data.extractUint8(offset);
        offset += 1;
        const fFee = data.extractUint16(offset);
        offset += 2;

        // Decode the float values
        const fee = fromFloat(fFee, Constants.Float16Encoding);
        const amount = fromFloat(fAmount, Constants.Float24Encoding);

        const transfer: InternalTransfer = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountFromID,
          accountToID,
          tokenID,
          amount,
          feeTokenID,
          fee,
          type
        };
        transfers.push(transfer);

        this.processInternalTransfer(state, operatorAccountID, transfer);
      }
    } else {
      for (let i = 0; i < block.blockSize; i++) {
        const transfer: InternalTransfer = {
          exchangeId: state.exchangeId,
          requestIdx: state.processedRequests.length + i,
          blockIdx: block.blockIdx,
          accountFromID: 0,
          accountToID: 0,
          tokenID: 0,
          amount: new BN(0),
          feeTokenID: 0,
          fee: new BN(0),
          type: 0
        };
        transfers.push(transfer);
      }
    }
    return transfers;
  }

  public static processInternalTransfer(
    state: ExchangeState,
    operatorAccountID: number,
    transfer: InternalTransfer
  ) {
    const accountFrom = state.accounts[transfer.accountFromID];
    const accountTo = state.accounts[transfer.accountToID];

    accountFrom.balances[transfer.tokenID] = accountFrom.balances[
      transfer.tokenID
    ] || { ...Constants.DefaultBalance };
    accountFrom.balances[transfer.feeTokenID] = accountFrom.balances[
      transfer.feeTokenID
    ] || { ...Constants.DefaultBalance };
    accountTo.balances[transfer.tokenID] = accountTo.balances[
      transfer.tokenID
    ] || { ...Constants.DefaultBalance };

    // Update balances From
    accountFrom.balances[transfer.feeTokenID].balance = accountFrom.balances[
      transfer.feeTokenID
    ].balance.sub(transfer.fee);
    accountFrom.balances[transfer.tokenID].balance = accountFrom.balances[
      transfer.tokenID
    ].balance.sub(transfer.amount);
    if (transfer.type === 0) {
      accountFrom.nonce++;
    }

    // Update balance To
    accountTo.balances[transfer.tokenID].balance = accountTo.balances[
      transfer.tokenID
    ].balance.add(transfer.amount);

    // Update operator
    const operator = state.accounts[operatorAccountID];
    operator.balances[transfer.feeTokenID] = operator.balances[
      transfer.feeTokenID
    ] || { ...Constants.DefaultBalance };
    operator.balances[transfer.feeTokenID].balance = operator.balances[
      transfer.feeTokenID
    ].balance.add(transfer.fee);
  }
}
