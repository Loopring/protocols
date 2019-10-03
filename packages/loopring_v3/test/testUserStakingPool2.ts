import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

contract("UserStakingPool2", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;
  const UserStakingPool = contracts.UserStakingPool;

  const ZERO = new BN(0);

  var mockLRC: any;
  var mockProtocolFeeVault: any;
  var userStakingPool: any;

  var MIN_WITHDRAW_DELAY: number;
  var MIN_CLAIM_DELAY: number;
  const owner = accounts[0];

  before(async () => {
    mockLRC = await MockContract.new();
    mockProtocolFeeVault = await MockContract.new();
    userStakingPool = await UserStakingPool.new(mockLRC.address, {
      from: owner
    });

    MIN_WITHDRAW_DELAY = (await userStakingPool.MIN_WITHDRAW_DELAY()).toNumber();
    MIN_CLAIM_DELAY = (await userStakingPool.MIN_CLAIM_DELAY()).toNumber();

    assert.equal(MIN_WITHDRAW_DELAY, MIN_CLAIM_DELAY, "test assumption failed");
  });

  describe("Two users claim one after another", () => {
    const alice = accounts[1];
    const bob = accounts[2];

    const amount = new BN(web3.utils.toWei("100", "ether"));
    var totalReward = new BN(web3.utils.toWei("500", "ether"));

    it("Alice and bob stake the same amount but cannot claim before waiting period", async () => {
      await userStakingPool.setProtocolFeeVault(mockProtocolFeeVault.address, {
        from: owner
      });

      await userStakingPool.stake(amount, { from: alice });
      await userStakingPool.stake(amount, { from: bob });

      await advanceTimeAndBlockAsync(MIN_CLAIM_DELAY - 1);

      // cannot claim yet
      await expectThrow(userStakingPool.claim({ from: alice }), "NEED_TO_WAIT");
    });
    // mocke ProtocolFeeVault to return 500 LRC as total reward
  });
});
