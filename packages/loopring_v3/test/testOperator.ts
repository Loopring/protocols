import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, Deposit } from "./types";

contract("Operator 1", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let exchangeId = 0;
  let operator: any;

  const numSubOperators = 4;
  let subOperators: number[] = [];

  interface TestDepositBlock {
    block: Block;
    deposits: Deposit[];
  }

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  beforeEach(async () => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      true
    );
    exchange = exchangeTestUtil.exchange;
    operator = await exchangeTestUtil.contracts.Operator.new(exchange.address);
    await exchangeTestUtil.setOperatorContract(operator);

    subOperators = [];
    for (let i = 0; i < numSubOperators; i++) {
      const subOperator = await exchangeTestUtil.createOperator(
        exchangeId,
        exchangeTestUtil.testContext.operators[i]
      );
      subOperators.push(subOperator);
    }

    await exchangeTestUtil.submitTransactions();
    await exchangeTestUtil.submitPendingBlocks(exchangeId);
  });

  const commitDepositBlock = async () => {
    await exchangeTestUtil.doRandomDeposit(exchangeId);
    const blocks = await exchangeTestUtil.submitTransactions();
    assert(blocks.length === 1);
    return blocks[0];
  };

  const getActiveOperator = async () => {
    // Write your active operator selection logic here
    return subOperators[exchangeTestUtil.getRandomInt(subOperators.length)];
  };

  describe("Operator 2", function() {
    this.timeout(0);

    it("Submit blocks", async () => {
      for (let i = 0; i < 8; i++) {
        // Commit a deposit block
        await exchangeTestUtil.setActiveOperator(await getActiveOperator());
        await commitDepositBlock();
        // Verify all blocks
        await exchangeTestUtil.submitPendingBlocks(exchangeId);
        // Wait a bit
        await exchangeTestUtil.advanceBlockTimestamp(100);
      }
    });
  });
});
