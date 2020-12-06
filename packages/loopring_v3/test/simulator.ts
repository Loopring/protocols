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
  AmmUpdate
} from "./types";

interface SettlementValues {
  fillSA: BN;
  fillBA: BN;
  feeA: BN;
  protocolFeeA: BN;

  fillSB: BN;
  fillBB: BN;
  feeB: BN;
  protocolFeeB: BN;
}

interface Fill {
  S: BN;
  B: BN;
}

interface MatchResult {
  spread: BN;
  matchable: boolean;
}

export class Storage {
  data: BN;
  storageID: number;

  constructor() {
    this.data = new BN(0);
    this.storageID = 0;
  }
}

export class Balance {
  balance: BN;
  weightAMM: BN;
  storage: { [key: number]: Storage };

  constructor() {
    this.balance = new BN(0);
    this.weightAMM = new BN(0);
    this.storage = {};
  }

  public init(balance: BN, weightAMM: BN, storage: { [key: number]: Storage }) {
    this.balance = new BN(balance.toString(10));
    this.weightAMM = new BN(weightAMM.toString(10));
    this.storage = storage;
  }

  public getStorage(storageID: number) {
    const address = storageID % 2 ** Constants.BINARY_TREE_DEPTH_STORAGE;
    if (this.storage[address] === undefined) {
      this.storage[address] = new Storage();
    }
    return this.storage[address];
  }
}

export class AccountLeaf {
  owner: string;
  publicKeyX: string;
  publicKeyY: string;
  nonce: number;
  feeBipsAMM: number;
  balances: { [key: number]: Balance };

  constructor() {
    (this.owner = "0"), (this.publicKeyX = "0");
    this.publicKeyY = "0";
    this.nonce = 0;
    this.feeBipsAMM = 0;
    this.balances = {};
  }

  public init(
    owner: string,
    publicKeyX: string,
    publicKeyY: string,
    nonce: number,
    feeBipsAMM: number,
    balances: { [key: number]: Balance } = {}
  ) {
    this.owner = owner;
    this.publicKeyX = publicKeyX;
    this.publicKeyY = publicKeyY;
    this.nonce = nonce;
    this.feeBipsAMM = feeBipsAMM;
    this.balances = balances;
  }

  public getBalance(tokenID: number) {
    if (this.balances[tokenID] === undefined) {
      this.balances[tokenID] = new Balance();
    }
    return this.balances[tokenID];
  }
}

export class ExchangeState {
  accounts: AccountLeaf[];

  constructor(accounts: AccountLeaf[] = []) {
    this.accounts = accounts;
  }

  public getAccount(accountID: number) {
    while (accountID >= this.accounts.length) {
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
      let numAccounts = 1;
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

          const storage: { [key: number]: Storage } = {};
          const storageKeys: string[] = Object.keys(jBalance._storageLeafs);
          for (const storageKey of storageKeys) {
            const jStorage = jBalance._storageLeafs[storageKey];
            storage[Number(storageKey)] = {
              data: new BN(jStorage.data, 10),
              storageID: Number(jStorage.storageID)
            };
          }
          balances[Number(balanceKey)] = new Balance();
          balances[Number(balanceKey)].init(
            new BN(jBalance.balance, 10),
            new BN(jBalance.weightAMM, 10),
            storage
          );
        }
        const account = new AccountLeaf();
        account.init(
          jAccount.owner,
          jAccount.publicKeyX,
          jAccount.publicKeyY,
          jAccount.nonce,
          jAccount.feeBipsAMM,
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

      balanceValueA = balanceValueA || {
        balance: new BN(0),
        weightAMM: new BN(0),
        storage: {}
      };
      balanceValueB = balanceValueB || {
        balance: new BN(0),
        weightAMM: new BN(0),
        storage: {}
      };

      for (const storageID of Object.keys(balanceValueA.storage).concat(
        Object.keys(balanceValueB.storage)
      )) {
        let storageValueA = balanceValueA.storage[Number(storageID)];
        let storageValueB = balanceValueB.storage[Number(storageID)];

        storageValueA = storageValueA || {
          data: new BN(0),
          storageID: 0
        };
        storageValueB = storageValueB || {
          data: new BN(0),
          storageID: 0
        };

        assert(
          storageValueA.data.eq(storageValueB.data),
          "Storage data does not match"
        );
        assert.equal(
          storageValueA.storageID,
          storageValueB.storageID,
          "storageID does not match"
        );
      }
      assert(
        balanceValueA.balance.eq(balanceValueB.balance),
        "balance does not match: " +
          "account: " +
          accountB.accountID +
          ", " +
          "token: " +
          tokenID +
          ", " +
          balanceValueA.balance.toString(10) +
          ", " +
          balanceValueB.balance.toString(10)
      );
      assert(
        balanceValueA.weightAMM.eq(balanceValueB.weightAMM),
        "weight does not match: " +
          "account: " +
          accountB.accountID +
          ", " +
          "token: " +
          tokenID +
          ", " +
          balanceValueA.weightAMM.toString(10) +
          ", " +
          balanceValueB.weightAMM.toString(10)
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
    assert.equal(accountA.nonce, accountB.nonce, "nonce does not match");
    assert.equal(
      accountA.feeBipsAMM,
      accountB.feeBipsAMM,
      "feeBipsAMM does not match"
    );
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
          accountBefore.getBalance(deposit.tokenID).balance,
          accountAfter.getBalance(deposit.tokenID).balance
        );
      } else if (tx.txType === "AccountUpdate") {
        const update: AccountUpdate = tx;
        report = this.updateAccount(state, block, tx);

        logInfo("#" + index + " AccountUpdate");
        const accountBefore = previousState.getAccount(update.accountID);
        const accountAfter = state.getAccount(update.accountID);
        if (accountBefore.publicKeyX !== accountAfter.publicKeyX) {
          logInfo(
            "publicKeyX: " +
              accountBefore.publicKeyX +
              " -> " +
              accountAfter.publicKeyX
          );
        }
        if (accountBefore.publicKeyY !== accountAfter.publicKeyY) {
          logInfo(
            "publicKeyY: " +
              accountBefore.publicKeyY +
              " -> " +
              accountAfter.publicKeyY
          );
        }
        this.prettyPrintBalanceChange(
          update.accountID,
          update.feeTokenID,
          accountBefore.getBalance(update.feeTokenID).balance,
          accountAfter.getBalance(update.feeTokenID).balance
        );
      } else if (tx.txType === "Transfer") {
        const transfer: Transfer = tx;
        report = this.transfer(state, block, transfer);

        const accountFromBefore = previousState.getAccount(
          transfer.fromAccountID
        );
        const accountFromAfter = state.getAccount(transfer.fromAccountID);

        const accountToBefore = previousState.getAccount(transfer.toAccountID);
        const accountToAfter = state.getAccount(transfer.toAccountID);

        const accountOperatorBefore = previousState.getAccount(
          block.operatorAccountID
        );
        const accountOperatorAfter = state.getAccount(block.operatorAccountID);

        /*for (const detailedTransfer of report.detailedTransfers) {
          this.logDetailedTokenTransfer(detailedTransfer, {});
        }*/

        logInfo("#" + index + " Transfer");
        logInfo("+ State changes:");
        logInfo("- From:");
        this.prettyPrintBalanceChange(
          transfer.fromAccountID,
          transfer.tokenID,
          accountFromBefore.getBalance(transfer.tokenID).balance,
          accountFromAfter.getBalance(transfer.tokenID).balance
        );
        this.prettyPrintBalanceChange(
          transfer.fromAccountID,
          transfer.feeTokenID,
          accountFromBefore.getBalance(transfer.feeTokenID).balance,
          accountFromAfter.getBalance(transfer.feeTokenID).balance
        );
        logInfo("- To:");
        this.prettyPrintBalanceChange(
          transfer.toAccountID,
          transfer.tokenID,
          accountToBefore.getBalance(transfer.tokenID).balance,
          accountToAfter.getBalance(transfer.tokenID).balance
        );
        logInfo("- Operator:");
        this.prettyPrintBalanceChange(
          block.operatorAccountID,
          transfer.feeTokenID,
          accountOperatorBefore.getBalance(transfer.feeTokenID).balance,
          accountOperatorAfter.getBalance(transfer.feeTokenID).balance
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
          accountBefore.getBalance(withdrawal.tokenID).balance,
          accountAfter.getBalance(withdrawal.tokenID).balance
        );
      } else if (tx.txType === "AmmUpdate") {
        const update: AmmUpdate = tx;
        report = this.updateAMM(state, block, update);

        logInfo("#" + index + " AMM Update");
        const accountBefore = previousState.getAccount(update.accountID);
        const accountAfter = state.getAccount(update.accountID);
      } else if (tx.txType === "SignatureVerification") {
        logInfo("#" + index + " Signature Verification");
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

  public static deposit(
    state: ExchangeState,
    block: TxBlock,
    deposit: Deposit
  ) {
    const account = state.getAccount(deposit.accountID);
    account.owner = deposit.owner;

    const balance = account.getBalance(deposit.tokenID);
    balance.balance.iadd(deposit.amount);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static updateAccount(
    state: ExchangeState,
    block: TxBlock,
    update: AccountUpdate
  ) {
    const account = state.getAccount(update.accountID);
    account.owner = update.owner;
    account.publicKeyX = update.publicKeyX;
    account.publicKeyY = update.publicKeyY;
    account.nonce++;

    const balance = account.getBalance(update.feeTokenID);
    balance.balance.isub(update.fee);

    const operator = state.getAccount(block.operatorAccountID);
    const balanceO = operator.getBalance(update.feeTokenID);
    balanceO.balance.iadd(update.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static updateAMM(
    state: ExchangeState,
    block: TxBlock,
    update: AmmUpdate
  ) {
    const account = state.getAccount(update.accountID);
    const balance = account.getBalance(update.tokenID);

    account.nonce++;
    account.feeBipsAMM = update.feeBips;
    balance.weightAMM = update.tokenWeight;

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static transfer(
    state: ExchangeState,
    block: TxBlock,
    transfer: Transfer
  ) {
    const from = state.getAccount(transfer.fromAccountID);
    const to = state.getAccount(transfer.toAccountID);
    to.owner = transfer.to;

    from.getBalance(transfer.tokenID).balance.isub(transfer.amount);
    to.getBalance(transfer.tokenID).balance.iadd(transfer.amount);

    from.getBalance(transfer.feeTokenID).balance.isub(transfer.fee);

    // Nonce
    const storage = from
      .getBalance(transfer.tokenID)
      .getStorage(transfer.storageID);
    storage.data = new BN(1);
    storage.storageID = transfer.storageID;

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(transfer.feeTokenID).balance.iadd(transfer.fee);

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static withdraw(
    state: ExchangeState,
    block: TxBlock,
    withdrawal: WithdrawalRequest
  ) {
    const account = state.getAccount(withdrawal.accountID);
    let amount = withdrawal.amount;
    if (withdrawal.type === 2) {
      amount = account.getBalance(withdrawal.tokenID).balance;
      account.getBalance(withdrawal.tokenID).weightAMM = new BN(0);
    } else if (withdrawal.type === 3) {
      amount = new BN(0);
    }
    account.getBalance(withdrawal.tokenID).balance.isub(amount);
    account.getBalance(withdrawal.feeTokenID).balance.isub(withdrawal.fee);

    const operator = state.getAccount(block.operatorAccountID);
    operator.getBalance(withdrawal.feeTokenID).balance.iadd(withdrawal.fee);

    if (withdrawal.type === 0 || withdrawal.type === 1) {
      // Nonce
      const storageSlot = withdrawal.storageID % Constants.NUM_STORAGE_SLOTS;
      const storage = account
        .getBalance(withdrawal.tokenID)
        .getStorage(storageSlot);
      storage.storageID = withdrawal.storageID;
      storage.data = new BN(1);
    }

    const simulatorReport: SimulatorReport = {
      exchangeStateAfter: state
    };
    return simulatorReport;
  }

  public static spotTrade(
    state: ExchangeState,
    block: TxBlock,
    spotTrade: SpotTrade
  ) {
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
    if (spotTrade.orderA.fillAmountBorS) {
      matchResult = this.match(
        spotTrade.orderA,
        fillA,
        spotTrade.orderB,
        fillB
      );
      fillA.S = fillB.B;
    } else {
      matchResult = this.match(
        spotTrade.orderB,
        fillB,
        spotTrade.orderA,
        fillA
      );
      fillA.B = fillB.S;
    }
    logDebug("spread:     " + matchResult.spread.toString(10));

    let valid = matchResult.matchable;
    valid =
      valid &&
      this.checkValid(spotTrade.orderA, fillA.S, fillA.B, block.timestamp);
    valid =
      valid &&
      this.checkValid(spotTrade.orderB, fillB.S, fillB.B, block.timestamp);

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
      spotTrade.orderA.fillAmountBorS,
      spotTrade.orderB.fillAmountBorS,
      spotTrade.orderA.tokenIdS,
      spotTrade.orderB.tokenIdS,
      spotTrade.orderA.storageID,
      spotTrade.orderA.accountID,
      spotTrade.orderA.feeBips,
      spotTrade.orderB.storageID,
      spotTrade.orderB.accountID,
      spotTrade.orderB.feeBips
    );

    // Check expected
    if (spotTrade.expected) {
      if (spotTrade.expected.orderA) {
        const filledFraction = spotTrade.orderA.fillAmountBorS
          ? fillB.S.mul(new BN(10000))
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
        const filledFraction = spotTrade.orderB.fillAmountBorS
          ? fillA.S.mul(new BN(10000))
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
    feeBipsB: number
  ) {
    const fillBA = fillSB;
    const fillBB = fillSA;

    /*console.log("Simulator: ");
    console.log("fillSA: " + fillSA.toString(10));
    console.log("fillBA: " + fillBA.toString(10));
    console.log("fillSB: " + fillSB.toString(10));
    console.log("fillBB: " + fillBB.toString(10));*/

    const [feeA, protocolFeeA] = this.calculateFees(
      fillBA,
      protocolFeeTakerBips,
      feeBipsA
    );

    const [feeB, protocolFeeB] = this.calculateFees(
      fillBB,
      protocolFeeMakerBips,
      feeBipsB
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
      fillSB,
      fillBB,
      feeB,
      protocolFeeB
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
    fillAmountBorSA: boolean,
    fillAmountBorSB: boolean,
    tokenA: number,
    tokenB: number,
    storageIdA: number,
    accountIdA: number,
    feeBipsA: number,
    storageIdB: number,
    accountIdB: number,
    feeBipsB: number
  ) {
    const s = this.calculateSettlementValues(
      protocolFeeTakerBips,
      protocolFeeMakerBips,
      fillSA,
      fillSB,
      feeBipsA,
      feeBipsB
    );

    // Update accountA
    {
      const accountA = state.getAccount(accountIdA);
      accountA.getBalance(tokenA).balance.isub(s.fillSA);
      accountA
        .getBalance(tokenB)
        .balance.iadd(s.fillBA)
        .isub(s.feeA);

      const tradeHistoryA = accountA.getBalance(tokenA).getStorage(storageIdA);
      tradeHistoryA.data =
        storageIdA > tradeHistoryA.storageID ? new BN(0) : tradeHistoryA.data;
      tradeHistoryA.data.iadd(fillAmountBorSA ? s.fillBA : s.fillSA);
      tradeHistoryA.storageID = storageIdA;
    }
    // Update accountB
    {
      const accountB = state.getAccount(accountIdB);
      accountB.getBalance(tokenB).balance.isub(s.fillSB);
      accountB
        .getBalance(tokenA)
        .balance.iadd(s.fillBB)
        .isub(s.feeB);

      const tradeHistoryB = accountB.getBalance(tokenB).getStorage(storageIdB);
      tradeHistoryB.data =
        storageIdB > tradeHistoryB.storageID ? new BN(0) : tradeHistoryB.data;
      tradeHistoryB.data.iadd(fillAmountBorSB ? s.fillBB : s.fillSB);
      tradeHistoryB.storageID = storageIdB;
    }

    // Update protocol fee
    const protocol = state.getAccount(0);
    protocol.getBalance(tokenA).balance.iadd(s.protocolFeeB);
    protocol.getBalance(tokenB).balance.iadd(s.protocolFeeA);

    // Update operator
    const operator = state.getAccount(operatorId);
    operator
      .getBalance(tokenA)
      .balance.iadd(s.feeB)
      .isub(s.protocolFeeB);
    operator
      .getBalance(tokenB)
      .balance.iadd(s.feeA)
      .isub(s.protocolFeeA);

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
      if (order.fillAmountBorS) {
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
    const storageSlot = order.storageID % Constants.NUM_STORAGE_SLOTS;
    const tradeHistory = accountData
      .getBalance(order.tokenIdS)
      .getStorage(order.storageID);
    // Trade history trimming
    const leafStorageID =
      tradeHistory.storageID === 0 ? storageSlot : tradeHistory.storageID;
    const filled =
      leafStorageID === order.storageID ? tradeHistory.data : new BN(0);
    return filled;
  }

  private static getMaxFillAmounts(order: OrderInfo, accountData: any) {
    const tradeHistoryFilled = this.getFilled(order, accountData);
    const balanceS = new BN(accountData.balances[order.tokenIdS].balance);

    let remainingS = new BN(0);
    if (order.fillAmountBorS) {
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
    feeBips: number
  ) {
    const protocolFee = fillB.mul(new BN(protocolFeeBips)).div(new BN(100000));
    const fee = fillB.mul(new BN(feeBips)).div(new BN(10000));
    return [fee, protocolFee];
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
      valid && this.ensure(timestamp <= order.validUntil, "order too late");
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

      const storage: { [key: number]: Storage } = {};
      for (const storageID of Object.keys(balanceValue.storage)) {
        const storageValue = balanceValue.storage[Number(storageID)];
        storage[Number(storageID)] = {
          data: new BN(storageValue.data.toString(10)),
          storageID: storageValue.storageID
        };
      }
      balances[Number(tokenID)] = new Balance();
      balances[Number(tokenID)].init(
        balanceValue.balance,
        balanceValue.weightAMM,
        storage
      );
    }
    const accountCopy = new AccountLeaf();
    accountCopy.init(
      account.owner,
      account.publicKeyX,
      account.publicKeyY,
      account.nonce,
      account.feeBipsAMM,
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
    return assert(
      Math.abs(n1 - n2) < 10 ** precision,
      description + ". " + n1 + " but expected " + n2
    );
  }

  public static prettyPrintBalance(
    accountID: number,
    tokenID: number,
    balance: BN
  ) {
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
    const before = accountBefore
      .getBalance(order.tokenIdS)
      .getStorage(order.storageID);
    const after = accountAfter
      .getBalance(order.tokenIdS)
      .getStorage(order.storageID);
    const filledBeforePercentage = before.data
      .mul(new BN(100))
      .div(order.fillAmountBorS ? order.amountB : order.amountS);
    const filledAfterPercentage = after.data
      .mul(new BN(100))
      .div(order.fillAmountBorS ? order.amountB : order.amountS);
    const filledBeforePretty = this.getPrettyAmount(
      order.fillAmountBorS ? order.tokenIdB : order.tokenIdS,
      before.data
    );
    const filledAfterPretty = this.getPrettyAmount(
      order.fillAmountBorS ? order.tokenIdB : order.tokenIdS,
      after.data
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
        order.storageID +
        ")"
    );
  }
}
