import { Artifacts } from "../util/Artifacts";
import { advanceTimeAndBlockAsync } from "../util/TimeTravel";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
import { Constants } from "loopringV3.js";
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

// Make sure the amount difference is no more than 0.001%;
const isAmountCloseEnough = (bn1: BN, bn2: BN) => {
  const result =
    bn1.lte(bn2) &&
    bn2
      .sub(bn1)
      .mul(new BN(100000))
      .div(bn2)
      .lte(new BN(1));
  if (!result) {
    console.error(bn1.toString(10) + " vs " + bn2.toString(10));
  }
  return result;
};

contract("ProtocolFeeVault", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;
  const ProtocolFeeVault = contracts.ProtocolFeeVault;

  const ZERO = new BN(0);
  const amount = new BN(web3.utils.toWei("100", "ether"));

  var mockLRC: any;
  var mockToken: any;
  var mockTokenSeller: any;
  var protocolFeeVault: any;

  var REWARD_PERCENTAGE: number;
  var DAO_PERDENTAGE: number;

  const owner = accounts[0];
  const userStakingPoolAddress = accounts[1];
  const daoAddress = accounts[2];

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

    describe("claimStakingReward", () => {
      // it("claimStakingReward need called by userStakingPoolAddress", async () => {
      //   await expectThrow(
      //     protocolFeeVault.claimStakingReward(0),
      //     "ZERO_VALUE"
      //   );
      //   await expectThrow(
      //     protocolFeeVault.claimStakingReward(amount),
      //     "UNAUTHORIZED"
      //   );
      //   await protocolFeeVault.claimStakingReward(amount, {from: userStakingPoolAddress})
      // });
    });

    describe("fundDao", () => {
      it("fundDao when thers is no fee", async () => {
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
          return (
            (evt.amountDAO == 0 && evt.amountBurn == 0) ||
            (isAmountCloseEnough(
              evt.amountDAO,
              feeBalance.mul(new BN(DAO_PERDENTAGE)).div(new BN(100))
            ) &&
              isAmountCloseEnough(
                evt.amountBurn,
                feeBalance
                  .mul(new BN(100 - REWARD_PERCENTAGE - DAO_PERDENTAGE))
                  .div(new BN(100))
              ))
          );
        });
      });

      it("fundDao when fee set", async () => {
        const feeBalance = amount;
        // mock lrc to return 100 either
        const getBalanceOfFee = web3.utils
          .sha3("balanceOf(address)")
          .slice(0, 10);

        await mockLRC.givenMethodReturn(
          getBalanceOfFee,
          abi.rawEncode(["uint"], [feeBalance])
        );

        // mock lrc burn return true
        const lrcBurn = web3.utils.sha3("burn(uint256)").slice(0, 10);

        await mockLRC.givenMethodReturnBool(
          lrcBurn,
          abi.rawEncode(["bool"], [true])
        );
        const tx = await protocolFeeVault.fundDAO();
        truffleAssert.eventEmitted(tx, "DAOFunded", (evt: any) => {
          return (
            (evt.amountDAO == 0 && evt.amountBurn == 0) ||
            (isAmountCloseEnough(
              evt.amountDAO,
              feeBalance.mul(new BN(DAO_PERDENTAGE)).div(new BN(100))
            ) &&
              isAmountCloseEnough(
                evt.amountBurn,
                feeBalance
                  .mul(new BN(100 - REWARD_PERCENTAGE - DAO_PERDENTAGE))
                  .div(new BN(100))
              ))
          );
        });
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
          .sha3("sellToken(address, address)")
          .slice(0, 10);

        await mockTokenSeller.givenMethodReturnBool(
          sellToken,
          abi.rawEncode(["bool"], [true])
        );
        await protocolFeeVault.sellTokenForLRC(mockToken.address, amount);
      });
    });

    describe("getProtocolFeeStats", () => {
      it("getProtocolFeeStats check result value", async () => {
        //         const getBalanceOfFee = web3.utils
        //           .sha3("balanceOf(address)")
        //           .slice(0, 10);

        //         await mockLRC.givenMethodReturn(
        //           getBalanceOfFee,
        //           abi.rawEncode(
        //             ["uint"],
        //             [ZERO]
        //           )
        //         );

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

        assert(isAmountCloseEnough(accumulatedFees, amount), "accumulatedFees");
      });
    });
  });
});
