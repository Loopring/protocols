import BN = require("bn.js");
import { expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";

const {
  TaxTable,
  TradeDelegate,
  DummyToken,
  LRCToken,
  WETHToken,
} = new Artifacts(artifacts);

contract("TaxTable", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[5];

  let taxTable: any;
  let tokenLRC: string;
  let tokenWETH: string;
  const token1 = "0x" + "1".repeat(40);
  const token2 = "0x" + "2".repeat(40);
  const token3 = "0x" + "3".repeat(40);
  const token4 = "0x" + "4".repeat(40);

  const DAY_TO_SECONDS = 3600 * 24;

  let LOCK_TIME: number;
  let LINEAR_UNLOCK_START_TIME: number;

  const assertNumberEqualsWithPrecision = (n1: number, n2: number, description: string, precision: number = 8) => {
    const numStr1 = (n1 / 1e18).toFixed(precision);
    const numStr2 = (n2 / 1e18).toFixed(precision);

    return assert.equal(Number(numStr1), Number(numStr2), description);
  };

  const advanceBlockTimestamp = async (seconds: number) => {
    const previousTimestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0 });
    await web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 });
    const currentTimestamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    assert(Math.abs(currentTimestamp - (previousTimestamp + seconds)) < 60,
           "Timestamp should have been increased by roughly the expected value");
  };

  const getTierRate = async (tier: number) => {
    if (tier === 1) {
      const matching = (await taxTable.TAX_MATCHING_TIER1()).toNumber();
      const P2P = (await taxTable.TAX_P2P_TIER1()).toNumber();
      return [matching, P2P];
    } else if (tier === 2) {
      const matching = (await taxTable.TAX_MATCHING_TIER2()).toNumber();
      const P2P = (await taxTable.TAX_P2P_TIER2()).toNumber();
      return [matching, P2P];
    } else if (tier === 3) {
      const matching = (await taxTable.TAX_MATCHING_TIER3()).toNumber();
      const P2P = (await taxTable.TAX_P2P_TIER3()).toNumber();
      return [matching, P2P];
    } else if (tier === 4) {
      const matching = (await taxTable.TAX_MATCHING_TIER4()).toNumber();
      const P2P = (await taxTable.TAX_P2P_TIER4()).toNumber();
      return [matching, P2P];
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenTierValue = async (tier: number) => {
    if (tier === 1) {
      return (await taxTable.TIER_1()).toNumber();
    } else if (tier === 2) {
      return (await taxTable.TIER_2()).toNumber();
    } else if (tier === 3) {
      return (await taxTable.TIER_3()).toNumber();
    } else if (tier === 4) {
      return (await taxTable.TIER_4()).toNumber();
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenRate = async (user: string, token: string) => {
    const [burnRateMatching, reductionMatching] = await taxTable.getBurnAndRebateRate(user, token, false);
    const [burnRateP2P, reductionP2P] = await taxTable.getBurnAndRebateRate(user, token, true);
    return [burnRateMatching.toNumber(), burnRateP2P.toNumber()];
  };

  const getTokenTierUpgradeAmount = async () => {
    const LRC = await DummyToken.at(tokenLRC);
    const totalLRCSupply = await LRC.totalSupply();

    const basePercentage = (await taxTable.TAX_BASE_PERCENTAGE()).toNumber();
    const upgradeCostPercentage = (await taxTable.TIER_UPGRADE_COST_PERCENTAGE()).toNumber();
    const upgradeAmount = Math.floor(totalLRCSupply * upgradeCostPercentage / basePercentage);
    return upgradeAmount;
  };

  const getMaxLockAmount = async () => {
    const LRC = await DummyToken.at(tokenLRC);
    const totalLRCSupply = await LRC.totalSupply();

    // Calculate the needed funds to upgrade the tier
    const basePercentage = (await taxTable.LOCK_BASE_PERCENTAGE()).toNumber();
    const maxLockPercentage = (await taxTable.MAX_LOCK_PERCENTAGE()).toNumber();
    const maxLockAmount = Math.floor(totalLRCSupply * maxLockPercentage / basePercentage);
    return maxLockAmount;
  };

  const addLRCBalance = async (user: string, amount: number) => {
    const LRC = await DummyToken.at(tokenLRC);
    await LRC.transfer(user, amount, {from: deployer});
    await LRC.approve(taxTable.address, amount, {from: user});
  };

  const checkTokenTier = async (user: string, token: string, expectedTier: number) => {
    const [matchingToken, P2PToken] = await getTokenRate(user, token);
    const [matchingTier, P2PTier] = await getTierRate(expectedTier);
    const tierValue = (await taxTable.getTokenTier(token)).toNumber();
    const expectedTierValue = await getTokenTierValue(expectedTier);
    assert.equal(tierValue, expectedTierValue, "Token tier needs to match expected tier");
    assert.equal(matchingToken, matchingTier, "matching rate needs to match tier " + expectedTier + " rate");
    assert.equal(P2PToken, P2PTier, "P2P rate needs to match tier " + expectedTier + " rate");
  };

  const checkRebateRate = async (user: string, expectedRate: number) => {
    const rate = (await taxTable.getRebateRate(user)).toNumber();
    assert.equal(rate, expectedRate, "User rebate rate need to match expected rate");
  };

  const checkLRCBalance = async (user: string, expectedBalance: number, description?: string) => {
    const LRC = await DummyToken.at(tokenLRC);
    const balance = (await LRC.balanceOf(user)).toNumber();
    assertNumberEqualsWithPrecision(balance, expectedBalance,
                                    description ? description : "Balance of the user should match expected balance");
  };

  const checkWithdrawableAmount = async (user: string, expectedAmount: number) => {
    const amount = (await taxTable.getWithdrawableBalance(user)).toNumber();
    assert.equal(amount, expectedAmount, "Withdrawable amount should match expected amount");
  };

  before(async () => {
    tokenLRC = LRCToken.address;
    tokenWETH = WETHToken.address;
  });

  beforeEach(async () => {
    // Fresh TaxTable and LRC token for each test
    const LRC = await DummyToken.new("Loopring", "LRC", 18, 1e+26);
    tokenLRC = LRC.address;
    taxTable = await TaxTable.new(tokenLRC, tokenWETH);

    LOCK_TIME = (await taxTable.LOCK_TIME()).toNumber();
    LINEAR_UNLOCK_START_TIME = (await taxTable.LINEAR_UNLOCK_START_TIME()).toNumber();
  });

  describe("Token tiers", () => {
    it("LRC should be tier 1", async () => {
      await checkTokenTier(user1, tokenLRC, 1);
    });

    it("WETH should be tier 2", async () => {
      await checkTokenTier(user1, tokenWETH, 2);
    });

    it("Any other tokens should default to tier 4", async () => {
      await checkTokenTier(user1, token1, 4);
    });

    it("should be able to upgrade the tier of a token for 2 years by burning enough tokens", async () => {
      const LRC = await DummyToken.at(tokenLRC);
      // current total supply
      const totalLRCSupply = await LRC.totalSupply();
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have a bit more balance
      const initialBalance = upgradeAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);

      // Token should still be at tier 4
      await checkTokenTier(user1, token1, 4);
      // Upgrade
      await taxTable.upgradeTokenTier(token1, {from: user1});
      // Token should now be at tier 3
      await checkTokenTier(user1, token1, 3);

      // Balance of the owner should have been depleted by the upgrade amount
      checkLRCBalance(user1, initialBalance - upgradeAmount,
                      "Balance of the burner should be depleted by burn amount");
      // New LRC total supply should be upgradeAmount less
      const newTotalLRCSupply = await LRC.totalSupply();
      assertNumberEqualsWithPrecision(
        newTotalLRCSupply, totalLRCSupply - upgradeAmount,
        "LRC total supply should have beed reduces by the amount burned",
      );

      // The tier of the token should still be the same after ~1 year
      await advanceBlockTimestamp(366 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 3);
      // The tier of the token should have reverted back to tier 4 after 2 years
      await advanceBlockTimestamp(366 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 4);
    });

    it("should not be able to upgrade the tier of a token by not burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Not enought funds
      const initialBalance = upgradeAmount / 2;
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade
      await expectThrow(taxTable.upgradeTokenTier(token1, {from: user1}));
    });

    it("should not be able to upgrade the tier of LRC or WETH by burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have a bit more balance
      const initialBalance = upgradeAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade LRC
      await expectThrow(taxTable.upgradeTokenTier(tokenLRC, {from: user1}));
      // Try to upgrade WETH
      await expectThrow(taxTable.upgradeTokenTier(tokenWETH, {from: user1}));
    });

    it("should not be able to upgrade the tier of a token above tier 1", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have more than enough balance to upgrade multiple times
      const initialBalance = upgradeAmount * 10;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Tier 4 -> Tier 3
      taxTable.upgradeTokenTier(token1, {from: user1});
      // Tier 3 -> Tier 2
      taxTable.upgradeTokenTier(token1, {from: user1});
      // Tier 2 -> Tier 1
      taxTable.upgradeTokenTier(token1, {from: user1});
      // Tier 1 should be the limit
      await expectThrow(taxTable.upgradeTokenTier(token1, {from: user1}));
    });
  });

  describe("LRC locking", () => {
    it("user should be able to lower the burn rate by locking LRC", async () => {
      // The maximum amount we can lock
      const maxLockAmount = await getMaxLockAmount();
      // Have the user have a bit more balance
      const initialBalance = maxLockAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);

      // Rebate rate should still be at 0%
      const taxBasePercentage = (await taxTable.TAX_BASE_PERCENTAGE()).toNumber();
      await checkRebateRate(user1, 0 * taxBasePercentage);
      // Lock the max amount
      await taxTable.lock(maxLockAmount, {from: user1});

      // Balance of the owner should have been depleted by the locked amount
      checkLRCBalance(user1, initialBalance - maxLockAmount,
                      "Balance of the user should be depleted by the locked amount");
      // Rebate rate needs to be set at 100%
      await checkRebateRate(user1, 1 * taxBasePercentage);
      // Rebate rate of another user should still be 0%
      await checkRebateRate(user2, 0 * taxBasePercentage);

      // Rebate rate should stay the same until the locking period is over and the user doesn't withdraw any tokens
      // Day 100
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * taxBasePercentage);
      // Day 200
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * taxBasePercentage);
      // Day 300
      await advanceBlockTimestamp(100 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 1 * taxBasePercentage);
      // Locking period of 1 year over, back to no rebate
      // Day 370
      await advanceBlockTimestamp(70 * DAY_TO_SECONDS);
      await checkRebateRate(user1, 0 * taxBasePercentage);

      // Witdraw all locked tokens
      const withdrawableAmount = (await taxTable.getWithdrawableBalance(user1)).toNumber();
      assert.equal(withdrawableAmount, maxLockAmount, "Withdrawable amount should match initialy locked amount");
      await taxTable.withdraw(withdrawableAmount, {from: user1});
      // Balance of the user should be back to the initial amount
      checkLRCBalance(user1, initialBalance,
                      "Balance of the user should be back to the initial balance after a complete withdraw");
    });

    it("user should be able to withdraw tokens after they unlock", async () => {
      // The maximum amount we can lock
      const maxLockAmount = await getMaxLockAmount();
      // Have the user have a bit more balance
      const initialBalance = maxLockAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Lock the max amount
      await taxTable.lock(maxLockAmount, {from: user1});

      // Witdrawable amount should be 0 until LINEAR_UNLOCK_START_TIME seconds have passed
      await checkWithdrawableAmount(user1, 0);

      // Should not be able to withdraw any tokens
      await expectThrow(taxTable.withdraw(1, {from: user1}));

      // Advance to just before LINEAR_UNLOCK_START_TIME
      await advanceBlockTimestamp(LINEAR_UNLOCK_START_TIME - 1 * DAY_TO_SECONDS);
      await checkWithdrawableAmount(user1, 0);

      // Advance to just after LINEAR_UNLOCK_START_TIME
      await advanceBlockTimestamp(2 * DAY_TO_SECONDS);
      const withdrawableAmount = (await taxTable.getWithdrawableBalance(user1)).toNumber();
      assert(withdrawableAmount > 0, "Withdrawable amount should be non-zero");

      // ...
    });

    it("user should not be able to withdraw 0 tokens", async () => {
      // Should not be able to withdraw 0 tokens
      await expectThrow(taxTable.withdraw(0, {from: user1}));
    });

  });

});
