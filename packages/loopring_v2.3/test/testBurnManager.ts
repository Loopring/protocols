import BN = require("bn.js");
import { expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";
import { FeePayments } from "./feePayments";

const {
  BurnManager,
  FeeHolder,
  TradeDelegate,
  DummyExchange,
  DummyToken,
  LRCToken,
  WETHToken,
} = new Artifacts(artifacts);

contract("BurnManager", (accounts: string[]) => {
  const deployer = accounts[0];
  const user1 = accounts[1];

  const zeroAddress = "0x" + "00".repeat(20);

  let tradeDelegate: any;
  let feeHolder: any;
  let dummyExchange: any;
  let burnManager: any;
  let tokenLRC: string;
  let tokenWETH: string;

  const authorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeDelegate.authorizeAddress(address, {from: transactionOrigin});
    await assertAuthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "exchange not authorized.");
  };

  const burnChecked = async (token: string, expectedAmount: BN) => {
    const dummyToken = await DummyToken.at(token);
    const LRC = await DummyToken.at(tokenLRC);

    const balanceFeeHolderBefore = await dummyToken.balanceOf(feeHolder.address);
    const burnBalanceBefore = await feeHolder.feeBalances(token, feeHolder.address);
    const burnedBalanceBefore = await dummyToken.balanceOf(zeroAddress);

    // Burn
    const success = await burnManager.burn(token, {from: user1});
    assert(success, "Burn needs to succeed");

    const balanceFeeHolderAfter = await dummyToken.balanceOf(feeHolder.address);
    const burnBalanceAfter = await feeHolder.feeBalances(token, feeHolder.address);
    const burnedBalanceAfter = await dummyToken.balanceOf(zeroAddress);
    assert(balanceFeeHolderAfter.eq(balanceFeeHolderBefore.sub(expectedAmount)),
           "Contract balance should be reduced.");
    assert(burnBalanceAfter.eq(burnBalanceBefore.sub(expectedAmount)),
           "Withdrawal amount not correctly updated.");
    if (token === tokenLRC) {
      assert(burnedBalanceAfter.eq(burnedBalanceBefore.add(expectedAmount)),
             "Total LRC supply should have been decreased by all LRC burned");
    }
  };

  before(async () => {
    tokenLRC = LRCToken.address;
    tokenWETH = WETHToken.address;

    tradeDelegate = await TradeDelegate.deployed();
  });

  beforeEach(async () => {
    // Fresh FeeHolder for each test
    feeHolder = await FeeHolder.new(tradeDelegate.address);
    burnManager = await BurnManager.new(feeHolder.address, tokenLRC);
    dummyExchange = await DummyExchange.new(tradeDelegate.address, zeroAddress, feeHolder.address, zeroAddress);
    await authorizeAddressChecked(dummyExchange.address, deployer);
    await authorizeAddressChecked(burnManager.address, deployer);
  });

  describe("any user", () => {
    it("should be able to burn LRC deposited as burned in the FeeHolder contract", async () => {
      const amount = web3.utils.toBN(1e18);

      // Deposit some LRC in the fee holder contract
      const LRC = await DummyToken.at(tokenLRC);
      await LRC.transfer(feeHolder.address, amount, {from: deployer});
      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, tokenLRC, amount);
      await dummyExchange.batchAddFeeBalances(feePayments.getData());

      // Burn all LRC
      await burnChecked(tokenLRC, amount);
    });

    it("should not be able to burn non-LRC tokens for now", async () => {
      const amount = web3.utils.toBN(1e18);

      // Deposit some LRC in the fee holder contract
      const WETH = await DummyToken.at(tokenWETH);
      await WETH.transfer(feeHolder.address, amount, {from: deployer});
      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, tokenWETH, amount);
      await dummyExchange.batchAddFeeBalances(feePayments.getData());

      // Try to burn WETH
      await expectThrow(burnManager.burn(tokenWETH, {from: user1}), "UNIMPLEMENTED");
    });
  });
});
