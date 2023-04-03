import { expect } from "./setup";
import {
  MetaTx,
  signCallContractWA,
  signRecover,
  signMetaTx,
} from "./helper/signatureUtils";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures,
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers, artifacts } = require("hardhat");
import { Contract, Signer, Wallet } from "ethers";
import BN = require("bn.js");
import fs = require("fs");
// ethers.
describe("wallet", () => {
  let account1: Wallet;
  let account2: Wallet;
  let account3: Wallet;
  let recoverInterface: any;
  let guardianInterface: any;
  let metaTxInterface: any;
  let entryPointInterface: any;
  const feeRecipient = "0x" + "30".repeat(20);
  let TestContract: Contract;
  let LRC: Contract;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const GuardianLib = await ethers.getContractFactory("GuardianLib");
    const RecoverLib = await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: ethers.constants.AddressZero,
      },
    });
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const LRCFactory = await ethers.getContractFactory("LRC")

    recoverInterface = RecoverLib.interface;
    guardianInterface = GuardianLib.interface;
    entryPointInterface = EntryPoint.interface;
    LRC = await LRCFactory.deploy();

    TestContract = await (
      await ethers.getContractFactory("TestTargetContract")
    ).deploy();
  });

  describe("MetaTx", () => {
    it("recover", async () => {
      const owner = await account1.getAddress();
      const newOwner = await account2.getAddress();
      const validUntil = new Date().getTime() + 3600 * 24 * 1000;
      const guardian1 = ethers.Wallet.createRandom();
      const guardian2 = ethers.Wallet.createRandom();

      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1.address,
        guardian2.address,
      ]);
      const masterCopy = await wallet.getMasterCopy();

      const newGuardians = ["0x" + "11".repeat(20), "0x" + "22".repeat(20)];
      const sig1 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian1.address,
        guardian1.privateKey.slice(2)
      );
      const sig1Bs = Buffer.from(sig1.txSignature.slice(2), "hex");

      const sig2 = signRecover(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        newOwner,
        newGuardians,
        guardian2.address,
        guardian2.privateKey.slice(2)
      );
      const sig2Bs = Buffer.from(sig2.txSignature.slice(2), "hex");

      const sortedSigs = sortSignersAndSignatures(
        [guardian1.address, guardian2.address],
        [sig1Bs, sig2Bs]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };

      const data = wallet.interface.encodeFunctionData("recover", [
        approval,
        newOwner,
        newGuardians,
      ]);

      const tx = await wallet.execute(
        wallet.address,
        ethers.utils.parseEther("0"),
        data
      );
      await tx.wait();
      const ownerAfter = (await wallet.wallet()).owner;
      expect(ownerAfter).to.equal(newOwner);

      const guardiansAfter = await wallet.getGuardians(false);
      expect(guardiansAfter[0].addr).to.equal(newGuardians[0]);
      expect(guardiansAfter[1].addr).to.equal(newGuardians[1]);
    });

    it("transfer", async () => {
      const owner = await account1.getAddress();
      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, []);
      await account2.sendTransaction({
        from: await account2.getAddress(),
        to: wallet.address,
        value: ethers.utils.parseEther("100"),
      });
      const transferTo = "0x" + "30".repeat(20);
      wallet = wallet.connect(account1);
      const toBalanceBefore = await ethers.provider.getBalance(transferTo);
      expect(toBalanceBefore).to.equal(0);
      const tx = await wallet.execute(
        transferTo,
        ethers.utils.parseEther("10"),
        new Uint8Array(0)
      );
      await tx.wait();
      const toBalanceAfter = await ethers.provider.getBalance(transferTo);
      expect(toBalanceAfter).to.equal(ethers.utils.parseEther("10"));
    });
    
    it("transferERC20", async () => {
      const owner = await account1.getAddress();
      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, []);
      await account2.sendTransaction({
        from: await account2.getAddress(),
        to: wallet.address,
        value: ethers.utils.parseEther("100"),
      });
      const transferTo = "0x" + "30".repeat(20);
      const toBalanceBefore = await LRC.functions.balanceOf(transferTo);
      expect(toBalanceBefore.balance).to.equal(0);
      await LRC.setBalance(wallet.address, ethers.utils.parseEther("1000"));
      wallet = wallet.connect(account1);
      const data = wallet.interface.encodeFunctionData("transferToken", [
        LRC.address,
        transferTo,
        ethers.utils.parseEther("10"),
        new Uint8Array(0),
        false
      ]);
      const tx = await wallet.execute(
        wallet.address,
        "0",
        data
      );
      await tx.wait();
      const toBalanceAfter = await LRC.functions.balanceOf(transferTo);
      expect(toBalanceAfter.balance).to.equal(ethers.utils.parseEther("10"));
    });

    it("call contract WA", async () => {
      const owner = await account1.getAddress();
      const guardian1 = await account2.getAddress();
      const guardian2 = await account3.getAddress();
      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1,
        guardian2,
      ]);
      const masterCopy = await wallet.getMasterCopy();

      await account2.sendTransaction({
        from: await account2.getAddress(),
        to: wallet.address,
        value: ethers.utils.parseEther("100"),
      });

      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );

      const getPrivateKey = (address: string) => {
        const textData = fs.readFileSync("./test_account_keys.json", "ascii");
        const data = JSON.parse(textData);
        return data.private_keys[String(address).toLowerCase()];
      }

      const sig1 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
        owner,
        getPrivateKey(owner)
        // accountOwner.privateKey
        // account1.
      );

      const sig2 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
        guardian1,
        getPrivateKey(guardian1)
        // guardians_[0].privateKey
        // guardian1.privateKey.slice(2)
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardian1],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex"),
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address,
      };
      const data = wallet.interface.encodeFunctionData("callContractWA", [
        approval,
        TestContract.address,
        0,
        callData,
      ]);
      wallet = wallet.connect(account1);
      const tx = await wallet.execute(
        wallet.address,
        ethers.utils.parseEther("0"),
        data
      );
      await tx.wait();
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });
  });
});
