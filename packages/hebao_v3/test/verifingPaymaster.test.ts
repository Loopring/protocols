import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { fixture } from "./helper/fixture";
import { sendTx, PaymasterOption, evInfo } from "./helper/utils";

describe("verifingPaymaster test", () => {
  it("admin operation success", async () => {
    const { paymaster, paymasterOwner: owner } = await loadFixture(fixture);
    // expect owner to be admin
    expect(await paymaster.hasRole(paymaster.SIGNER(), owner.address)).to.be
      .true;
    // add other to be admin
    const other = await ethers.Wallet.createRandom();
    expect(await paymaster.hasRole(paymaster.SIGNER(), other.address)).to.be
      .false;
    await paymaster.grantRole(paymaster.SIGNER(), other.address);
    expect(await paymaster.hasRole(paymaster.SIGNER(), other.address)).to.be
      .true;
  });

  it("transfer usdtToken with paymaster", async () => {
    const {
      entrypoint,
      smartWallet,
      smartWalletOwner,
      usdtToken,
      deployer,
      sendUserOp,
      create2,
      paymaster,
      paymasterOwner,
    } = await loadFixture(fixture);
    // prepare mock usdt token first
    const initTokenAmount = ethers.utils.parseUnits("1000", 6);
    await usdtToken.setBalance(smartWallet.address, initTokenAmount);

    //////////////////////////////////////////
    // usdt token transfer test
    const tokenAmount = ethers.utils.parseUnits("100", 6);
    // approve paymaster before using usdt paymaster service
    const approveToken = await usdtToken.populateTransaction.approve(
      paymaster.address,
      ethers.constants.MaxUint256
    );
    const transferToken = await usdtToken.populateTransaction.transfer(
      deployer.address,
      tokenAmount
    );
    const valueOfEth = ethers.utils.parseUnits("625", 12);
    const paymasterOption: PaymasterOption = {
      paymaster,
      payToken: usdtToken,
      paymasterOwner,
      valueOfEth,
      validUntil: 0,
    };

    expect(await usdtToken.balanceOf(deployer.address)).to.eq(0);
    const recipt = await sendTx(
      [approveToken, transferToken],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      paymasterOption
    );

    expect(await usdtToken.balanceOf(deployer.address)).to.eq(tokenAmount);
    const afterBalance = await usdtToken.balanceOf(smartWallet.address);
    // fee is transfered to paymaster contract
    expect(await usdtToken.balanceOf(paymaster.address)).to.eq(
      initTokenAmount.sub(afterBalance).sub(tokenAmount)
    );

    // sendtx for free
    paymasterOption.valueOfEth = 0;

    await sendTx(
      [transferToken],
      smartWallet,
      smartWalletOwner,
      create2,
      entrypoint,
      sendUserOp,
      paymasterOption
    );
    // no fee for sending tx
    expect(await usdtToken.balanceOf(smartWallet.address)).to.eq(
      afterBalance.sub(tokenAmount)
    );
  });

  it("replay the same paymasterAndData should fail", async () => {});

  it("check valid util", async () => {});

  it("withdraw token from paymaster", async () => {
    const { usdtToken, deployer, paymaster, paymasterOwner } =
      await loadFixture(fixture);
    // prepare mock usdt token first
    const initTokenAmount = ethers.utils.parseUnits("1000", 6);
    await usdtToken.setBalance(paymaster.address, initTokenAmount);

    await expect(
      paymaster
        .connect(deployer.address)
        .withdrawToken(
          usdtToken.address,
          paymasterOwner.address,
          initTokenAmount
        )
    ).to.rejectedWith("Ownable: caller is not the owner");

    await paymaster.withdrawToken(
      usdtToken.address,
      paymasterOwner.address,
      initTokenAmount
    );
    expect(await usdtToken.balanceOf(paymasterOwner.address)).to.eq(
      initTokenAmount
    );
    expect(await usdtToken.balanceOf(paymaster.address)).to.eq(0);
  });

  it("deposit and withdraw eth for paymaster in entrypoint", async () => {
    const { usdtToken, deployer, paymaster, paymasterOwner, entrypoint } =
      await loadFixture(fixture);
    const amount = ethers.utils.parseEther("1");
    const depositAmountBefore = await paymaster.getDeposit();
    await paymaster.deposit({ value: amount });
    const depositAmountAfter = await paymaster.getDeposit();
    expect(depositAmountAfter.sub(depositAmountBefore)).to.eq(amount);

    // withdraw eth to deployer
    const withdrawer = deployer.address;
    const balanceBefore = await ethers.provider.getBalance(withdrawer);
    await paymaster.withdrawTo(withdrawer, depositAmountAfter);
    const balanceAfter = await ethers.provider.getBalance(withdrawer);
    expect(balanceAfter.sub(balanceBefore)).eq(depositAmountAfter);
  });

  it("stake and unstake eth for paymaster in entrypoint", async () => {
    const { usdtToken, deployer, paymaster, paymasterOwner, entrypoint } =
      await loadFixture(fixture);
    const amount = ethers.utils.parseEther("1");
    const unstakeDelaySec = 10;
    await paymaster.addStake(unstakeDelaySec, { value: amount });

    // withdraw eth to deployer
    await paymaster.unlockStake();
    // advance time after unlock
    await time.increase(unstakeDelaySec);
    const withdrawer = deployer.address;
    const balanceBefore = await ethers.provider.getBalance(withdrawer);
    await paymaster.withdrawStake(withdrawer);
    const balanceAfter = await ethers.provider.getBalance(withdrawer);
    expect(balanceAfter.sub(balanceBefore)).eq(amount);
  });
});
