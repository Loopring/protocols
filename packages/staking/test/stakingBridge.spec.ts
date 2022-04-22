import { expect } from "chai";
import { ethers } from "hardhat";

describe("StakingBridge", function () {

  let stakingBridge: any;
  let thirdpartyContract: any;
  const callId = 1;

  beforeEach(async function(){
    const StakingBridge = await ethers.getContractFactory("StakingBridge");
    stakingBridge = await StakingBridge.deploy();
    await stakingBridge.deployed();

    const bridgeOwner = await stakingBridge.owner();
    const signer0 = (await ethers.getSigners())[0].address;
    expect(signer0).to.equal(bridgeOwner);

    const MockedThirdpartyContract =  await ethers.getContractFactory("MockedThirdpartyContract");
    thirdpartyContract = await MockedThirdpartyContract.deploy();
    await thirdpartyContract.deployed();
  });

  describe("Owner", function() {
    it("Should be able to add/remove a manager", async function () {
      const signer1 = (await ethers.getSigners())[1].address;
      const isManagerBefore = await stakingBridge.isManager(signer1);
      expect(isManagerBefore).to.be.false;

      await stakingBridge.addManager(signer1);
      const isManagerAfter = await stakingBridge.isManager(signer1);
      expect(isManagerAfter).to.be.true;

      await stakingBridge.removeManager(signer1);
      const isManagerThen = await stakingBridge.isManager(signer1);
      expect(isManagerThen).to.be.false;

    });

    it("Should be able to authorize/unauthorize a external call", async function () {
      const thirdpartyContractAddress = thirdpartyContract.address;
      const depositSelector = thirdpartyContract.interface.getSighash("deposit");

      const signer1 = (await ethers.getSigners())[1].address;

      await stakingBridge.authorizeCall(thirdpartyContractAddress, depositSelector);
      const authorized1 = await stakingBridge.authorized(thirdpartyContractAddress, depositSelector);
      expect(authorized1).to.be.true;

      await stakingBridge.unauthorizeCall(thirdpartyContractAddress, depositSelector);
      const authorized2 = await stakingBridge.authorized(thirdpartyContractAddress, depositSelector);
      expect(authorized2).to.be.false;
    });

    it("Should not be able to call authorized contract if owner is not a manager", async function () {
      const signer1 = (await ethers.getSigners())[1].address;

      const depositSelector = thirdpartyContract.interface.getSighash("deposit");
      await stakingBridge.authorizeCall(thirdpartyContract.address, depositSelector);

      const callValue1 = 123;
      const encodedCallData = thirdpartyContract.interface.encodeFunctionData("deposit", [callValue1]);
      try {
        await stakingBridge.connect((await ethers.getSigners())[0]).call(callId, thirdpartyContract.address, encodedCallData);
        expect.fail();
      } catch (err) {
        const errMsg = (err as Error).message;
        // console.log("errMsg:", errMsg);
        expect(errMsg.includes("reverted with reason string 'NOT_MANAGER'")).to.be.true;
      }

    });

    it("should be able to withdrawal all ETH/ERC20 tokens from stakingBridge contract", async function() {
      const signer0 = (await ethers.getSigners())[0];

      // send ETH to stakingBridge:
      const ethAmount = ethers.utils.parseEther("100");
      await signer0.sendTransaction({
        to: stakingBridge.address,
        value: ethAmount
      });

      const to = "0x" + "11".repeat(20);
      const tokenETH = ethers.constants.AddressZero;
      await stakingBridge.drain(to, tokenETH);
      const toEthBalance = await ethers.provider.getBalance(to);
      // console.log("toEthBalance:", toEthBalance.toString());
      expect(toEthBalance.toString()).to.equal(ethAmount);

      const fooToken = await (await ethers.getContractFactory("FooToken")).deploy();
      await fooToken.deployed();
      const tokenAmount = ethers.utils.parseEther("12345");
      await fooToken.setBalance(stakingBridge.address, tokenAmount);
      await stakingBridge.drain(to, fooToken.address);
      const fooTokenBalance = await fooToken.balanceOf(to);
      expect(fooTokenBalance.toString()).to.equal(tokenAmount);
    });

  });

  describe("Manager", function() {
    it("Shoule be able to call a third-party contract method only if it is authorized", async function() {
      const thirdpartyContractAddress = thirdpartyContract.address;
      const depositSelector = thirdpartyContract.interface.getSighash("deposit");

      const signer1 = (await ethers.getSigners())[1].address;

      await stakingBridge.authorizeCall(thirdpartyContractAddress, depositSelector);
      await stakingBridge.addManager(signer1);

      const callValue1 = 123;
      const encodedCallData = thirdpartyContract.interface.encodeFunctionData("deposit", [callValue1]);
      const callTx = await stakingBridge.connect((await ethers.getSigners())[1]).call(callId, thirdpartyContractAddress, encodedCallData);
      const valueOfContract = await thirdpartyContract.value();
      expect(callValue1).to.equal(valueOfContract);
      const receipt = await callTx.wait();
      const callSucceededEvent = receipt.events[0];
      expect(callSucceededEvent.args.callId.toNumber()).to.equal(callId);
      expect(callSucceededEvent.args.target).to.equal(thirdpartyContractAddress);
      expect(callSucceededEvent.args.method).to.equal(depositSelector);

      await stakingBridge.unauthorizeCall(thirdpartyContractAddress, depositSelector);
      try {
        await stakingBridge.connect((await ethers.getSigners())[1]).call(callId, thirdpartyContractAddress, encodedCallData);
      } catch (err) {
        const errMsg = (err as Error).message;
        expect(errMsg.includes("reverted with reason string 'UNAUTHORIZED_CALLE'")).to.be.true;
      }
    });

  });

  describe("Other accounts", function() {
    it("Shoule not be able to call another contract if authorized", async function() {
      const thirdpartyContractAddress = thirdpartyContract.address;
      const depositSelector = thirdpartyContract.interface.getSighash("deposit");

      const signer1 = (await ethers.getSigners())[1].address;

      await stakingBridge.authorizeCall(thirdpartyContractAddress, depositSelector);
      await stakingBridge.addManager(signer1);

      const callValue1 = 123;
      const encodedCallData = thirdpartyContract.interface.encodeFunctionData("deposit", [callValue1]);
      try {
        // call with signer2
        await stakingBridge.connect((await ethers.getSigners())[2]).call(callId, thirdpartyContractAddress, encodedCallData);
      } catch (err) {
        const errMsg = (err as Error).message;
        expect(errMsg.includes("reverted with reason string 'NOT_MANAGER'")).to.be.true;
      }
    });

  });

});
