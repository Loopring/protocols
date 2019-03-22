import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Operator } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const registerOperatorChecked = async (stateID: number, owner: string) => {
    const activeOperatorsBefore = await exchangeTestUtil.getActiveOperators(stateID);
    const operator = await exchangeTestUtil.createOperator(stateID, owner);
    exchangeTestUtil.addOperator(stateID, operator);
    const activeOperatorsAfter = await exchangeTestUtil.getActiveOperators(stateID);
    const bOperatorRegistered = await exchange.isOperatorRegistered(stateID, operator.operatorID);

    const activeOperatorIdx = activeOperatorsBefore.length;
    assert.equal(activeOperatorsAfter.length, activeOperatorsBefore.length + 1,
                "Operator should be added to the list of active operators");
    assert.equal(activeOperatorsAfter[activeOperatorIdx].owner, owner, "owner should match");
    assert(bOperatorRegistered, "Operator should be registered");

    return operator;
  };

  const unregisterOperatorChecked = async (stateID: number, operator: Operator) => {
    const bOperatorRegisteredBefore = await exchange.isOperatorRegistered(stateID, operator.operatorID);
    const activeOperatorsBefore = await exchangeTestUtil.getActiveOperators(stateID);

    await exchange.unregisterOperator(stateID, operator.operatorID, {from: operator.owner});

    const bOperatorRegisteredAfter = await exchange.isOperatorRegistered(stateID, operator.operatorID);
    const activeOperatorsAfter = await exchangeTestUtil.getActiveOperators(stateID);

    assert(bOperatorRegisteredBefore, "Operator should be registered before");
    assert(!bOperatorRegisteredAfter, "Operator should be unregistered after");

    assert.equal(activeOperatorsBefore.length, activeOperatorsAfter.length + 1, "Operator should not be active");
    // Add the operator back to the list and sort the lists so they match exactly
    activeOperatorsAfter.push(operator);
    activeOperatorsBefore.sort((o1: Operator, o2: Operator) => o1.operatorID - o2.operatorID);
    activeOperatorsAfter.sort((o1: Operator, o2: Operator) => o1.operatorID - o2.operatorID);
    for (let i = 0; i < activeOperatorsBefore.length; i++) {
      const operatorA = activeOperatorsAfter[i];
      const operatorB = activeOperatorsBefore[i];
      assert.equal(operatorA.operatorID, operatorB.operatorID, "Operators should match");
      assert.equal(operatorA.owner, operatorB.owner, "Operators should match");
    }
  };

  const withdrawOperatorStakeChecked = async (stateID: number, operator: Operator) => {
    const lrcBalanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, "LRC");
    const lrcBalanceOperatorBefore = await exchangeTestUtil.getOnchainBalance(operator.owner, "LRC");
    await exchange.withdrawOperatorStake(web3.utils.toBN(stateID), operator.operatorID);
    const lrcBalanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, "LRC");
    const lrcBalanceOperatorAfter = await exchangeTestUtil.getOnchainBalance(operator.owner, "LRC");

    assert(lrcBalanceContractBefore.eq(lrcBalanceContractAfter.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC balance of exchange needs to be reduced by STAKE_AMOUNT_IN_LRC");
    assert(lrcBalanceOperatorAfter.eq(lrcBalanceOperatorBefore.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC balance of operator needs to be increased by STAKE_AMOUNT_IN_LRC");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("Operators", function() {
    this.timeout(0);

    it("Register operator", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], true, 0);
      await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[0]);
      await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[1]);
      await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[2]);
    });

    it("Unregister operator", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], true, 0);

      const operatorA = await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[0]);
      const operatorB = await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[1]);
      const operatorC = await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[2]);

      // Try to unregister an operator from a different address
      await expectThrow(
        exchange.unregisterOperator(stateID, operatorA.operatorID, {from: operatorB.owner}),
        "UNAUTHORIZED",
      );

      await unregisterOperatorChecked(stateID, operatorB);
      await unregisterOperatorChecked(stateID, operatorC);
      await unregisterOperatorChecked(stateID, operatorA);

      // Try to unregister an operator twice
      await expectThrow(
        exchange.unregisterOperator(stateID, operatorC.operatorID, {from: operatorC.owner}),
        "OPERATOR_UNREGISTERED_ALREADY",
      );
    });

    it("Withdraw operator stake", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], true, 0);

      // Register an operator
      const operator = await registerOperatorChecked(stateID, exchangeTestUtil.testContext.operators[0]);

      // Jump forward a bit in time
      await exchangeTestUtil.advanceBlockTimestamp(60 * 24 * 3600);

      // Try to withdraw the operator stake while still registered
      await expectThrow(
        exchange.withdrawOperatorStake(web3.utils.toBN(stateID), operator.operatorID),
        "OPERATOR_STILL_REGISTERED",
      );

      // Unregister the operator
      await unregisterOperatorChecked(stateID, operator);

      // Try to withdraw the operator stake too early
      await expectThrow(
        exchange.withdrawOperatorStake(web3.utils.toBN(stateID), operator.operatorID),
        "TOO_EARLY_TO_WITHDRAW",
      );

      await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW - 100);

      // Try to withdraw the operator stake too early
      await expectThrow(
        exchange.withdrawOperatorStake(web3.utils.toBN(stateID), operator.operatorID),
        "TOO_EARLY_TO_WITHDRAW",
      );

      await exchangeTestUtil.advanceBlockTimestamp(200);

      // Withdraw successfully
      await withdrawOperatorStakeChecked(stateID, operator);

      // Try to withdraw again
      await expectThrow(
        exchange.withdrawOperatorStake(web3.utils.toBN(stateID), operator.operatorID),
        "WITHDRAWN_ALREADY",
      );
    });

    it("Register operator with insufficient stake amount", async () => {
      const stateID = await exchangeTestUtil.createNewState(exchangeTestUtil.testContext.stateOwners[0], true, 0);
      const owner = exchangeTestUtil.testContext.stateOwners[0];

      // No funds
      await expectThrow(
        exchange.registerOperator(web3.utils.toBN(stateID), {from: owner}),
        "TRANSFER_FAILURE",
      );

      // Give the operator almost enough tokens
      await exchangeTestUtil.setBalanceAndApprove(owner, "LRC", exchangeTestUtil.STAKE_AMOUNT_IN_LRC.sub(new BN(1)));
      await expectThrow(
        exchange.registerOperator(web3.utils.toBN(stateID), {from: owner}),
        "TRANSFER_FAILURE",
      );

      // Give the operator enough tokens
      await exchangeTestUtil.setBalanceAndApprove(owner, "LRC", exchangeTestUtil.STAKE_AMOUNT_IN_LRC);
      await exchange.registerOperator(web3.utils.toBN(stateID), {from: owner});
    });

  });
});
