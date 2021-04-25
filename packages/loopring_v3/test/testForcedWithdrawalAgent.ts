import { ExchangeTestUtil } from "./testExchangeUtil";
import BN = require("bn.js");

contract("ForcedWithdrawalAgent", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  let forcedWithdrawalAgent: any;

  const ForcedWithdrawalAgent = artifacts.require("ForcedWithdrawalAgent");
  const AgentRegistry = artifacts.require("AgentRegistry");

  const fakeToken = "0x" + "10".repeat(20);

  let withdrawalFee: BN;

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
    await ctx.createExchange(accounts[0], { useOwnerContract: false });

    forcedWithdrawalAgent = await ForcedWithdrawalAgent.new();

    // make forcedWithdrawalAgent as a universalAgent:
    const agentRegistry = await AgentRegistry.new();
    await ctx.exchange.setAgentRegistry(agentRegistry.address);
    // console.log("agentRegistry:", agentRegistry.address);
    await agentRegistry.registerUniversalAgent(
      forcedWithdrawalAgent.address,
      true
    );

    // register fake Token:
    await ctx.exchange.registerToken(fakeToken);

    // Get the forced withdrawal fee
    withdrawalFee = await ctx.loopringV3.forcedWithdrawalFee();
  });

  it("owner should be able to do forced withdrawals for any user", async () => {
    // ForcedWithdrawalRequested
    const exchangeAddress = ctx.exchange.address;
    const owner = "0x" + "11".repeat(20);
    const accountId = 1;
    await forcedWithdrawalAgent.doForcedWithdrawalFor(
      exchangeAddress,
      owner,
      fakeToken,
      accountId,
      {
        value: withdrawalFee,
        from: accounts[0]
      }
    );

    const fromBlock = await web3.eth.getBlockNumber();
    // console.log("fromBlock:", fromBlock);
    const events = await ctx.exchange.getPastEvents(
      "ForcedWithdrawalRequested",
      {
        fromBlock,
        toBlock: "latest"
      }
    );

    const forcedWithdrawalEvent = events[0];
    assert(
      owner === forcedWithdrawalEvent.returnValues.owner,
      "owner not equal"
    );
    assert(
      fakeToken === forcedWithdrawalEvent.returnValues.token,
      "token address not equal"
    );
    assert(
      accountId == forcedWithdrawalEvent.returnValues.accountID,
      "accountId not equal"
    );
  });

  it("manager should be able to do forced withdrawals for any user", async () => {
    const manager = accounts[1];
    await forcedWithdrawalAgent.addManager(manager);

    // ForcedWithdrawalRequested
    const exchangeAddress = ctx.exchange.address;
    const owner = "0x" + "22".repeat(20);
    const accountId = 2;
    await forcedWithdrawalAgent.doForcedWithdrawalFor(
      exchangeAddress,
      owner,
      fakeToken,
      accountId,
      {
        value: withdrawalFee,
        from: manager
      }
    );

    const fromBlock = await web3.eth.getBlockNumber();
    // console.log("fromBlock:", fromBlock);
    const events = await ctx.exchange.getPastEvents(
      "ForcedWithdrawalRequested",
      {
        fromBlock,
        toBlock: "latest"
      }
    );

    const forcedWithdrawalEvent = events[0];
    assert(
      owner === forcedWithdrawalEvent.returnValues.owner,
      "owner not equal"
    );
    assert(
      fakeToken === forcedWithdrawalEvent.returnValues.token,
      "token address not equal"
    );
    assert(
      accountId == forcedWithdrawalEvent.returnValues.accountID,
      "accountId not equal"
    );
  });

  it("other user should not be able to do forced withdrawals for any user", async () => {
    // ForcedWithdrawalRequested
    const exchangeAddress = ctx.exchange.address;
    const owner = "0x" + "33".repeat(20);
    const accountId = 3;
    try {
      await forcedWithdrawalAgent.doForcedWithdrawalFor(
        exchangeAddress,
        owner,
        fakeToken,
        accountId,
        {
          value: withdrawalFee,
          from: accounts[2]
        }
      );

      assert(false, "other user can do forced withdrawals");
    } catch (err) {
      // console.log("err:", err);
      assert(err.message.includes("NOT_OWNER_OR_MANAGER"), "unexpected_error");
    }
  });

  it("owner can drain ETH from agent", async () => {
    await web3.eth.sendTransaction({
      from: accounts[3],
      to: forcedWithdrawalAgent.address,
      value: web3.utils.toWei("1.0", "ether")
    });
    const balanceBefore = await web3.eth.getBalance(
      forcedWithdrawalAgent.address
    );
    assert(balanceBefore > 0, "invalid balance");
    await forcedWithdrawalAgent.drain(accounts[0], "0x" + "00".repeat(20));
    const balanceAfter = await web3.eth.getBalance(
      forcedWithdrawalAgent.address
    );
    assert(balanceAfter == 0, "invalid balance");
  });
});
