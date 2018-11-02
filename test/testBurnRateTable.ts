import BN = require("bn.js");
import { expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";

const {
  BurnRateTable,
  TradeDelegate,
  DummyToken,
  LRCToken,
  WETHToken,
} = new Artifacts(artifacts);

contract("BurnRateTable", (accounts: string[]) => {
  const deployer = accounts[0];
  const mockedExchangeAddress = accounts[1];
  const user1 = accounts[2];
  const user2 = accounts[3];
  const user3 = accounts[4];
  const user4 = accounts[5];

  let burnRateTable: any;
  let tokenLRC: string;
  let tokenWETH: string;
  const token1 = "0x" + "1".repeat(40);
  const token2 = "0x" + "2".repeat(40);
  const token3 = "0x" + "3".repeat(40);
  const token4 = "0x" + "4".repeat(40);

  const DAY_TO_SECONDS = 3600 * 24;

  let BURN_BASE_PERCENTAGE: number;

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
      const matching = (await burnRateTable.BURN_MATCHING_TIER1()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER1()).toNumber();
      return [matching, P2P];
    } else if (tier === 2) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER2()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER2()).toNumber();
      return [matching, P2P];
    } else if (tier === 3) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER3()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER3()).toNumber();
      return [matching, P2P];
    } else if (tier === 4) {
      const matching = (await burnRateTable.BURN_MATCHING_TIER4()).toNumber();
      const P2P = (await burnRateTable.BURN_P2P_TIER4()).toNumber();
      return [matching, P2P];
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenTierValue = async (tier: number) => {
    if (tier === 1) {
      return (await burnRateTable.TIER_1()).toNumber();
    } else if (tier === 2) {
      return (await burnRateTable.TIER_2()).toNumber();
    } else if (tier === 3) {
      return (await burnRateTable.TIER_3()).toNumber();
    } else if (tier === 4) {
      return (await burnRateTable.TIER_4()).toNumber();
    } else {
      assert(false, "Invalid tier");
    }
  };

  const getTokenRate = async (user: string, token: string) => {
    const burnRateToken = (await burnRateTable.getBurnRate(token)).toNumber();
    return [(burnRateToken & 0xFFFF), (burnRateToken >> 16)];
  };

  const getTokenTierUpgradeAmount = async () => {
    const LRC = await DummyToken.at(tokenLRC);
    const totalLRCSupply = await LRC.totalSupply();
    const upgradeCostPercentage = (await burnRateTable.TIER_UPGRADE_COST_PERCENTAGE()).toNumber();
    const upgradeAmount = Math.floor(totalLRCSupply * upgradeCostPercentage / BURN_BASE_PERCENTAGE);
    return upgradeAmount;
  };

  const getLRCBalance = async (user: string) => {
    const LRC = await DummyToken.at(tokenLRC);
    const balance = (await LRC.balanceOf(user)).toNumber();
    return balance;
  };

  const addLRCBalance = async (user: string, amount: number) => {
    const LRC = await DummyToken.at(tokenLRC);
    await LRC.transfer(user, amount, {from: deployer});
    await LRC.approve(burnRateTable.address, amount, {from: user});
  };

  const checkTokenTier = async (user: string, token: string, expectedTier: number) => {
    const [matchingToken, P2PToken] = await getTokenRate(user, token);
    const [matchingTier, P2PTier] = await getTierRate(expectedTier);
    const tierValue = (await burnRateTable.getTokenTier(token)).toNumber();
    const expectedTierValue = await getTokenTierValue(expectedTier);
    assert.equal(tierValue, expectedTierValue, "Token tier needs to match expected tier");
    assert.equal(matchingToken, matchingTier, "matching rate needs to match tier " + expectedTier + " rate");
    assert.equal(P2PToken, P2PTier, "P2P rate needs to match tier " + expectedTier + " rate");
  };

  const checkLRCBalance = async (user: string, expectedBalance: number, description?: string) => {
    const balance = await getLRCBalance(user);
    assertNumberEqualsWithPrecision(balance, expectedBalance,
                                    description ? description : "Balance of the user should match expected balance");
  };

  before(async () => {
    tokenLRC = LRCToken.address;
    tokenWETH = WETHToken.address;
  });

  beforeEach(async () => {
    // Fresh BurnRateTable and LRC token for each test
    const LRC = await DummyToken.new("Loopring", "LRC", 18, 1e+26);
    tokenLRC = LRC.address;
    burnRateTable = await BurnRateTable.new(tokenLRC, tokenWETH);

    BURN_BASE_PERCENTAGE = (await burnRateTable.BURN_BASE_PERCENTAGE()).toNumber();
  });

  describe("Token tiers", () => {
    it("LRC should be tier 1", async () => {
      await checkTokenTier(user1, tokenLRC, 1);
    });

    it("WETH should be tier 3", async () => {
      await checkTokenTier(user1, tokenWETH, 3);
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
      await burnRateTable.upgradeTokenTier(token1, {from: user1});
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

      // The tier of the token should still be the same within 1 year
      await advanceBlockTimestamp(364 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 3);
      // The tier of the token should have reverted back to tier 4 after 1 years
      await advanceBlockTimestamp(2 * DAY_TO_SECONDS);
      await checkTokenTier(user1, token1, 4);
    });

    it("should not be able to upgrade the tier of a token by not burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Not enought funds
      const initialBalance = upgradeAmount / 2;
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade
      await expectThrow(burnRateTable.upgradeTokenTier(token1, {from: user1}), "INVALID_VALUE");
    });

    it("should not be able to upgrade the tier of LRC or WETH by burning enough tokens", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have a bit more balance
      const initialBalance = upgradeAmount + 1e20;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Try to upgrade LRC
      await expectThrow(burnRateTable.upgradeTokenTier(tokenLRC, {from: user1}), "BURN_RATE_FROZEN");
      // Try to upgrade WETH
      await expectThrow(burnRateTable.upgradeTokenTier(tokenWETH, {from: user1}), "BURN_RATE_FROZEN");
    });

    it("should not be able to upgrade the tier of a token above tier 1", async () => {
      // Total amount needed to upgrate one tier
      const upgradeAmount = await getTokenTierUpgradeAmount();
      // Have the user have more than enough balance to upgrade multiple times
      const initialBalance = upgradeAmount * 10;
      // Make sure the user has enough LRC
      await addLRCBalance(user1, initialBalance);
      // Tier 4 -> Tier 3
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 3 -> Tier 2
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 2 -> Tier 1
      burnRateTable.upgradeTokenTier(token1, {from: user1});
      // Tier 1 should be the limit
      await expectThrow(burnRateTable.upgradeTokenTier(token1, {from: user1}), "BURN_RATE_MINIMIZED");
    });
  });

});
