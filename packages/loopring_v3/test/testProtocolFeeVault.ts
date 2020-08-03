import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
import { Constants } from "loopringV3.js";
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

contract("ProtocolFeeVault", (accounts: string[]) => {
  let contracts: Artifacts;
  let MockContract: any;
  let ProtocolFeeVault: any;

  const ZERO = new BN(0);
  const amount = new BN(web3.utils.toWei("77", "ether"));
  const amount2 = new BN(web3.utils.toWei("100", "ether"));

  var mockLRC: any;
  var mockToken: any;
  var mockTokenSeller: any;
  var protocolFeeVault: any;

  var REWARD_PERCENTAGE: number;
  var DAO_PERDENTAGE: number;
  var claimReward: BN;

  const owner = accounts[0];
  const userStakingPoolAddress = accounts[1];
  const daoAddress = accounts[2];

  before(async () => {
    contracts = new Artifacts(artifacts);
    MockContract = contracts.MockContract;
    ProtocolFeeVault = contracts.ProtocolFeeVault;
  });

  describe("ProtocolFeeVault related test", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockToken = await MockContract.new();
      mockTokenSeller = await MockContract.new();
      protocolFeeVault = await ProtocolFeeVault.new(mockLRC.address, {
        from: owner
      });

      REWARD_PERCENTAGE = (await protocolFeeVault.REWARD_PERCENTAGE()).toNumber();
      DAO_PERDENTAGE = (await protocolFeeVault.DAO_PERDENTAGE()).toNumber();
      claimReward = amount
        .add(amount2)
        .mul(new BN(REWARD_PERCENTAGE))
        .div(new BN(100))
        .div(new BN(2));
    });

    describe("updateSettings", () => {
      it("update settings and can not update same addresses", async () => {
        await protocolFeeVault.updateSettings(
          userStakingPoolAddress,
          mockTokenSeller.address,
          daoAddress
        );

        await expectThrow(
          protocolFeeVault.updateSettings(
            userStakingPoolAddress,
            mockTokenSeller.address,
            daoAddress
          ),
          "SAME_ADDRESSES"
        );

        // change address to updateSettings
        await protocolFeeVault.updateSettings(
          userStakingPoolAddress,
          Constants.zeroAddress,
          Constants.zeroAddress
        );
      });
    });

    describe("fundDao and claimStakingReward and then check fee stats", () => {
      it("fundDao when there is no fee", async () => {
        const feeBalance = ZERO;
        // mock lrc to return 0 either
        const getBalanceOfFee = web3.utils
          .sha3("balanceOf(address)")
          .slice(0, 10);
        await mockLRC.givenMethodReturn(
          getBalanceOfFee,
          abi.rawEncode(["uint"], [feeBalance])
        );

        const tx = await protocolFeeVault.fundDAO();
        truffleAssert.eventEmitted(tx, "DAOFunded", (evt: any) => {
          return evt.amountDAO == 0 && evt.amountBurn == 0;
        });
      });

      it("fundDao when fee set", async () => {
        const feeBalance = amount;
        // mock lrc to return feeBalance
        const getBalanceOfFee = web3.utils
          .sha3("balanceOf(address)")
          .slice(0, 10);
        await mockLRC.givenMethodReturn(
          getBalanceOfFee,
          abi.rawEncode(["uint"], [feeBalance])
        );

        // mock lrc burn return true
        const lrcBurn = web3.utils.sha3("burn(uint256)").slice(0, 10);
        await mockLRC.givenMethodReturnBool(lrcBurn, true);

        const tx = await protocolFeeVault.fundDAO();
        truffleAssert.eventEmitted(tx, "DAOFunded", (evt: any) => {
          return (
            evt.amountDAO.eq(
              feeBalance.mul(new BN(DAO_PERDENTAGE)).div(new BN(100))
            ) &&
            evt.amountBurn.eq(
              feeBalance
                .mul(new BN(100 - REWARD_PERCENTAGE - DAO_PERDENTAGE))
                .div(new BN(100))
            )
          );
        });
      });

      it("fundDao when fee add another amount", async () => {
        const feeBalance = amount
          .mul(new BN(REWARD_PERCENTAGE))
          .div(new BN(100))
          .add(amount2);
        // mock lrc to return feeBalance
        const getBalanceOfFee = web3.utils
          .sha3("balanceOf(address)")
          .slice(0, 10);
        await mockLRC.givenMethodReturn(
          getBalanceOfFee,
          abi.rawEncode(["uint"], [feeBalance])
        );

        const tx = await protocolFeeVault.fundDAO();
        truffleAssert.eventEmitted(tx, "DAOFunded", (evt: any) => {
          return (
            evt.amountDAO.eq(
              amount2.mul(new BN(DAO_PERDENTAGE)).div(new BN(100))
            ) &&
            evt.amountBurn.eq(
              amount2
                .mul(new BN(100 - REWARD_PERCENTAGE - DAO_PERDENTAGE))
                .div(new BN(100))
            )
          );
        });
      });

      it("claimStakingReward", async () => {
        await expectThrow(protocolFeeVault.claimStakingReward(0), "ZERO_VALUE");
        await expectThrow(
          protocolFeeVault.claimStakingReward(amount),
          "UNAUTHORIZED"
        );
        await protocolFeeVault.claimStakingReward(claimReward, {
          from: userStakingPoolAddress
        });
      });

      it("getProtocolFeeStats check stats", async () => {
        const feeBalance = amount
          .add(amount2)
          .mul(new BN(REWARD_PERCENTAGE))
          .div(new BN(100))
          .sub(claimReward);
        // mock lrc to return feeBalance
        const getBalanceOfFee = web3.utils
          .sha3("balanceOf(address)")
          .slice(0, 10);
        await mockLRC.givenMethodReturn(
          getBalanceOfFee,
          abi.rawEncode(["uint"], [feeBalance])
        );
        const {
          0: accumulatedFees,
          1: accumulatedBurn,
          2: accumulatedDAOFund,
          3: accumulatedReward,
          4: remainingFees,
          5: remainingBurn,
          6: remainingDAOFund,
          7: remainingReward
        } = await protocolFeeVault.getProtocolFeeStats();

        assert(
          accumulatedFees.eq(amount.add(amount2)) &&
            accumulatedBurn.eq(
              amount
                .add(amount2)
                .mul(new BN(100 - REWARD_PERCENTAGE - DAO_PERDENTAGE))
                .div(new BN(100))
            ) &&
            accumulatedDAOFund.eq(
              amount
                .add(amount2)
                .mul(new BN(DAO_PERDENTAGE))
                .div(new BN(100))
            ) &&
            accumulatedReward.eq(
              amount
                .add(amount2)
                .mul(new BN(REWARD_PERCENTAGE))
                .div(new BN(100))
            ) &&
            remainingFees.eq(feeBalance) &&
            remainingBurn == 0 &&
            remainingDAOFund == 0 &&
            remainingReward.eq(feeBalance),
          "protocol fee stats error"
        );
      });
    });

    describe("sellTokenForLRC", () => {
      it("sellTokenForLRC basic check", async () => {
        await expectThrow(
          protocolFeeVault.sellTokenForLRC(daoAddress, 0),
          "ZERO_AMOUNT"
        );

        await expectThrow(
          protocolFeeVault.sellTokenForLRC(mockLRC.address, amount),
          "PROHIBITED"
        );
      });

      it("sellTokenForLRC when tokenSellerAddress not set", async () => {
        await protocolFeeVault.sellTokenForLRC(mockToken.address, amount);

        await expectThrow(
          protocolFeeVault.sellTokenForLRC(Constants.zeroAddress, amount),
          "TRANSFER_FAILURE"
        );
      });

      it("sellTokenForLRC when tokenSellerAddress set", async () => {
        // upadte tokenSellAddress
        await protocolFeeVault.updateSettings(
          userStakingPoolAddress,
          mockTokenSeller.address,
          Constants.zeroAddress
        );

        // mock tokenSeller sellToken return true
        const sellToken = web3.utils
          .sha3("sellToken(address,address)")
          .slice(0, 10);
        await mockTokenSeller.givenMethodReturnBool(sellToken, true);

        await protocolFeeVault.sellTokenForLRC(mockToken.address, amount);
      });
    });
  });
});
