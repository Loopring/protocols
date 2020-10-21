import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { expectThrow } from "./expectThrow";

contract("DelayedOwner", (accounts: string[]) => {
  let contracts: Artifacts;
  let targetContract: any;
  let delayedContract: any;
  let targetInterface: any;

  let exchangeTestUtil: ExchangeTestUtil;

  let TTL: number;
  let MAGIC_VALUE: BN;

  let oldValue: BN;
  const newValue = new BN(123);

  const getFunctionSelector = (functionCall: any) => {
    return functionCall.encodeABI().slice(0, 10);
  };

  const getFunctionDelay = async (to: string, functionSelector: string) => {
    return (await delayedContract.getFunctionDelay(
      to,
      functionSelector
    )).toNumber();
  };

  const checkFunctionDelay = async (
    to: string,
    functionSelector: string,
    delay: number
  ) => {
    const functionDelay = await getFunctionDelay(to, functionSelector);
    assert.equal(functionDelay, delay, "invalid function delay");
  };

  const setFunctionDelayChecked = async (
    to: string,
    functionSelector: string,
    delay: number
  ) => {
    await delayedContract.setFunctionDelayExternal(
      to,
      functionSelector,
      new BN(delay)
    );
    await checkFunctionDelay(to, functionSelector, delay);
  };

  const cancelTransactionChecked = async (id: BN) => {
    await delayedContract.cancelTransaction(id);
    await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionCancelled",
      (event: any) => {
        return event.id.eq(id);
      }
    );
  };

  const checkNumDelayedFunctions = async (numExpected: number) => {
    const numDelayedFunctions = (await delayedContract.getNumDelayedFunctions()).toNumber();
    assert.equal(
      numDelayedFunctions,
      numExpected,
      "unexpected number of delayed functions"
    );
  };

  const checkNumPendingTransactions = async (numExpected: number) => {
    const numPendingTransactions = (await delayedContract.getNumPendingTransactions()).toNumber();
    assert.equal(
      numPendingTransactions,
      numExpected,
      "unexpected number of pending transactions"
    );
  };

  before(async () => {
    contracts = new Artifacts(artifacts);
    exchangeTestUtil = new ExchangeTestUtil();
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    targetContract = await contracts.DelayedTargetContract.new();
    delayedContract = await contracts.DelayedOwnerContract.new(
      targetContract.address,
      true
    );
    targetInterface = await contracts.DelayedTargetContract.at(
      delayedContract.address
    );

    TTL = (await delayedContract.timeToLive()).toNumber();
    MAGIC_VALUE = await targetContract.MAGIC_VALUE();

    oldValue = await targetContract.value();
    assert(!oldValue.eq(newValue), "invalid test value");
  });

  it("Set function delay", async () => {
    // Create a new delayed contract without any function delays set
    targetContract = await contracts.DelayedTargetContract.new();
    delayedContract = await contracts.DelayedOwnerContract.new(
      targetContract.address,
      false
    );

    // Set some function delays
    await setFunctionDelayChecked(accounts[1], "0x00000001", 1);
    await setFunctionDelayChecked(accounts[2], "0x00000002", 2);
    await setFunctionDelayChecked(accounts[3], "0x00000003", 3);
    await checkNumDelayedFunctions(3);

    // Remove the delay of 2
    await setFunctionDelayChecked(accounts[2], "0x00000002", 0);
    await checkNumDelayedFunctions(2);
    // Check if the function delays of the remaining functions are still correct
    await checkFunctionDelay(accounts[1], "0x00000001", 1);
    await checkFunctionDelay(accounts[3], "0x00000003", 3);

    // Remove the delay of 1
    await setFunctionDelayChecked(accounts[1], "0x00000001", 0);
    await checkNumDelayedFunctions(1);
    // Check if the function delays of the remaining functions are still correct
    await checkFunctionDelay(accounts[3], "0x00000003", 3);

    // Remove the delay of 3
    await setFunctionDelayChecked(accounts[3], "0x00000003", 0);
    await checkNumDelayedFunctions(0);
  });

  it("Immediate function (payable)", async () => {
    const ethToTransfer = new BN(web3.utils.toWei("1.23", "ether"));

    // Check function delay
    await checkFunctionDelay(
      targetContract.address,
      getFunctionSelector(
        targetContract.contract.methods.immediateFunctionPayable(0)
      ),
      0
    );

    // Store the amount of ETH in the contract before the call
    const balanceBefore = new BN(
      await web3.eth.getBalance(targetContract.address)
    );

    await targetInterface.immediateFunctionPayable(newValue, {
      value: ethToTransfer
    });
    assert(
      (await targetContract.value()).eq(newValue),
      "Test value unexpected"
    );
    await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionExecuted"
    );
    await checkNumPendingTransactions(0);

    // Check the amount of ETH in the contract after the call
    const balanceAfter = new BN(
      await web3.eth.getBalance(targetContract.address)
    );
    assert(
      balanceAfter.eq(balanceBefore.add(ethToTransfer)),
      "ETH balance target contract incorrect"
    );
  });

  it("Immediate function (revert)", async () => {
    // Check function delay
    await checkFunctionDelay(
      targetContract.address,
      getFunctionSelector(
        targetContract.contract.methods.immediateFunctionRevert(0)
      ),
      0
    );

    // Make sure the expected revert message is thrown
    await expectThrow(
      targetInterface.immediateFunctionRevert(0),
      "IMMEDIATE_REVERT"
    );
  });

  it("Delayed function (payable)", async () => {
    const ethToTransfer = new BN(web3.utils.toWei("2.34", "ether"));

    const functionSelector = getFunctionSelector(
      targetContract.contract.methods.delayedFunctionPayable(0)
    );
    const functionDelay = await getFunctionDelay(
      targetContract.address,
      functionSelector
    );
    assert(functionDelay > 0, "invalid function delay");

    // Store the amount of ETH in the contract before the call
    const balanceBefore = new BN(
      await web3.eth.getBalance(targetContract.address)
    );

    // Call the delayed function
    await targetInterface.delayedFunctionPayable(newValue, {
      value: ethToTransfer
    });
    assert(
      (await targetContract.value()).eq(oldValue),
      "Test value unexpected"
    );
    const event = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await checkNumPendingTransactions(1);

    // Try to execute the transaction too early
    await expectThrow(
      delayedContract.executeTransaction(event.id),
      "TOO_EARLY"
    );
    assert((await targetContract.value()).eq(oldValue));

    // Wait
    await exchangeTestUtil.advanceBlockTimestamp(functionDelay - 100);

    // Try to execute the transaction too early
    await expectThrow(
      delayedContract.executeTransaction(event.id),
      "TOO_EARLY"
    );
    assert((await targetContract.value()).eq(oldValue));

    // Wait
    await exchangeTestUtil.advanceBlockTimestamp(200);

    // Balance of the target contract should still be the same
    assert(
      new BN(await web3.eth.getBalance(targetContract.address)).eq(
        balanceBefore
      ),
      "ETH balance target contract incorrect"
    );

    // Now execute it after the necessary delay
    await delayedContract.executeTransaction(event.id);
    assert(
      (await targetContract.value()).eq(newValue),
      "Test value unexpected"
    );
    await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "PendingTransactionExecuted"
    );
    await checkNumPendingTransactions(0);

    // Try to execute the same delayed transaction again
    await expectThrow(
      delayedContract.executeTransaction(event.id),
      "TRANSACTION_NOT_FOUND"
    );

    // Check the amount of ETH in the contract after the call
    const balanceAfter = new BN(
      await web3.eth.getBalance(targetContract.address)
    );
    assert(
      balanceAfter.eq(balanceBefore.add(ethToTransfer)),
      "ETH balance target contract incorrect"
    );
  });

  it("Delayed function (revert)", async () => {
    // Call the delayed function
    await targetInterface.delayedFunctionRevert(0);
    assert(
      (await targetContract.value()).eq(oldValue),
      "Test value unexpected"
    );
    const event = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );

    // Wait
    await exchangeTestUtil.advanceBlockTimestamp(event.delay.toNumber() + 100);

    // Make sure the expected revert message is thrown
    await expectThrow(
      delayedContract.executeTransaction(event.id),
      "DELAYED_REVERT"
    );
  });

  it("Cancel pending transactions", async () => {
    // Execture a few transactions that will be delayed
    await targetInterface.delayedFunctionPayable(0);
    const eventA = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(1);
    const eventB = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(2);
    const eventC = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(3);
    const eventD = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await checkNumPendingTransactions(4);

    // Now cancel a couple of transactions
    await cancelTransactionChecked(eventC.id);
    await cancelTransactionChecked(eventD.id);
    await cancelTransactionChecked(eventA.id);
    await checkNumPendingTransactions(1);

    // Try to cancel the a transaction twice
    await expectThrow(
      delayedContract.executeTransaction(eventD.id),
      "TRANSACTION_NOT_FOUND"
    );

    // Execute the last non-cancelled transaction
    await exchangeTestUtil.advanceBlockTimestamp(eventB.delay.toNumber() + 100);
    await delayedContract.executeTransaction(eventB.id);
    assert(
      (await targetContract.value()).eq(new BN(1)),
      "Test value unexpected"
    );
    await checkNumPendingTransactions(0);

    // Try to cancel the transaction after it has been executed
    await expectThrow(
      delayedContract.executeTransaction(eventB.id),
      "TRANSACTION_NOT_FOUND"
    );
  });

  it("Cancel all pending transactions", async () => {
    // Execture a few transactions that will be delayed
    await targetInterface.delayedFunctionPayable(0);
    const eventA = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(1);
    const eventB = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(2);
    const eventC = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await targetInterface.delayedFunctionPayable(3);
    const eventD = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );
    await checkNumPendingTransactions(4);

    // Put all pending transactions in a list
    const transactionIds = [eventA.id, eventB.id, eventC.id, eventD.id];

    // Cancel all transactions
    await delayedContract.cancelAllTransactions();
    await exchangeTestUtil.assertEventsEmitted(
      delayedContract,
      "TransactionCancelled",
      transactionIds.length
    );
    await checkNumPendingTransactions(0);

    // Try to execture or cancel the transactions again
    for (const transactionId of transactionIds) {
      await expectThrow(
        delayedContract.executeTransaction(transactionId),
        "TRANSACTION_NOT_FOUND"
      );
      await expectThrow(
        delayedContract.cancelTransaction(transactionId),
        "TRANSACTION_NOT_FOUND"
      );
    }
  });

  it("Transaction expired by TTL", async () => {
    const ethToTransfer = new BN(web3.utils.toWei("2.34", "ether"));

    const functionSelectorA = getFunctionSelector(
      targetContract.contract.methods.delayedFunctionPayable(0)
    );
    const functionDelayA = await getFunctionDelay(
      targetContract.address,
      functionSelectorA
    );
    assert(functionDelayA > 0, "invalid function delay");

    // Store the amount of ETH in the contract before the call
    const balanceBefore = new BN(
      await web3.eth.getBalance(delayedContract.address)
    );

    // Call the delayed function
    await targetInterface.delayedFunctionPayable(newValue, {
      value: ethToTransfer
    });
    assert(
      (await targetContract.value()).eq(oldValue),
      "Test value unexpected"
    );
    const eventA = await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionDelayed"
    );

    // Balance of the target contract should still be the same
    assert(
      new BN(await web3.eth.getBalance(delayedContract.address)).eq(
        balanceBefore.add(ethToTransfer)
      ),
      "ETH balance target contract incorrect"
    );

    // Wait
    await exchangeTestUtil.advanceBlockTimestamp(functionDelayA + TTL + 100);

    // Try to execute the transaction too late
    await expectThrow(
      delayedContract.executeTransaction(eventA.id),
      "TOO_LATE"
    );
    assert((await targetContract.value()).eq(oldValue));

    // Balance of the target contract should still be the same
    assert(
      new BN(await web3.eth.getBalance(delayedContract.address)).eq(
        balanceBefore.add(ethToTransfer)
      ),
      "ETH balance target contract incorrect"
    );

    // Now cancel the transaction
    await delayedContract.cancelTransaction(eventA.id);
    assert(
      (await targetContract.value()).eq(oldValue),
      "Test value unexpected"
    );
    await exchangeTestUtil.assertEventEmitted(
      delayedContract,
      "TransactionCancelled"
    );

    // Try to execute the same transaction again
    await expectThrow(
      delayedContract.executeTransaction(eventA.id),
      "TRANSACTION_NOT_FOUND"
    );
    // Try to cancel the same transaction again
    await expectThrow(
      delayedContract.cancelTransaction(eventA.id),
      "TRANSACTION_NOT_FOUND"
    );

    // Check the amount of ETH in the contract after the call
    const balanceAfter = new BN(
      await web3.eth.getBalance(delayedContract.address)
    );
    assert(
      balanceAfter.eq(balanceBefore),
      "ETH balance target contract incorrect"
    );
  });

  it("should work as expected as the owner", async () => {
    const ownerContract = await contracts.DelayedOwnerContract.new(
      targetContract.address,
      true
    );

    // Set the owner to the newly created owner contract
    await targetContract.transferOwnership(ownerContract.address);

    // Claim ownership of the target contract
    {
      const calldata = await ownerContract.contract.methods
        .claimOwnership()
        .encodeABI();
      await ownerContract.transact(targetContract.address, calldata);
    }

    // Create a new owner contract that we'll transfer ownership to
    const ownerContract2 = await contracts.DelayedOwnerContract.new(
      targetContract.address,
      true
    );

    // Now transfer the ownership to the new contract (this operation is delayed)
    {
      const calldata = await ownerContract.contract.methods
        .transferOwnership(ownerContract2.address)
        .encodeABI();
      await ownerContract.transact(targetContract.address, calldata);
      // Check the TransactionDelayed event
      const delayedEvent = await exchangeTestUtil.assertEventEmitted(
        ownerContract,
        "TransactionDelayed"
      );
      // Skip forward the enforced delay
      await advanceTimeAndBlockAsync(delayedEvent.delay.toNumber());
      // Actually transfer the ownership now
      await ownerContract.executeTransaction(delayedEvent.id);
    }

    // The new owner should be able to claim ownership now
    {
      const calldata = await ownerContract2.contract.methods
        .claimOwnership()
        .encodeABI();
      await ownerContract2.transact(targetContract.address, calldata);
    }
  });
});
