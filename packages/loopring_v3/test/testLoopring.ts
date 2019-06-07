import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Loopring", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let loopring: any;

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    loopring = exchangeTestUtil.loopringV3;
  });

  const withdrawTheBurnChecked = async (token: string, recipient: string, expectedAmount: BN) => {
    const tokenAddress = exchangeTestUtil.getTokenAddress(token);

    const balanceRecipientBefore = await exchangeTestUtil.getOnchainBalance(recipient, tokenAddress);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(loopring.address, tokenAddress);

    await loopring.withdrawTheBurn(tokenAddress, recipient,
                                   {from: exchangeTestUtil.testContext.deployer, gasPrice: 0});

    const balanceRecipientAfter = await exchangeTestUtil.getOnchainBalance(recipient, tokenAddress);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(loopring.address, tokenAddress);

    assert(balanceRecipientAfter.eq(balanceRecipientBefore.add(expectedAmount)),
           "Token balance of recipient should be increased by amount");
    assert(balanceContractAfter.eq(balanceContractBefore.sub(expectedAmount)),
           "Token balance of contract should be decreased by amount");
  };

  const calculateProtocolFee = (minFee: BN, maxFee: BN, stake: BN, targetStake: BN) => {
    const maxReduction = maxFee.sub(minFee);
    let reduction = maxReduction.mul(stake).div(targetStake);
    if (reduction.gt(maxReduction)) {
        reduction = maxReduction;
    }
    return maxFee.sub(reduction);
  };

  const checkProtocolFees = async () => {
    const minProtocolTakerFeeBips = await loopring.minProtocolTakerFeeBips();
    const maxProtocolTakerFeeBips = await loopring.maxProtocolTakerFeeBips();
    const minProtocolMakerFeeBips = await loopring.minProtocolMakerFeeBips();
    const maxProtocolMakerFeeBips = await loopring.maxProtocolMakerFeeBips();
    const targetProtocolTakerFeeStake = await loopring.targetProtocolTakerFeeStake();
    const targetProtocolMakerFeeStake = await loopring.targetProtocolMakerFeeStake();

    const stake = (await loopring.getProtocolFeeStake(exchangeTestUtil.exchangeId)).div(new BN(2));

    const expectedTakerFee = calculateProtocolFee(
      minProtocolTakerFeeBips, maxProtocolTakerFeeBips, stake, targetProtocolTakerFeeStake,
    );
    const expectedMakerFee = calculateProtocolFee(
      minProtocolMakerFeeBips, maxProtocolMakerFeeBips, stake, targetProtocolMakerFeeStake,
    );

    const protocolFees = await loopring.getProtocolFeeValues(
      exchangeTestUtil.exchangeId,
      exchangeTestUtil.onchainDataAvailability,
    );
    assert(protocolFees.takerFeeBips.eq(expectedTakerFee), "Wrong protocol taker fees");
    assert(protocolFees.makerFeeBips.eq(expectedMakerFee), "Wrong protocol maker fees");
  };

  describe("Staking", function() {
    this.timeout(0);

    describe("Owner", () => {
      it("should be able to withdraw the protocol fee stake", async () => {
        // Deposit some LRC to stake for the exchange
        const depositer = exchangeTestUtil.testContext.operators[2];
        const stakeAmount = new BN(web3.utils.toWei("1234567", "ether"));
        await exchangeTestUtil.setBalanceAndApprove(depositer, "LRC", stakeAmount, loopring.address);

        // Stake it
        await exchangeTestUtil.depositProtocolFeeStakeChecked(stakeAmount, depositer);

        // Try to withdraw it from an unauthorized address on the exchange contract
        await expectThrow(
          exchangeTestUtil.exchange.withdrawProtocolFeeStake(
            exchangeTestUtil.exchangeOwner, stakeAmount, {from: exchangeTestUtil.exchangeOperator},
          ),
          "UNAUTHORIZED",
        );

        // Try to withdraw it from an unauthorized address on the loopring contract
        await expectThrow(
          loopring.withdrawProtocolFeeStake(
            exchangeTestUtil.exchangeId, exchangeTestUtil.exchangeOwner, stakeAmount,
            {from: exchangeTestUtil.exchangeOwner},
          ),
          "UNAUTHORIZED",
        );

        // Withdraw the exchange stake
        await exchangeTestUtil.withdrawProtocolFeeStakeChecked(
          exchangeTestUtil.exchangeOwner, stakeAmount,
        );
      });
    });

    describe("Anyone", () => {
      it("should be able to lower the protocol fees", async () => {
        const minProtocolTakerFeeBips = await loopring.minProtocolTakerFeeBips();
        const maxProtocolTakerFeeBips = await loopring.maxProtocolTakerFeeBips();
        const minProtocolMakerFeeBips = await loopring.minProtocolMakerFeeBips();
        const maxProtocolMakerFeeBips = await loopring.maxProtocolMakerFeeBips();
        const targetProtocolTakerFeeStake = await loopring.targetProtocolTakerFeeStake();
        const targetProtocolMakerFeeStake = await loopring.targetProtocolMakerFeeStake();

        // Deposit some LRC to stake for the exchange
        const depositer = exchangeTestUtil.testContext.operators[2];
        const totalLRC = targetProtocolTakerFeeStake.mul(new BN(4));
        await exchangeTestUtil.setBalanceAndApprove(depositer, "LRC", totalLRC, loopring.address);

        {
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.onchainDataAvailability,
          );
          assert(protocolFees.takerFeeBips.eq(maxProtocolTakerFeeBips), "Wrong protocol taker fees");
          assert(protocolFees.makerFeeBips.eq(maxProtocolMakerFeeBips), "Wrong protocol maker fees");
        }

        await exchangeTestUtil.depositProtocolFeeStakeChecked(targetProtocolMakerFeeStake, depositer);
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(targetProtocolMakerFeeStake, depositer);
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(targetProtocolTakerFeeStake, depositer);
        await checkProtocolFees();
        await exchangeTestUtil.depositProtocolFeeStakeChecked(targetProtocolTakerFeeStake, depositer);

        {
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.onchainDataAvailability,
          );
          assert(protocolFees.takerFeeBips.eq(minProtocolTakerFeeBips), "Wrong protocol taker fees");
          assert(protocolFees.makerFeeBips.eq(minProtocolMakerFeeBips), "Wrong protocol maker fees");
        }
      });
    });
  });

  describe("Owner", () => {
    it("should be able to withdraw 'The Burn'", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amountA = new BN(web3.utils.toWei("1.23", "ether"));
      const amountB = new BN(web3.utils.toWei("456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "WETH", amountB, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      // ETH
      await web3.eth.sendTransaction({from: user, to: loopring.address, value: amountA});
      // WETH
      const WETH = await exchangeTestUtil.getTokenContract("WETH");
      await WETH.transfer(loopring.address, amountB, {from: user});

      // Withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // ETH
      await withdrawTheBurnChecked("ETH", recipient, amountA);
      // WETH
      await withdrawTheBurnChecked("WETH", recipient, amountB);
    });
  });

  describe("anyone", () => {
    it("should not be able to withdraw 'The Burn'", async () => {
      const user = exchangeTestUtil.testContext.orderOwners[0];
      const amountA = new BN(web3.utils.toWei("1.23", "ether"));
      const amountB = new BN(web3.utils.toWei("456", "ether"));
      await exchangeTestUtil.setBalanceAndApprove(user, "WETH", amountB, loopring.address);
      // Transfer some funds to the contract that we can withdraw
      // ETH
      await web3.eth.sendTransaction({from: user, to: loopring.address, value: amountA});
      // WETH
      const WETH = await exchangeTestUtil.getTokenContract("WETH");
      await WETH.transfer(loopring.address, amountB, {from: user});

      // Try to withdraw
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      // ETH
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("ETH"), recipient, {from: recipient}),
        "UNAUTHORIZED",
      );
      // WETH
      await expectThrow(
        loopring.withdrawTheBurn(exchangeTestUtil.getTokenAddress("WETH"), recipient, {from: recipient}),
        "UNAUTHORIZED",
      );
    });

    it("should not be able to burn the stake", async () => {
      await expectThrow(
        loopring.burnExchangeStake(exchangeTestUtil.exchangeId, new BN(0),
        {from: exchangeTestUtil.testContext.deployer}),
        "UNAUTHORIZED",
      );
    });

    it("should not be able to withdraw the stake", async () => {
      const recipient = exchangeTestUtil.testContext.orderOwners[1];
      await expectThrow(
        loopring.withdrawExchangeStake(exchangeTestUtil.exchangeId, recipient, new BN(0),
        {from: exchangeTestUtil.testContext.deployer}),
        "UNAUTHORIZED",
      );
    });
  });
});
