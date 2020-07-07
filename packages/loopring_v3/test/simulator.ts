import BN = require("bn.js");
import fs = require("fs");
import { Constants } from "loopringV3.js";
import { roundToFloatValue } from "loopringV3.js";
import { logDebug, logInfo } from "./logs";
import {
  Deposit,
  OrderInfo,
  SpotTrade,
  WithdrawalRequest,
  Transfer,
  TxBlock,
  AccountUpdate,
  NewAccount,
  OwnerChange
} from "./types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  protocolFeeA: BN;
  rebateA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  protocolFeeB: BN;
  rebateB: BN;
}

interface Fill {
  S: BN;
  B: BN;
}

interface MatchResult {
  spread: BN;
  matchable: boolean;
}

function applyInterest(balance: BN, oldIndex: BN, newIndex: BN) {
  assert(newIndex.gte(oldIndex), "Invalid balance state");
  const indexDiff = newIndex.sub(oldIndex);
  const balanceDiff = balance.mul(indexDiff).div(Constants.INDEX_BASE);
  const newBalance = balance.add(balanceDiff)
  return newBalance
}


export class TradeHistory {
  filled: BN;
  orderID: number;

  constructor() {
    this.filled = new BN(0);
    this.orderID = 0;
  }
}

export class Balance {
  balance: BN;
  index: BN;
  tradeHistory: { [key: number]: TradeHistory };

  constructor() {
    this.balance = new BN(0);
    this.index = new BN(0);
    this.tradeHistory = {};
  }

  public init(
    balance: BN,
    index: BN,
    tradeHistory: { [key: number]: TradeHistory }
    ) {
    this.balance = new BN(balance.toString(10));
    this.index = new BN(index.toString(10));
    this.tradeHistory = tradeHistory;
  }

  public getTradeHistory(orderID: number) {
    const address = orderID % 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
    if (this.tradeHistory[address] === undefined) {
      this.tradeHistory[address] = new TradeHistory();
    }
    return this.tradeHistory[address];
  }
}

export class AccountLeaf {
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  walletHash: string;
  balances: { [key: number]: Balance };

  constructor() {
    this.owner = "0",
    this.publicKeyX = "0";
    this.publicKeyY = "0";
    this.nonce = 0;
    this.walletHash = "0";
    this.balances = {};
  }

  public init(
    owner: string,
    publicKeyX: string,
    publicKeyY: string,
    nonce: number,
    walletHash: string,
    balances: { [key: number]: Balance } = {}
    ) {
    this.owner = owner;
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.nonce = nonce;
    this.walletHash = walletHash;
    this.balances = balances;
  }

  public getBalanceRaw(tokenID: number) {
    if (this.balances[tokenID] === undefined) {
      this.balances[tokenID] = new Balance();
    }
    return this.balances[tokenID];
  }

  public getBalance(tokenID: number, index: AccountLeaf) {
    if (this.balances[tokenID] === undefined) {
      this.balances[tokenID] = new Balance();
    }
    const newIndex = index.getBalanceRaw(tokenID).index;
    this.balances[tokenID].balance = applyInterest(this.balances[tokenID].balance, this.balances[tokenID].index, newIndex);
    this.balances[tokenID].index = newIndex;
    return this.balances[tokenID];
  }
}

export class ExchangeState {
  accounts: AccountLeaf[];

  constructor(accounts: AccountLeaf[] = []) {
    this.accounts = accounts;
  }

  public getAccount(accountID: number) {
    while(accountID >= this.accounts.length) {
      this.accounts.push(new AccountLeaf());
    }
    return this.accounts[accountID];
  }
}

// Simulator

export interface DetailedTokenTransfer {
  description: string;
  token: number;
  from: number;
  to: number;
  amount: BN;
  subPayments: DetailedTokenTransfer[];
}

export interface DetailedSimulatorReport {
  exchangeStateAfter: ExchangeState;
  detailedTransfers: DetailedTokenTransfer[];
}

export interface SimulatorReport {
  exchangeStateAfter: ExchangeState;
}

export class Simulator {

  public static async loadExchangeState(exchangeID: number, blockIdx: number) {
    const accounts: AccountLeaf[] = [];
    if (blockIdx > 0) {
      const stateFile = "states/state_" + exchangeID + "_" + blockIdx + ".json";
      const jState = JSON.parse(fs.readFileSync(stateFile, "ascii"));

      const accountsKeys: string[] = Object.keys(jState.accounts_values);
      let numAccounts = 4;
      for (const accountKey of accountsKeys) {
        numAccounts =
          Number(accountKey) >= numAccounts
            ? Number(accountKey) + 1
            : numAccounts;
      }
      for (let i = 0; i < numAccounts; i++) {
        accounts.push(new AccountLeaf());
      }
      for (const accountKey of accountsKeys) {
        const jAccount = jState.accounts_values[accountKey];

        const balances: { [key: number]: Balance } = {};
        const balancesKeys: string[] = Object.keys(jAccount._balancesLeafs);
        for (const balanceKey of balancesKeys) {
          const jBalance = jAccount._balancesLeafs[balanceKey];

          const tradeHistory: { [key: number]: TradeHistory } = {};
          const tradeHistoryKeys: string[] = Object.keys(
            jBalance._tradeHistoryLeafs
          );
          for (const tradeHistoryKey of tradeHistoryKeys) {
            const jTradeHistory = jBalance._tradeHistoryLeafs[tradeHistoryKey];
            tradeHistory[Number(tradeHistoryKey)] = {
              filled: new BN(jTradeHistory.filled, 10),
              orderID: Number(jTradeHistory.orderID)
            };
          }
          balances[Number(balanceKey)] = new Balance();
          balances[Number(balanceKey)].init(
            new BN(jBalance.balance, 10),
            new BN(jBalance.index, 10),
            tradeHistory
          );
        }
        const account = new AccountLeaf();
        account.init(
          jAccount.owner,
          jAccount.publicKeyX,
          jAccount.publicKeyY,
          jAccount.nonce,
          jAccount.walletHash,
          balances
        );
        accounts[Number(accountKey)] = account;
      }
    } else {
      accounts.push(new AccountLeaf());
      accounts.push(new AccountLeaf());
      accounts.push(new AccountLeaf());
      accounts.push(new AccountLeaf());
    }

    const exchangeState = new ExchangeState(accounts);
    return exchangeState;
  }

  public static compareStates(stateA: ExchangeState, stateB: ExchangeState) {
    assert.equal(
      stateA.accounts.length,
      stateA.accounts.length,
      "number of accounts does not match"
    );
    for (let accountID = 0; accountID < stateA.accounts.length; accountID++) {
      const accountA = stateA.accounts[accountID];
      const accountB = stateB.accounts[accountID];
      this.compareAccounts(accountA, accountB);
    }
  }

  public static normalizeOwner(owner: string) {
    if (owner.startsWith("0x")) {
      return new BN(owner.slice(2), 16).toString(10);
    } else {
      return owner;
    }
  }

  public static compareAccounts(accountA: any, accountB: any) {
    for (let tokenID = 0; tokenID < Constants.MAX_NUM_TOKENS; tokenID++) {
      let balanceValueA = accountA.balances[tokenID];
      let balanceValueB = accountB.balances[tokenID];

      balanceValueA = balanceValueA || { balance: new BN(0), index: Constants.INDEX_BASE, tradeHistory: {} };
      balanceValueB = balanceValueB || { balance: new BN(0), index: Constants.INDEX_BASE, tradeHistory: {} };

      for (const orderID of Object.keys(balanceValueA.tradeHistory).concat(
        Object.keys(balanceValueB.tradeHistory)
      )) {
        let tradeHistoryValueA = balanceValueA.tradeHistory[Number(orderID)];
        let tradeHistoryValueB = balanceValueB.tradeHistory[Number(orderID)];

        tradeHistoryValueA = tradeHistoryValueA || {
          filled: new BN(0),
          orderID: 0
        };
        tradeHistoryValueB = tradeHistoryValueB || {
          filled: new BN(0),
          orderID: 0
        };

        assert(
          tradeHistoryValueA.filled.eq(tradeHistoryValueB.filled),
          "trade history filled does not match"
        );
        assert.equal(
          tradeHistoryValueA.orderID,
          tradeHistoryValueB.orderID,
          "orderID does not match"
        );
      }
      assert(
        balanceValueA.balance.eq(balanceValueB.balance),
        "balance does not match: " +
        "account: " + accountB.accountID + ", " +
        "token: " + tokenID + ", " +
        balanceValueA.balance.toString(10) + ", " +
        balanceValueB.balance.toString(10)
      );
      assert(
        balanceValueA.index.eq(balanceValueB.index),
        "index does not match" +
        "account: " + accountB.accountID + ", " +
        "token: " + tokenID + ", " +
        balanceValueA.index.toString(10) + ", " +
        balanceValueB.index.toString(10)
      );
    }
    assert.equal(
      Simulator.normalizeOwner(accountA.owner),
      Simulator.normalizeOwner(accountB.owner),
      "owner does not match"
    );
    assert.equal(
      accountA.publicKeyX,
      accountB.publicKeyX,
      "pubKeyX does not match"
    );
    assert.equal(
      accountA.publicKeyY,
      accountB.publicKeyY,
      "pubKeyY does not match"
    );
    assert.equal(
      accountA.walletHash,
      accountB.walletHash,
      "walletHash does not match"
    );
    assert.equal(accountA.nonce, accountB.nonce, "nonce does not match");
  }

  public static executeBlock(
    block: TxBlock,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    logInfo("----------------------------------------------------");
    let previousState = stateBefore;
    //const addressBook = this.getAddressBookBlock(block);
    for (const [index, tx] of block.transactions.entries()) {
      const state = this.copyExchangeState(previousState);
      let report: any;
      if (tx.txType === "Noop") {
        // Nothing to do
        report = {
          exchangeStateAfter: state
        };
        logInfo("#" + index + " Noop");
      } else if (tx.txType === "Deposit") {
        const deposit: Deposit = tx;
        report = this.deposit(state, block, deposit);

        logInfo("#" + index + " Deposit");
        const accountBefore = previousState.getAccount(deposit.accountID);
        const accountAfter = state.getAccount(deposit.accountID);
        this.prettyPrintBalanceChange(
          deposit.accountID,
          deposit.tokenID,
          accountBefore.getBalanceRaw(deposit.tokenID).balance,
          accountAfter.getBalanceRaw(deposit.tokenID).balance
        );
      } else if (tx.txType === "AccountUpdate") {
        const update: AccountUpdate = tx;
        report = this.updateAccount(state, block, tx);

        logInfo("#" + index + " AccountUpdate");
        const accountBefore = previousState.getAccount(update.accountID);
        const accountAfter = state.getAccount(update.accountID);
        if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
          logInfo("publicKeyX: " + accountBefore.publicKeyX + " -> " + accountAfter.publicKeyX);
        }
        if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
          logInfo("publicKeyY: " + accountBefore.publicKeyY + " -> " + accountAfter.publicKeyY);
        }
        if (accountBefore.walletHash !== accountAfter.walletHash) {
          logInfo("walletHash: " + accountBefore.walletHash + " -> " + accountAfter.walletHash);
        }
        this.prettyPrintBalanceChange(
          update.accountID,
          update.feeTokenID,
          accountBefore.getBalanceRaw(update.feeTokenID).balance,
          accountAfter.getBalanceRaw(update.feeTokenID).balance
        );
      } else if (tx.txType === "Transfer") {
        const transfer: Transfer = tx;
        report = this.transfer(state, block, transfer);

        const accountFromBefore = previousState.getAccount(transfer.accountFromID);
        const accountFromAfter = state.getAccount(transfer.accountFromID);

        const accountToBefore = previousState.getAccount(transfer.accountToID);
        const accountToAfter = state.getAccount(transfer.accountToID);

        const accountOperatorBefore = previousState.getAccount(block.operatorAccountID);
        const accountOperatorAfter = state.getAccount(block.operatorAccountID);

        /*for (const detailedTransfer of report.detailedTransfers) {
          this.logDetailedTokenTransfer(detailedTransfer, {});
        }*/

        logInfo("#" + index + " Transfer");
        logInfo("+ State changes:");
        logInfo("- From:");
        this.prettyPrintBalanceChange(
          transfer.accountFromID,
          transfer.tokenID,
          accountFromBefore.getBalanceRaw(transfer.tokenID).balance,
          accountFromAfter.getBalanceRaw(transfer.tokenID).balance
        );
        this.prettyPrintBalanceChange(
          transfer.accountFromID,
          transfer.feeTokenID,
          accountFromBefore.getBalanceRaw(transfer.feeTokenID).balance,
          accountFromAfter.getBalanceRaw(transfer.feeTokenID).balance
        );
        logInfo("- To:");
        this.prettyPrintBalanceChange(
          transfer.accountToID,
          transfer.tokenID,
          accountToBefore.getBalanceRaw(transfer.tokenID).balance,
          accountToAfter.getBalanceRaw(transfer.tokenID).balance
        );
        logInfo("- Operator:");
        this.prettyPrintBalanceChange(
          block.operatorAccountID,
          transfer.feeTokenID,
          accountOperatorBefore.getBalanceRaw(transfer.feeTokenID).balance,
          accountOperatorAfter.getBalanceRaw(transfer.feeTokenID).balance
        );
        logInfo("----");
      } else if (tx.txType === "SpotTrade") {
        report = this.spotTrade(state, block, tx);

        logInfo("#" + index + " SpotTrade");
        for (const detailedTransfer of report.detailedTransfers) {
          this.logDetailedTokenTransfer(detailedTransfer, {});
        }
        this.logFilledAmountsSpotTrade(
          tx,
          previousState,
          report.exchangeStateAfter
        );
      } else if (tx.txType === "Withdraw") {
        const withdrawal: WithdrawalRequest = tx;
        report = this.withdraw(state, block, tx);

        logInfo("#" + index + " Withdraw");
        const accountBefore = previousState.getAccount(withdrawal.accountID);
        const accountAfter = state.getAccount(withdrawal.accountID);
        this.prettyPrintBalanceChange(
          withdrawal.accountID,
          withdrawal.tokenID,
          accountBefore.getBalanceRaw(withdrawal.tokenID).balance,
          accountAfter.getBalanceRaw(withdrawal.tokenID).balance
        );
      } else if (tx.txType === "NewAccount") {
        const create: NewAccount = tx;
        report = this.newAccount(state, block, tx);

        logInfo("#" + index + " NewAccount");
        const accountBefore = previousState.getAccount(create.newAccountID);
        const accountAfter = state.getAccount(create.newAccountID);
        if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
          logInfo("publicKeyX: " + accountBefore.publicKeyX + " -> " + accountAfter.publicKeyX);
        }
        if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
          logInfo("publicKeyY: " + accountBefore.publicKeyY + " -> " + accountAfter.publicKeyY);
        }
        if (accountBefore.walletHash !== accountAfter.walletHash) {
          logInfo("walletHash: " + accountBefore.walletHash + " -> " + accountAfter.walletHash);
        }
        this.prettyPrintBalanceChange(
          create.payerAccountID,
          create.feeTokenID,
          accountBefore.getBalanceRaw(create.feeTokenID).balance,
          accountAfter.getBalanceRaw(create.feeTokenID).balance
        );
      } else if (tx.txType === "OwnerChange") {
        const change: OwnerChange = tx;
        report = this.changeOwner(state, block, tx);

        logInfo("#" + index + " OwnerChange");
        const accountBefore = previousState.getAccount(change.accountID);
        const accountAfter = state.getAccount(change.accountID);
        if (accountBefore.owner !== accountAfter.owner) {
          logInfo("owner: " + accountBefore.owner + " -> " + accountAfter.owner);
        }
        this.prettyPrintBalanceChange(
          change.accountID,
          change.feeTokenID,
          accountBefore.getBalanceRaw(change.feeTokenID).balance,
          accountAfter.getBalanceRaw(change.feeTokenID).balance
        );
      } else {
        assert(false, "Unknown tx type: " + tx.txType);
      }
      previousState = state;
    }

    // Update operator nonce
    previousState.getAccount(block.operatorAccountID).nonce++;

    // Verify resulting state
    this.compareStates(stateAfter, previousState);
    logInfo("----------------------------------------------------");
  }

  public static deposit(state: ExchangeState, block: TxBlock, deposit: Deposit) {
    const accountIndex = state.getAccount(1);
    const account = state.getAccount(deposit.accountID);
    account.owner = deposit.owner;

    const newIndex = deposit.index.gt(accountIndex.getBalanceRaw(deposit.tokenID).index)
      ? deposit.index : accountIndex.getBalanceRaw(deposit.tokenID).index;

    const balance = account.getBalanceRaw(deposit.tokenID);
    const newBalance = applyInterest(balance.balance, balance.index, newIndex);
    const newDepositAmount = applyInterest(deposit.amount, deposit.index, newIndex);

    balance.balance = newBalance.add(newDepositAmount);
    balance.index = newIndex;

    accountIndex.getBalanceRaw(deposit.tokenID).index = newIndex;

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static updateAccount(state: ExchangeState, block: TxBlock, update: AccountUpdate) {
    const index = state.getAccount(1);

    const account = state.getAccount(update.accountID);
    account.publicKeyX = update.publicKeyX;
    account.publicKeyY = update.publicKeyY;
    account.walletHash = update.walletHash;
    account.nonce++;

    const balance = account.getBalance(update.feeTokenID, index);
    balance.balance.isub(update.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(update.feeTokenID, index);
    balanceO.balance.iadd(update.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static changeOwner(state: ExchangeState, block: TxBlock, change: OwnerChange) {
    const index = state.getAccount(1);

    const account = state.getAccount(change.accountID);
    account.owner = change.newOwner;
    account.nonce++;

    const balance = account.getBalance(change.feeTokenID, index);
    balance.balance.isub(change.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(change.feeTokenID, index);
    balanceO.balance.iadd(change.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static newAccount(state: ExchangeState, block: TxBlock, create: NewAccount) {
    const index = state.getAccount(1);

    const payerAccount = state.getAccount(create.payerAccountID);
    const newAccount = state.getAccount(create.newAccountID);

    newAccount.owner = create.newOwner;
    newAccount.publicKeyX = create.newPublicKeyX;
    newAccount.publicKeyY = create.newPublicKeyY;
    newAccount.walletHash = create.newWalletHash;
    payerAccount.nonce++;

    const balance = payerAccount.getBalance(create.feeTokenID, index);
    balance.balance.isub(create.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(create.feeTokenID, index);
    balanceO.balance.iadd(create.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static transfer(state: ExchangeState, block: TxBlock, transfer: Transfer) {
    const index = state.getAccount(1);

    const from = state.getAccount(transfer.accountFromID);
    const to = state.getAccount(transfer.accountToID);
    to.owner = transfer.ownerTo;

    from.getBalance(transfer.tokenID, index).balance.isub(transfer.amount);
    to.getBalance(transfer.tokenID, index).balance.iadd(transfer.amount);

    from.getBalance(transfer.feeTokenID, index).balance.isub(transfer.fee);

    from.nonce++;

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(transfer.feeTokenID, index).balance.iadd(transfer.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static withdraw(state: ExchangeState, block: TxBlock, withdrawal: WithdrawalRequest) {
    const index = state.getAccount(1);

    const account = state.getAccount(withdrawal.accountID);
    let amount = withdrawal.amount;
    if (withdrawal.type === 2) {
      amount = account.getBalance(withdrawal.tokenID, index).balance;
    } else if (withdrawal.type === 3) {
      amount = new BN(0);
    }
    account.getBalance(withdrawal.tokenID, index).balance.isub(amount);
    account.getBalance(withdrawal.feeTokenID, index).balance.isub(withdrawal.fee);

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(withdrawal.feeTokenID, index).balance.iadd(withdrawal.fee);

    if (withdrawal.type === 0 || withdrawal.type === 1) {
      account.nonce++;
    }

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static spotTrade(state: ExchangeState, block: TxBlock, spotTrade: SpotTrade) {
    const fillA = this.getMaxFillAmounts(
      spotTrade.orderA,
      state.accounts[spotTrade.orderA.accountID]
    );
    const fillB = this.getMaxFillAmounts(
      spotTrade.orderB,
      state.accounts[spotTrade.orderB.accountID]
    );

    //console.log("MaxFillA.S: " + fillA.S.toString(10));
    //console.log("MaxFillA.B: " + fillA.B.toString(10));
    //console.log("MaxFillB.S: " + fillB.S.toString(10));
    //console.log("MaxFillB.B: " + fillB.B.toString(10));

    let matchResult: MatchResult;
    if (spotTrade.orderA.buy) {
      matchResult = this.match(spotTrade.orderA, fillA, spotTrade.orderB, fillB);
      fillA.S = fillB.B;
    } else {
      matchResult = this.match(spotTrade.orderB, fillB, spotTrade.orderA, fillA);
      fillA.B = fillB.S;
    }
    logDebug("spread:     " + matchResult.spread.toString(10));

    let valid = matchResult.matchable;
    valid = valid && this.checkValid(spotTrade.orderA, fillA.S, fillA.B, block.timestamp);
    valid = valid && this.checkValid(spotTrade.orderB, fillB.S, fillB.B, block.timestamp);

    if (!valid) {
      fillA.S = new BN(0);
      fillA.B = new BN(0);
      fillB.S = new BN(0);
      fillB.B = new BN(0);
    }

    fillA.S = roundToFloatValue(fillA.S, Constants.Float24Encoding);
    fillB.S = roundToFloatValue(fillB.S, Constants.Float24Encoding);

    //console.log("fillA.S: " + fillA.S.toString(10));
    //console.log("fillB.S: " + fillB.S.toString(10));

    // Validate
    this.validateOrder(
      state,
      spotTrade.orderA,
      spotTrade.orderB,
      false,
      fillA.S,
      fillA.B,
      valid
    );
    this.validateOrder(
      state,
      spotTrade.orderB,
      spotTrade.orderB,
      true,
      fillB.S,
      fillB.B,
      valid
    );

    const s = this.settleRing(
      state,
      block.protocolTakerFeeBips,
      block.protocolMakerFeeBips,
      block.operatorAccountID,
      fillA.S,
      fillB.S,
      spotTrade.orderA.buy,
      spotTrade.orderB.buy,
      spotTrade.orderA.tokenIdS,
      spotTrade.orderB.tokenIdS,
      spotTrade.orderA.orderID,
      spotTrade.orderA.accountID,
      spotTrade.orderA.feeBips,
      spotTrade.orderA.rebateBips,
      spotTrade.orderB.orderID,
      spotTrade.orderB.accountID,
      spotTrade.orderB.feeBips,
      spotTrade.orderB.rebateBips
    );

    // Check expected
    if (spotTrade.expected) {
      if (spotTrade.expected.orderA) {
        const filledFraction = spotTrade.orderA.buy
          ? fillA.B.mul(new BN(10000))
              .div(spotTrade.orderA.amountB)
              .toNumber() / 10000
          : fillA.S.mul(new BN(10000))
              .div(spotTrade.orderA.amountS)
              .toNumber() / 10000;
        this.assertAlmostEqual(
          filledFraction,
          spotTrade.expected.orderA.filledFraction,
          "OrderA filled",
          -3
        );
        if (spotTrade.expected.orderA.spread !== undefined) {
          const nSpread = Number(spotTrade.expected.orderA.spread.toString(10));
          this.assertAlmostEqual(
            Number(matchResult.spread.toString(10)),
            nSpread,
            "spread",
            0
          );
        }
      }
      if (spotTrade.expected.orderB) {
        const filledFraction = spotTrade.orderB.buy
          ? fillB.B.mul(new BN(10000))
              .div(spotTrade.orderB.amountB)
              .toNumber() / 10000
          : fillB.S.mul(new BN(10000))
              .div(spotTrade.orderB.amountS)
              .toNumber() / 10000;
        this.assertAlmostEqual(
          filledFraction,
          spotTrade.expected.orderB.filledFraction,
          "OrderB filled",
          -3
        );
      }
    }

    const paymentsA: DetailedTokenTransfer = {
      description: "OwnerA",
      token: 0,
      from: block.operatorAccountID,
      to: block.operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const detailedTransfersA = this.getDetailedTransfers(
      block.operatorAccountID,
      spotTrade,
      spotTrade.orderA,
      spotTrade.orderB,
      fillA.S,
      fillA.B,
      s.feeA
    );
    paymentsA.subPayments.push(...detailedTransfersA);

    const paymentsB: DetailedTokenTransfer = {
      description: "OwnerB",
      token: 0,
      from: block.operatorAccountID,
      to: block.operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const detailedTransfersB = this.getDetailedTransfers(
      block.operatorAccountID,
      spotTrade,
      spotTrade.orderB,
      spotTrade.orderA,
      fillB.S,
      fillB.B,
      s.feeB
    );
    paymentsB.subPayments.push(...detailedTransfersB);

    const paymentsOperator: DetailedTokenTransfer = {
      description: "Operator",
      token: 0,
      from: block.operatorAccountID,
      to: block.operatorAccountID,
      amount: new BN(0),
      subPayments: []
    };
    const payRebateA: DetailedTokenTransfer = {
      description: "RebateA",
      token: spotTrade.orderA.tokenIdB,
      from: block.operatorAccountID,
      to: spotTrade.orderA.accountID,
      amount: s.rebateA,
      subPayments: []
    };
    const payRebateB: DetailedTokenTransfer = {
      description: "RebateB",
      token: spotTrade.orderB.tokenIdB,
      from: block.operatorAccountID,
      to: spotTrade.orderB.accountID,
      amount: s.rebateB,
      subPayments: []
    };
    const payProtocolFeeA: DetailedTokenTransfer = {
      description: "ProtocolFeeA",
      token: spotTrade.orderA.tokenIdB,
      from: block.operatorAccountID,
      to: 0,
      amount: s.protocolFeeA,
      subPayments: []
    };
    const payProtocolFeeB: DetailedTokenTransfer = {
      description: "ProtocolFeeB",
      token: spotTrade.orderB.tokenIdB,
      from: block.operatorAccountID,
      to: 0,
      amount: s.protocolFeeB,
      subPayments: []
    };
    paymentsOperator.subPayments.push(payRebateA);
    paymentsOperator.subPayments.push(payRebateB);
    paymentsOperator.subPayments.push(payProtocolFeeA);
    paymentsOperator.subPayments.push(payProtocolFeeB);

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(paymentsA);
    detailedTransfers.push(paymentsB);
    detailedTransfers.push(paymentsOperator);

    const simulatorReport: DetailedSimulatorReport = {
      exchangeStateAfter: state,
      detailedTransfers
    };
    return simulatorReport;
  }

  public static calculateSettlementValues(
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    fillSA: BN,
    fillSB: BN,
    feeBipsA: number,
    feeBipsB: number,
    rebateBipsA: number,
    rebateBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;

    /*console.log("Simulator: ");
    console.log("fillSA: " + fillSA.toString(10));
    console.log("fillBA: " + fillBA.toString(10));
    console.log("fillSB: " + fillSB.toString(10));
    console.log("fillBB: " + fillBB.toString(10));*/

    const [feeA, protocolFeeA, rebateA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA,
      rebateBipsA
    );

    const [feeB, protocolFeeB, rebateB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB,
      rebateBipsB
    );

    /*console.log("feeA: " + feeA.toString(10));
    console.log("protocolFeeA: " + protocolFeeA.toString(10));
    console.log("feeB: " + feeB.toString(10));
    console.log("protocolFeeB: " + protocolFeeB.toString(10));*/

    const settlementValues: SettlementValues = {
      fillSA,
      fillBA,
      feeA,
      protocolFeeA,
      rebateA,

      fillSB,
      fillBB,
      feeB,
      protocolFeeB,
      rebateB
    };
    return settlementValues;
  }

  public static settleRing(
    state: ExchangeState,
    protocolFeeTakerBips: number,
    protocolFeeMakerBips: number,
    operatorId: number,
    fillSA: BN,
    fillSB: BN,
    buyA: boolean,
    buyB: boolean,
    tokenA: number,
    tokenB: number,
    orderIdA: number,
    accountIdA: number,
    feeBipsA: number,
    rebateBipsA: number,
    orderIdB: number,
    accountIdB: number,
    feeBipsB: number,
    rebateBipsB: number
  ) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB,
      rebateBipsA,
      rebateBipsB
    );

    const index = state.getAccount(1);

    // Update accountA
    {
      const accountA = state.getAccount(accountIdA);
      accountA.getBalance(tokenA, index).balance.isub(s.fillSA);
      accountA.getBalance(tokenB, index).balance.iadd(s.fillBA).isub(s.feeA).iadd(s.rebateA);

      const tradeHistoryA = accountA.getBalanceRaw(tokenA).getTradeHistory(orderIdA);
      tradeHistoryA.filled = orderIdA > tradeHistoryA.orderID ? new BN(0) : tradeHistoryA.filled;
      tradeHistoryA.filled.iadd(buyA ? s.fillBA : s.fillSA);
      tradeHistoryA.orderID = orderIdA;
    }
    // Update accountB
    {
      const accountB = state.getAccount(accountIdB);
      accountB.getBalance(tokenB, index).balance.isub(s.fillSB);
      accountB.getBalance(tokenA, index).balance.iadd(s.fillBB).isub(s.feeB).iadd(s.rebateB);

      const tradeHistoryB = accountB.getBalanceRaw(tokenB).getTradeHistory(orderIdB);
      tradeHistoryB.filled = orderIdB > tradeHistoryB.orderID ? new BN(0) : tradeHistoryB.filled;
      tradeHistoryB.filled.iadd(buyB ? s.fillBB : s.fillSB);
      tradeHistoryB.orderID = orderIdB;
    }

    // Update protocol fee
    const protocol = state.getAccount(0);
    protocol.getBalance(tokenA, index).balance.iadd(s.protocolFeeB);
    protocol.getBalance(tokenB, index).balance.iadd(s.protocolFeeA);

    // Update operator
    const operator = state.getAccount(operatorId);
    operator.getBalance(tokenA, index).balance.iadd(s.feeB).isub(s.protocolFeeB).isub(s.rebateB);
    operator.getBalance(tokenB, index).balance.iadd(s.feeA).isub(s.protocolFeeA).isub(s.rebateA);

    return s;
  }

  private static getDetailedTransfers(
    operatorAccountID: number,
    spotTrade: SpotTrade,
    order: OrderInfo,
    orderTo: OrderInfo,
    fillAmountS: BN,
    fillAmountB: BN,
    fee: BN
  ) {
    const sell: DetailedTokenTransfer = {
      description: "Sell",
      token: order.tokenIdS,
      from: order.accountID,
      to: orderTo.accountID,
      amount: fillAmountS,
      subPayments: []
    };
    const payFee: DetailedTokenTransfer = {
      description: "Fee@" + order.feeBips + "Bips",
      token: order.tokenIdB,
      from: order.accountID,
      to: operatorAccountID,
      amount: fee,
      subPayments: []
    };

    const detailedTransfers: DetailedTokenTransfer[] = [];
    detailedTransfers.push(sell);
    detailedTransfers.push(payFee);

    return detailedTransfers;
  }

  private static validateOrder(
    exchangeState: ExchangeState,
    order: OrderInfo,
    makerOrder: OrderInfo,
    isMakerOrder: boolean,
    fillS: BN,
    fillB: BN,
    valid: boolean
  ) {
    const account = exchangeState.accounts[order.accountID];
    assert(
      account.balances[order.tokenIdS].balance.gte(fillS),
      "can never spend more than balance"
    );

    if (valid) {
      const filled = this.getFilled(order, account);
      if (!fillS.isZero() || !fillB.isZero()) {
        const multiplier = new BN(web3.utils.toWei("1000", "ether"));
        const orderRate = order.amountS.mul(multiplier).div(order.amountB);
        const rate = fillS.mul(multiplier).div(fillB);
        let targetRate: BN;
        if (isMakerOrder) {
          targetRate = makerOrder.amountS
            .mul(multiplier)
            .div(makerOrder.amountB);
        } else {
          targetRate = makerOrder.amountB
            .mul(multiplier)
            .div(makerOrder.amountS);
        }
        assert(
          targetRate
            .mul(new BN(100))
            .sub(rate.mul(new BN(100)))
            .abs()
            .lte(targetRate),
          "fill rate needs to match maker order rate"
        );
        assert(
          rate
            .mul(multiplier)
            .lte(orderRate.mul(multiplier.add(multiplier.div(new BN(100))))),
          "fill rate needs to match or be better than the order rate"
        );
      }
      if (order.buy) {
        assert(
          fillB.lte(order.amountB),
          "can never buy more than specified in the order"
        );
        if (filled.lte(order.amountB)) {
          assert(
            filled.add(fillB).lte(order.amountB),
            "can never buy more than specified in the order"
          );
        } else {
          assert(
            fillS.isZero(),
            "fillS needS to be 0 when filled target is reached already"
          );
          assert(
            fillB.isZero(),
            "fillB needS to be 0 when filled target is reached already"
          );
        }
      } else {
        assert(
          fillS.lte(order.amountS),
          "can never sell more than specified in the order"
        );
        if (filled.lte(order.amountS)) {
          assert(
            filled.add(fillS).lte(order.amountS),
            "can never buy more than specified in the order"
          );
        } else {
          assert(
            fillS.isZero(),
            "fillS needS to be 0 when filled target is reached already"
          );
          assert(
            fillB.isZero(),
            "fillB needS to be 0 when filled target is reached already"
          );
        }
      }
    }
  }

  private static getFilled(order: OrderInfo, accountData: any) {
    const numSlots = 2 ** Constants.BINARY_TREE_DEPTH_TRADING_HISTORY;
    const tradeHistorySlot = order.orderID % numSlots;
    const tradeHistory = accountData.getBalanceRaw(order.tokenIdS).getTradeHistory(order.orderID);
    // Trade history trimming
    const tradeHistoryOrderID =
      (tradeHistory.orderID === 0) ? tradeHistorySlot : tradeHistory.orderID;
    const filled =
      (tradeHistoryOrderID === order.orderID) ? tradeHistory.filled : new BN(0);
    return filled;
  }

  private static getMaxFillAmounts(order: OrderInfo, accountData: any) {
    const tradeHistoryFilled = this.getFilled(order, accountData);
    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);

    let remainingS = new BN(0);
    if (order.buy) {
      const filled = order.amountB.lt(tradeHistoryFilled)
        ? order.amountB
        : tradeHistoryFilled;
      const remainingB = order.amountB.sub(filled);
      remainingS = remainingB.mul(order.amountS).div(order.amountB);
    } else {
      const filled = order.amountS.lt(tradeHistoryFilled)
        ? order.amountS
        : tradeHistoryFilled;
      remainingS = order.amountS.sub(filled);
    }
    const fillAmountS = balanceS.lt(remainingS) ? balanceS : remainingS;
    const fillAmountB = fillAmountS.mul(order.amountB).div(order.amountS);
    const fill: Fill = {
      S: fillAmountS,
      B: fillAmountB
    };
    return fill;
  }

  private static match(
    takerOrder: OrderInfo,
    takerFill: Fill,
    makerOrder: OrderInfo,
    makerFill: Fill
  ) {
    if (takerFill.B.lt(makerFill.S)) {
      makerFill.S = takerFill.B;
      makerFill.B = makerFill.S.mul(makerOrder.amountB).div(makerOrder.amountS);
    } else {
      takerFill.B = makerFill.S;
      takerFill.S = takerFill.B.mul(takerOrder.amountS).div(takerOrder.amountB);
    }
    const spread = takerFill.S.sub(makerFill.B);
    const matchable = this.ensure(
      takerFill.S.gte(makerFill.B),
      "not matchable"
    );
    const result: MatchResult = {
      spread,
      matchable
    };
    return result;
  }

  private static calculateFees(
    fillB: BN,
    protocolFeeBips: number,
    feeBips: number,
    rebateBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    const rebate = fillB.mul(new BN(rebateBips)).div(new BN(10000));
    return [fee, protocolFee, rebate];
  }

  private static checkFillRate(
    amountS: BN,
    amountB: BN,
    fillAmountS: BN,
    fillAmountB: BN
  ) {
    return fillAmountS
      .mul(amountB)
      .mul(new BN(1000))
      .lte(fillAmountB.mul(amountS).mul(new BN(1001)));
  }

  private static checkValid(
    order: OrderInfo,
    fillAmountS: BN,
    fillAmountB: BN,
    timestamp: number
  ) {
    let valid = true;

    valid =
      valid && this.ensure(order.validSince <= timestamp, "order too early");
    valid =
      valid && this.ensure(timestamp <= order.validUntil, "order too late");

    valid =
      valid &&
      this.ensure(
        !(!order.buy && order.allOrNone && fillAmountS.lt(order.amountS)),
        "allOrNone sell"
      );
    valid =
      valid &&
      this.ensure(
        !(order.buy && order.allOrNone && fillAmountB.lt(order.amountB)),
        "allOrNone buy"
      );
    valid =
      valid &&
      this.ensure(
        this.checkFillRate(
          order.amountS,
          order.amountB,
          fillAmountS,
          fillAmountB
        ),
        "invalid fill rate"
      );
    valid = valid && this.ensure(!fillAmountS.eq(0), "no tokens sold");
    valid = valid && this.ensure(!fillAmountB.eq(0), "no tokens bought");

    return valid;
  }

  private static copyAccount(account: AccountLeaf) {
    const balances: { [key: number]: Balance } = {};
    for (const tokenID of Object.keys(account.balances)) {
      const balanceValue = account.balances[Number(tokenID)];

      const tradeHistory: { [key: number]: TradeHistory } = {};
      for (const orderID of Object.keys(balanceValue.tradeHistory)) {
        const tradeHistoryValue = balanceValue.tradeHistory[Number(orderID)];
        tradeHistory[Number(orderID)] = {
          filled: new BN(tradeHistoryValue.filled.toString(10)),
          orderID: tradeHistoryValue.orderID
        };
      }
      balances[Number(tokenID)] = new Balance();
      balances[Number(tokenID)].init(
        balanceValue.balance,
        balanceValue.index,
        tradeHistory
      );
    }
    const accountCopy = new AccountLeaf();
    accountCopy.init(
      account.owner,
      account.publicKeyX,
      account.publicKeyY,
      account.nonce,
      account.walletHash,
      balances
    );
    return accountCopy;
  }

  private static copyExchangeState(exchangeState: ExchangeState) {
    const accounts: AccountLeaf[] = [];
    for (
      let accountID = 0;
      accountID < exchangeState.accounts.length;
      accountID++
    ) {
      accounts[accountID] = this.copyAccount(exchangeState.accounts[accountID]);
    }
    const exchangeStateCopy = new ExchangeState(accounts);
    return exchangeStateCopy;
  }

  private static ensure(valid: boolean, description: string) {
    if (!valid) {
      logInfo(description);
    }
    return valid;
  }

  private static assertAlmostEqual(
    n1: number,
    n2: number,
    description: string,
    precision: number
  ) {
    return assert(Math.abs(n1 - n2) < 10 ** precision, description + ". " + n1 + " but expected " + n2);
  }

  public static prettyPrintBalance(accountID: number, tokenID: number, balance: BN) {
    const prettyBalance = this.getPrettyAmount(tokenID, balance);
    logInfo(accountID + ": " + prettyBalance);
  }

  public static prettyPrintBalanceChange(
    accountID: number,
    tokenID: number,
    balanceBefore: BN,
    balanceAfter: BN
  ) {
    const prettyBalanceBefore = this.getPrettyAmount(tokenID, balanceBefore);
    const prettyBalanceAfter = this.getPrettyAmount(tokenID, balanceAfter);
    logInfo(
      accountID + ": " + prettyBalanceBefore + " -> " + prettyBalanceAfter
    );
  }

  private static logDetailedTokenTransfer(
    payment: DetailedTokenTransfer,
    addressBook: { [id: number]: string } = {},
    depth: number = 0
  ) {
    if (payment.amount.eq(new BN(0)) && payment.subPayments.length === 0) {
      return;
    }
    const whiteSpace = " ".repeat(depth);
    const description = payment.description ? payment.description : "";
    const prettyAmount = this.getPrettyAmount(payment.token, payment.amount);
    if (payment.subPayments.length === 0) {
      const toName =
        addressBook[payment.to] !== undefined
          ? addressBook[payment.to]
          : payment.to;
      logInfo(
        whiteSpace +
          "- " +
          " [" +
          description +
          "] " +
          prettyAmount +
          " -> " +
          toName
      );
    } else {
      logInfo(whiteSpace + "+ " + " [" + description + "] ");
      for (const subPayment of payment.subPayments) {
        this.logDetailedTokenTransfer(subPayment, addressBook, depth + 1);
      }
    }
  }

  private static getPrettyAmount(tokenID: number, amount: BN) {
    /*const tokenAddress = this.tokenIDToAddressMap.get(tokenID);
    const tokenSymbol = this.testContext.tokenAddrSymbolMap.get(tokenAddress);
    const decimals = this.testContext.tokenAddrDecimalsMap.get(tokenAddress);
    let amountDec = Number(amount.toString(10)) / 10 ** decimals;
    if (Math.abs(amountDec) < 0.0000000000001) {
      amountDec = 0;
    }
    return amountDec + " " + tokenSymbol;*/
    return amount.toString(10) + " " + tokenID;
  }

  private static logFilledAmountsSpotTrade(
    spotTrade: SpotTrade,
    stateBefore: ExchangeState,
    stateAfter: ExchangeState
  ) {
    this.logFilledAmountOrder(
      "[Filled] OrderA",
      stateBefore.accounts[spotTrade.orderA.accountID],
      stateAfter.accounts[spotTrade.orderA.accountID],
      spotTrade.orderA
    );
    this.logFilledAmountOrder(
      "[Filled] OrderB",
      stateBefore.accounts[spotTrade.orderB.accountID],
      stateAfter.accounts[spotTrade.orderB.accountID],
      spotTrade.orderB
    );
  }

  private static logFilledAmountOrder(
    description: string,
    accountBefore: AccountLeaf,
    accountAfter: AccountLeaf,
    order: OrderInfo
  ) {
    const before =  accountBefore.getBalanceRaw(order.tokenIdS).getTradeHistory(order.orderID);
    const after = accountAfter.getBalanceRaw(order.tokenIdS).getTradeHistory(order.orderID);
    const filledBeforePercentage = before.filled
      .mul(new BN(100))
      .div(order.buy ? order.amountB : order.amountS);
    const filledAfterPercentage = after.filled
      .mul(new BN(100))
      .div(order.buy ? order.amountB : order.amountS);
    const filledBeforePretty = this.getPrettyAmount(
      order.buy ? order.tokenIdB : order.tokenIdS,
      before.filled
    );
    const filledAfterPretty = this.getPrettyAmount(
      order.buy ? order.tokenIdB : order.tokenIdS,
      after.filled
    );
    logInfo(
      description +
        ": " +
        filledBeforePretty +
        " -> " +
        filledAfterPretty +
        " (" +
        filledBeforePercentage.toString(10) +
        "% -> " +
        filledAfterPercentage.toString(10) +
        "%)" +
        " (slot " +
        order.orderID +
        ")"
    );
  }
}
