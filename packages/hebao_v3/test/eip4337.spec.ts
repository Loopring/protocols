import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { localUserOpSender, fillAndSign } from "./helper/AASigner";
import { parseEther, arrayify, hexConcat, hexlify } from "ethers/lib/utils";
import { deployLibs } from "./commons";
import {
  calculateWalletAddress,
  activateWalletOp,
  simulationResultCatch,
  createTransaction,
  evInfo,
  getBatchCallData,
  createAccount,
  createAccountOwner,
  createRandomWalletConfig,
  getPaymasterAndData,
  getCallData,
  activateCreate2WalletOp,
  create2Deploy,
} from "./helper/utils";
import { TestCounter, TestCounter__factory } from "../typechain-types";

describe("eip4337", () => {
  // const loadFixture = waffle.createFixtureLoader()

  async function fixture() {
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    const blankOwner = signers[1];
    const paymasterOwner = signers[2];

    const libraries = await deployLibs();

    const create2Factory = await (
      await ethers.getContractFactory("Create2Factory")
    ).deploy();

    const entrypoint = await (
      await ethers.getContractFactory("EntryPoint")
    ).deploy();
    const priceOracle = await (
      await ethers.getContractFactory("ChainlinkPriceOracle")
    ).deploy(entrypoint.address);

    // proxy implementation
    const smartWalletImpl = await (
      await ethers.getContractFactory("SmartWallet", { libraries })
    ).deploy(priceOracle.address, entrypoint.address, blankOwner.address);

    const implementationManager = await create2Deploy(
      create2Factory,
      "DelayedImplementationManager",
      [smartWalletImpl.address, deployer.address]
    );

    const forwardProxy = await create2Deploy(create2Factory, "ForwardProxy", [
      implementationManager.address,
    ]);

    const walletFactory = await (
      await ethers.getContractFactory("WalletFactory", { libraries })
    ).deploy(priceOracle.address, entrypoint.address, blankOwner.address);
    const paymaster = await (
      await ethers.getContractFactory("VerifyingPaymaster")
    ).deploy(entrypoint.address, paymasterOwner.address);

    await paymaster.addStake(1, { value: parseEther("2") });
    await entrypoint.depositTo(paymaster.address, { value: parseEther("1") });

    const accountOwner = await createAccountOwner();
    const walletConfig = await createRandomWalletConfig(accountOwner.address);

    const { proxy: account } = await createAccount(
      accountOwner,
      walletConfig,
      entrypoint.address,
      walletFactory
    );

    const usdcToken = await (await ethers.getContractFactory("USDT")).deploy();

    const testCounter = await (
      await ethers.getContractFactory("TestCounter")
    ).deploy();
    return {
      entrypoint,
      paymaster,
      paymasterOwner,
      accountOwner,
      usdcToken,
      deployer,
      account,
      testCounter,
      walletFactory,
      create2Factory,
      forwardProxy,
    };
  }

  async function activateCreate2Wallet_withETH() {
    const { forwardProxy, entrypoint, deployer, testCounter, create2Factory } =
      await loadFixture(fixture);

    const accountOwner = await createAccountOwner();
    const walletConfig = await createRandomWalletConfig(accountOwner.address);

    const sendUserOp = localUserOpSender(entrypoint.address, deployer);
    const accountImplementation = forwardProxy.address;
    const activateOp = await activateCreate2WalletOp(
      accountImplementation,
      create2Factory,
      walletConfig
    );

    const newOp = await fillAndSign(
      activateOp,
      accountOwner,
      create2Factory.address,
      entrypoint
    );

    // prefund
    const myAddress = activateOp.sender;
    await deployer.sendTransaction({
      to: myAddress,
      value: parseEther("0.01"),
    });

    await entrypoint.depositTo(myAddress, { value: parseEther("0.01") });
    const preDeposit = await entrypoint.balanceOf(myAddress);
    const prebalance = await ethers.provider.getBalance(myAddress);

    // create wallet before
    expect(await ethers.provider.getCode(myAddress)).to.eq("0x");
    // await entrypoint.callStatic.simulateValidation(newOp).catch(simulationResultCatch);
    const rcpt = await sendUserOp(newOp);
    expect((await ethers.provider.getCode(myAddress)).length).to.gt(2);

    const depositPaid = preDeposit.sub(await entrypoint.balanceOf(myAddress));
    const gasPaid = prebalance.sub(await ethers.provider.getBalance(myAddress));
    // console.log(
    // "paid (from balance)=",
    // gasPaid.toNumber() / 1e9,
    // "paid (from deposit)",
    // depositPaid.div(1e9).toString(),
    // "gasUsed=",
    // rcpt.gasUsed
    // );

    // AA10 sender already constructed
    await expect(entrypoint.estimateGas.handleOps([newOp], deployer.address)).to
      .reverted;
  }

  async function activateWallet_withETH() {
    const { walletFactory, entrypoint, deployer, testCounter } =
      await loadFixture(fixture);

    const accountOwner = await createAccountOwner();
    const walletConfig = await createRandomWalletConfig(accountOwner.address);

    const sendUserOp = localUserOpSender(entrypoint.address, deployer);
    const activateOp = await activateWalletOp(walletFactory, walletConfig);

    const justemit = await testCounter.populateTransaction.count();

    activateOp.callData = getCallData(justemit);

    const newOp = await fillAndSign(
      activateOp,
      accountOwner,
      walletFactory.address,
      entrypoint
    );

    // prefund
    const myAddress = activateOp.sender;
    await deployer.sendTransaction({
      to: myAddress,
      value: parseEther("0.01"),
    });

    await entrypoint.depositTo(myAddress, { value: parseEther("0.01") });
    const preDeposit = await entrypoint.balanceOf(myAddress);
    const prebalance = await ethers.provider.getBalance(myAddress);

    // await entrypoint.callStatic.simulateValidation(newOp).catch(simulationResultCatch);
    const rcpt = await sendUserOp(newOp);

    const depositPaid = preDeposit.sub(await entrypoint.balanceOf(myAddress));
    const gasPaid = prebalance.sub(await ethers.provider.getBalance(myAddress));
    // console.log(
    // "paid (from balance)=",
    // gasPaid.toNumber() / 1e9,
    // "paid (from deposit)",
    // depositPaid.div(1e9).toString(),
    // "gasUsed=",
    // rcpt.gasUsed
    // );
  }

  async function activateWallet_WithUSDCPaymaster() {
    const {
      walletFactory,
      entrypoint,
      deployer,
      paymaster,
      usdcToken,
      paymasterOwner,
    } = await loadFixture(fixture);

    const accountOwner = await createAccountOwner();
    const walletConfig = await createRandomWalletConfig(accountOwner.address);

    const sendUserOp = localUserOpSender(entrypoint.address, deployer);
    const activateOp = await activateWalletOp(walletFactory, walletConfig);

    // prepare tokens(1000 usdc)
    await usdcToken.transfer(
      activateOp.sender,
      ethers.utils.parseUnits("1000", 6)
    );
    const approvalAmount = ethers.utils.parseUnits("1000", 6);
    const approveToken = await usdcToken.populateTransaction.approve(
      paymaster.address,
      approvalAmount
    );

    activateOp.callData = getCallData(approveToken);

    const userOp1 = await fillAndSign(
      activateOp,
      accountOwner,
      walletFactory.address,
      entrypoint
    );

    ///////////////////////////// prepare paymaster and data ////////////////////////
    const valueOfEth = 625;
    const hash = await paymaster.getHash(
      userOp1,
      paymaster.address,
      usdcToken.address,
      valueOfEth
    );

    const paymasterAndData = await getPaymasterAndData(
      paymaster.address,
      paymasterOwner,
      hash,
      usdcToken.address,
      valueOfEth
    );
    const userOp2 = await fillAndSign(
      {
        ...userOp1,
        paymasterAndData,
      },
      accountOwner,
      walletFactory.address,
      entrypoint
    );

    ///////////////////////////// send tx ///////////////////////////////////
    const payer = paymaster.address;

    const preDeposit = await entrypoint.balanceOf(payer);
    const prebalance = await ethers.provider.getBalance(payer);
    const tokenBalanceBefore = await usdcToken.balanceOf(activateOp.sender);

    await entrypoint.callStatic
      .simulateValidation(userOp2)
      .catch(simulationResultCatch);
    const rcpt = await sendUserOp(userOp2);

    const depositPaid = preDeposit.sub(await entrypoint.balanceOf(payer));
    const gasPaid = prebalance.sub(await ethers.provider.getBalance(payer));
    const tokenBalanceAfter = await usdcToken.balanceOf(activateOp.sender);
    // console.log(
    // "paid (from balance)=",
    // gasPaid.toNumber() / 1e9,
    // "paid (from deposit)=",
    // depositPaid.div(1e9).toString(),
    // "gasUsed=",
    // rcpt.gasUsed
    // );

    const paidToken = tokenBalanceBefore.sub(tokenBalanceAfter);
    // console.log(
    // "usdc balance before=",
    // tokenBalanceBefore,
    // "usdc balance after=",
    // tokenBalanceAfter,
    // "usdc paid (from account)=",
    // tokenBalanceBefore.sub(tokenBalanceAfter)
    // );
    // console.log(
    // "usdc allowance of paymaster: ",
    // await usdcToken.allowance(activateOp.sender, paymaster.address)
    // );
    expect(
      await usdcToken.allowance(activateOp.sender, paymaster.address)
    ).to.eq(approvalAmount.sub(paidToken));
  }

  async function executeTxWithEth() {
    const {
      account,
      accountOwner,
      walletFactory,
      entrypoint,
      deployer,
      testCounter,
    } = await loadFixture(fixture);
    const sendUserOp = localUserOpSender(entrypoint.address, deployer);

    const walletAddress = account.address;

    // used to transfer eth for test
    const ethAmount = ethers.utils.parseEther("0.2");

    // prepare tokens
    // send tokens to wallet or deposit to entrypoint by wallet's name
    await entrypoint.depositTo(walletAddress, { value: parseEther("1") });
    // await deployer.sendTransaction({
    // to: walletAddress,
    // value: ethAmount,
    // });

    // some outside contract
    const justemit = await testCounter.populateTransaction.count();

    const quotaAmount = ethers.utils.parseEther("10");
    const changeDailyQuota = await account.populateTransaction.changeDailyQuota(
      quotaAmount
    );

    const actions = [justemit, changeDailyQuota];

    for (let i = 0; i < actions.length; ++i) {
      // use execute api
      const userOp0 = await createTransaction(
        actions[i],
        ethers.provider,
        account
      );
      const userOp = await fillAndSign(
        userOp0,
        accountOwner,
        walletFactory.address,
        entrypoint
      );

      await entrypoint.callStatic
        .simulateValidation(userOp)
        .catch(simulationResultCatch);

      const preDeposit = await entrypoint.balanceOf(walletAddress);
      const recipt = await sendUserOp(userOp);
      // console.log(await evInfo(entrypoint, recipt));
      const depositPaid = preDeposit.sub(
        await entrypoint.balanceOf(walletAddress)
      );
      expect(depositPaid).to.gt(0);
      // console.log("wallet paid(ETH): ", depositPaid.div(1e9));
    }

    // check effect of changeDailyQuota
    const quotaInfo = (await account.wallet())["quota"];
    expect(quotaInfo.pendingQuota.toString()).to.equal(quotaAmount);
  }

  async function executeTxWithPaymaster() {
    const {
      account,
      accountOwner,
      walletFactory,
      entrypoint,
      deployer,
      usdcToken,
      paymaster,
      paymasterOwner,
      testCounter,
    } = await loadFixture(fixture);
    const sendUserOp = localUserOpSender(entrypoint.address, deployer);

    const walletAddress = account.address;

    const tokenAmount = ethers.utils.parseUnits("100", 6);
    // used to transfer eth for test
    const ethAmount = ethers.utils.parseEther("0.2");

    // prepare tokens
    await usdcToken.transfer(walletAddress, ethers.utils.parseUnits("1000", 6));
    await deployer.sendTransaction({
      to: walletAddress,
      value: ethAmount,
    });
    const approveToken = await usdcToken.populateTransaction.approve(
      paymaster.address,
      ethers.utils.parseUnits("1000", 6)
    );

    const transferToken = await usdcToken.populateTransaction.transfer(
      accountOwner.address,
      tokenAmount
    );

    const transferEth = {
      value: ethAmount,
      to: accountOwner.address,
    };

    // some outside contract
    const justemit = await testCounter.populateTransaction.count();

    const actions = [approveToken, transferToken, transferEth, justemit];

    for (let i = 0; i < actions.length; ++i) {
      const userOp0 = await createTransaction(
        actions[i],
        ethers.provider,
        account
      );
      const userOp1 = await fillAndSign(
        userOp0,
        accountOwner,
        walletFactory.address,
        entrypoint
      );

      // 1 usdc = 6.25e-4 eth
      const valueOfEth = 625;
      const hash = await paymaster.getHash(
        userOp1,
        paymaster.address,
        usdcToken.address,
        valueOfEth
      );

      const paymasterAndData = await getPaymasterAndData(
        paymaster.address,
        paymasterOwner,
        hash,
        usdcToken.address,
        valueOfEth
      );

      const userOp = await fillAndSign(
        {
          ...userOp1,
          paymasterAndData,
        },
        accountOwner,
        walletFactory.address,
        entrypoint
      );
      await entrypoint.callStatic
        .simulateValidation(userOp)
        .catch(simulationResultCatch);

      const preDeposit = await entrypoint.balanceOf(paymaster.address);
      const recipt = await sendUserOp(userOp);
      // console.log(await evInfo(entrypoint, recipt));
      // check effect
      const allowance = await usdcToken.allowance(
        walletAddress,
        paymaster.address
      );
      const depositPaid = preDeposit.sub(
        await entrypoint.balanceOf(paymaster.address)
      );
      // console.log("paymaster paid(ETH): ", depositPaid.div(1e9));
    }
    expect(await usdcToken.balanceOf(accountOwner.address)).to.eq(tokenAmount);
    expect(await ethers.provider.getBalance(accountOwner.address)).to.eq(
      ethAmount
    );
  }

  describe("wallet test", async function () {
    it("activate create2 wallet(ETH)", activateCreate2Wallet_withETH);
    it("activate wallet(ETH)", activateWallet_withETH);
    it("activate wallet(USDC)", activateWallet_WithUSDCPaymaster);
    it("execute tx with usdc paymaster", executeTxWithPaymaster);
    it("execute tx with eth", executeTxWithEth);
    // it("activate wallet(ETH)", activateWallet_withETHUsingWalletFactory);
    // it("update guardian", updateGuardian);
    // it("recovery wallet", recoveryWallet);
    // it("interface resolver", interfaceResolver);
    // it("other coverage test", coverageTest);
  });
});
