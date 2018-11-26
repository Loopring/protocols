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

  const burnChecked = async (token: string, expectedAmount: number) => {
    const dummyToken = DummyToken.at(token);
    const LRC = DummyToken.at(tokenLRC);

    const balanceFeeHolderBefore = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const burnBalanceBefore = (await feeHolder.feeBalances(token, feeHolder.address)).toNumber();
    const totalLRCSupplyBefore = await LRC.totalSupply();

    // Burn
    const success = await burnManager.burn(token, {from: user1});
    assert(success, "Burn needs to succeed");

    const balanceFeeHolderAfter = (await dummyToken.balanceOf(feeHolder.address)).toNumber();
    const burnBalanceAfter = (await feeHolder.feeBalances(token, feeHolder.address)).toNumber();
    const totalLRCSupplyAfter = await LRC.totalSupply();
    assert.equal(balanceFeeHolderAfter, balanceFeeHolderBefore - expectedAmount, "Contract balance should be reduced.");
    assert.equal(burnBalanceAfter, burnBalanceBefore - expectedAmount, "Withdrawal amount not correctly updated.");
    if (token === tokenLRC) {
      assert.equal(totalLRCSupplyAfter, totalLRCSupplyBefore - expectedAmount,
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
    dummyExchange = await DummyExchange.new(tradeDelegate.address, "0x0", feeHolder.address, "0x0");
    await authorizeAddressChecked(dummyExchange.address, deployer);
    await authorizeAddressChecked(burnManager.address, deployer);
  });

  describe("any user", () => {
    it("should be able to burn LRC deposited as burned in the FeeHolder contract", async () => {
      const amount = 1e18;

      // Deposit some LRC in the fee holder contract
      const LRC = DummyToken.at(tokenLRC);
      await LRC.transfer(feeHolder.address, amount, {from: deployer});
      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, tokenLRC, amount);
      await dummyExchange.batchAddFeeBalances(feePayments.getData());

      // Burn all LRC
      await burnChecked(tokenLRC, amount);
    });

    it("should not be able to burn non-LRC tokens for now", async () => {
      const amount = 1e18;

      // Deposit some LRC in the fee holder contract
      const WETH = DummyToken.at(tokenWETH);
      await WETH.transfer(feeHolder.address, amount, {from: deployer});
      const feePayments = new FeePayments();
      feePayments.add(feeHolder.address, tokenWETH, amount);
      await dummyExchange.batchAddFeeBalances(feePayments.getData());

      // Try to burn WETH
      await expectThrow(burnManager.burn(tokenWETH, {from: user1}), "UNIMPLEMENTED");
    });
  });
});
