import { expect } from "./setup";

//import { ethers } from 'hardhat'
import { l2ethers as ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("wallet lock", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
  });

  const name = "Some Really Cool Token Name";
  const initialSupply = 10000000;

  let TestPriceOracle: Contract;
  let SmartWallet: Contract;
  let WalletFactory: Contract;
  beforeEach(async () => {
    TestPriceOracle = await (await ethers.getContractFactory("TestPriceOracle"))
      .connect(account1)
      .deploy();

    SmartWallet = await (await ethers.getContractFactory("SmartWallet"))
      .connect(account1)
      .deploy(TestPriceOracle.address);

    WalletFactory = await (await ethers.getContractFactory("WalletFactory"))
      .connect(account1)
      .deploy(SmartWallet.address);
  });

  describe("the basics", () => {
    it("should have a name", async () => {
      expect(await ERC20.name()).to.equal(name);
    });

    it("should have a total supply equal to the initial supply", async () => {
      expect(await ERC20.totalSupply()).to.equal(initialSupply);
    });

    it("should give the initial supply to the creator's address", async () => {
      expect(await ERC20.balanceOf(await account1.getAddress())).to.equal(
        initialSupply
      );
    });
  });

  describe("transfer", () => {
    it("should revert when the sender does not have enough balance", async () => {
      const sender = account1;
      const recipient = account2;
      const amount = initialSupply + 2500000;

      await expect(
        ERC20.connect(sender).transfer(await recipient.getAddress(), amount)
      ).to.be.revertedWith(
        "You don't have enough balance to make this transfer!"
      );
    });

    it("should succeed when the sender has enough balance", async () => {
      const sender = account1;
      const recipient = account2;
      const amount = 2500000;

      await ERC20.connect(sender).transfer(
        await recipient.getAddress(),
        amount
      );

      expect(await ERC20.balanceOf(await account1.getAddress())).to.equal(
        initialSupply - amount
      );

      expect(await ERC20.balanceOf(await account2.getAddress())).to.equal(
        amount
      );
    });
  });
});
