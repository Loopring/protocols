import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { Constants } from "loopringV3.js";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (bSetupTestState: boolean = true) => {
    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  const authorizeAgentsChecked = async (
    owner: string,
    agents: string[],
    authorized: boolean[],
    from: string
  ) => {
    await exchange.authorizeAgents(owner, agents, authorized, { from });
    const events = await exchangeTestUtil.assertEventsEmitted(
      exchange,
      "AgentAuthorized",
      agents.length
    );
    for (const [i, event] of events.entries()) {
      assert.equal(event.owner, owner, "AgentAuthorized owner unexpected");
      assert.equal(event.agent, agents[i], "AgentAuthorized agent unexpected");
      assert.equal(
        event.authorized,
        authorized[i],
        "AgentAuthorized authorized unexpected"
      );

      const isAgent = await exchange.isAgent(owner, agents[i]);
      assert.equal(isAgent, authorized[i], "isAgent unexpected");
    }
  };

  const onchainTransferFromChecked = async (
    from: string,
    to: string,
    token: string,
    amount: BN,
    sender: string
  ) => {
    token = exchangeTestUtil.getTokenAddress(token);

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(from, to, token, amount, "from", "to");

    // Do the transfer
    await exchange.onchainTransferFrom(from, to, token, amount, {
      from: sender
    });

    // Verify balances
    await snapshot.verifyBalances();
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);

    ownerA = exchangeTestUtil.testContext.orderOwners[0];
    ownerB = exchangeTestUtil.testContext.orderOwners[1];
    ownerC = exchangeTestUtil.testContext.orderOwners[2];
    ownerD = exchangeTestUtil.testContext.orderOwners[3];
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Agents", function() {
    this.timeout(0);

    it("should be able to authorize and deauthorize an agent", async () => {
      await createExchange();

      // Only the owner should be able to authorize the first agent
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerB], [true], ownerB),
        "UNAUTHORIZED"
      );

      // Authorize an agent
      await authorizeAgentsChecked(ownerA, [ownerB], [true], ownerA);

      // Try to authorize another agent using a non-agent address
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerD], [true], ownerC),
        "UNAUTHORIZED"
      );

      // Authorize a new agent using an agent
      await authorizeAgentsChecked(ownerA, [ownerC], [true], ownerB);

      // Deauthorize the old agent with the new agent
      await authorizeAgentsChecked(ownerA, [ownerB], [false], ownerC);

      // Make sure the deauthorized agent isn't an agent anymore
      await expectThrow(
        authorizeAgentsChecked(ownerA, [ownerD], [true], ownerB),
        "UNAUTHORIZED"
      );
    });

    it("should be able to call agent functions", async () => {
      await createExchange();

      const withdrawalFee = await exchangeTestUtil.loopringV3.forcedWithdrawalFee();
      const depositFee = exchangeTestUtil.getRandomFee();

      const agent = ownerC;

      const token = exchangeTestUtil.getTokenAddress("LRC");

      await expectThrow(
        exchange.deposit(ownerA, ownerA, token, new BN(0), "0x", {
          from: agent,
          value: depositFee
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.forceWithdraw(ownerA, token, 0, {
          from: agent,
          value: withdrawalFee
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.authorizeAgents(ownerA, [agent], [true], { from: agent }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.approveTransaction(ownerA, Buffer.from("FF"), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.approveOffchainTransfer(ownerA, ownerB, token, new BN(0), token, new BN(0), new BN(1), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      await expectThrow(
        exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
          from: agent
        }),
        "UNAUTHORIZED"
      );

      // Authorize the agent
      await authorizeAgentsChecked(ownerA, [agent], [true], ownerA);

      // Now call the functions successfully

      await exchange.deposit(ownerA, ownerA, token, new BN(0), "0x", {
        from: agent,
        value: depositFee
      });

      await exchange.forceWithdraw(ownerA, token, 0, {
        from: agent,
        value: withdrawalFee
      });

      await exchange.authorizeAgents(ownerA, [agent], [true], { from: agent });

      await exchange.approveTransaction(ownerA, Buffer.from("FF"), {
        from: agent
      });

      await exchange.approveOffchainTransfer(ownerA, ownerB, token, new BN(0), token, new BN(0), new BN(1), {
        from: agent
      });

      await exchange.onchainTransferFrom(ownerA, ownerB, token, new BN(0), {
        from: agent
      });
    });

    it("agent should be able to transfer onchain funds", async () => {
      await createExchange();

      const amount = new BN(web3.utils.toWei("412.8", "ether"));

      // Authorize an agent
      await authorizeAgentsChecked(ownerA, [ownerD], [true], ownerA);

      await exchangeTestUtil.setBalanceAndApprove(ownerA, "LRC", amount);
      // Transfer the tokens
      await onchainTransferFromChecked(
        ownerA,
        ownerB,
        "LRC",
        amount.div(new BN(2)),
        ownerA
      );
      await onchainTransferFromChecked(
        ownerA,
        ownerC,
        "LRC",
        amount.div(new BN(2)),
        ownerD
      );

      // Try to transfer again after all funds depleted
      await expectThrow(
        onchainTransferFromChecked(
          ownerA,
          ownerC,
          "LRC",
          amount.div(new BN(2)),
          ownerD
        ),
        "TRANSFER_FAILED"
      );
    });
  });
});
