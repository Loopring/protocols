import { expect } from "./setup";
import {
  MetaTx,
  signCallContractWA,
  signRecover,
  signMetaTx
} from "./helper/signatureUtils";
import {
  newWallet,
  getFirstEvent,
  getBlockTimestamp,
  sortSignersAndSignatures
} from "./commons";
// import { /*l2ethers as*/ ethers } from "hardhat";
const { ethers } = require("hardhat");

import { Contract, Signer } from "ethers";
import BN = require("bn.js");

describe("wallet", () => {
  let account1: Signer;
  let account2: Signer;
  let account3: Signer;
  let recoverInterface: any;
  let guardianInterface: any;
  let metaTxInterface: any;
  const feeRecipient = "0x" + "30".repeat(20);
  let TestContract: Contract;

  before(async () => {
    [account1, account2, account3] = await ethers.getSigners();
    const GuardianLib = await ethers.getContractFactory("GuardianLib");
    const RecoverLib = await ethers.getContractFactory("RecoverLib", {
      libraries: {
        GuardianLib: ethers.constants.AddressZero
      }
    });
    const MetaTxLib = await ethers.getContractFactory("MetaTxLib", {
      libraries: {
        ERC20Lib: ethers.constants.AddressZero
      }
    });

    recoverInterface = RecoverLib.interface;
    guardianInterface = GuardianLib.interface;
    metaTxInterface = MetaTxLib.interface;

    TestContract = await (await ethers.getContractFactory(
      "TestTargetContract"
    )).deploy();
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
        guardian2.address
      ]);
      const masterCopy = await wallet.getMasterCopy();

      // console.log("guardian1.privateKey:", guardian1.privateKey);
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
        wallet: wallet.address
      };

      const data = wallet.interface.encodeFunctionData("recover", [
        approval,
        newOwner,
        newGuardians
      ]);

      // const metaTxSigner = await account3.getAddress();
      const metaTx: MetaTx = {
        to: wallet.address,
        nonce: new BN(0),
        gasToken: ethers.constants.AddressZero,
        gasPrice: new BN(0),
        gasLimit: new BN(2000000),
        gasOverhead: new BN(0),
        feeRecipient,
        requiresSuccess: true,
        data: Buffer.from(data.slice(2, 10), "hex"),
        signature: Buffer.from(""),
        approvedHash: sig1.hash
      };

      // can not sign with old owner, because wallet owner if changed when
      // checking metaTx signature, and old owner is leaked or lost when doing recovery.
      const metaTxSig = signMetaTx(masterCopy, metaTx, newOwner);
      // console.log("metaTxHash:", metaTxSig.hash);

      const tx = await wallet.executeMetaTx(
        metaTx.to,
        metaTx.nonce.toString(10),
        metaTx.gasToken,
        metaTx.gasPrice.toString(10),
        metaTx.gasLimit.toString(10),
        metaTx.gasOverhead.toString(10),
        metaTx.feeRecipient,
        metaTx.requiresSuccess,
        data,
        metaTxSig.txSignature
      );
      const receipt = await tx.wait();
      // console.log("receipt:", receipt);

      const eventsLen = receipt.events.length;
      const metaTxEvent = metaTxInterface.decodeEventLog(
        "MetaTxExecuted(uint256,bytes32,bytes32,bool,uint256)",
        receipt.events[eventsLen - 1].data,
        receipt.events[eventsLen - 1].topics
      );
      // console.log("metaTxEvent:", metaTxEvent);

      expect(metaTxEvent.metaTxHash).to.equal(
        "0x" + metaTxSig.hash.toString("hex")
      );
      expect(metaTxEvent.success).to.equal(true);

      const ownerAfter = (await wallet.wallet()).owner;
      expect(ownerAfter).to.equal(newOwner);

      const guardiansAfter = await wallet.getGuardians(true);
      // console.log("guardiansAfter:", guardiansAfter);
      expect(guardiansAfter[0].addr).to.equal(newGuardians[0]);
      expect(guardiansAfter[1].addr).to.equal(newGuardians[1]);
    });

    it("transfer", async () => {
      const owner = await account1.getAddress();
      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, []);
      const masterCopy = await wallet.getMasterCopy();

      await account2.sendTransaction({
        from: await account2.getAddress(),
        to: wallet.address,
        value: ethers.utils.parseEther("100")
      });

      const transferTo = "0x" + "30".repeat(20);
      // transfer ETH:
      const data = wallet.interface.encodeFunctionData("transferToken", [
        ethers.constants.AddressZero,
        transferTo,
        ethers.utils.parseEther("10"),
        [],
        false
      ]);

      wallet = wallet.connect(account3);
      const metaTx: MetaTx = {
        to: wallet.address,
        nonce: new BN(new Date().getTime()),
        gasToken: ethers.constants.AddressZero,
        gasPrice: new BN(0),
        gasLimit: new BN(1000000),
        gasOverhead: new BN(0),
        feeRecipient,
        requiresSuccess: true,
        data: Buffer.from(data.slice(2), "hex"),
        signature: Buffer.from(""),
        approvedHash: Buffer.from(
          "0000000000000000000000000000000000000000000000000000000000000000",
          "hex"
        )
      };
      const metaTxSig = signMetaTx(masterCopy, metaTx, owner);

      const toBalanceBefore = await ethers.provider.getBalance(transferTo);
      expect(toBalanceBefore).to.equal(0);

      // const metaTxData = wallet.interface.encodeFunctionData("executeMetaTx", [
      //   metaTx.to,
      //   metaTx.nonce.toString(10),
      //   metaTx.gasToken,
      //   metaTx.gasPrice.toString(10),
      //   metaTx.gasLimit.toString(10),
      //   metaTx.gasOverhead.toString(10),
      //   metaTx.requiresSuccess,
      //   metaTx.data,
      //   Buffer.from(metaTxSig.txSignature.slice(2), "hex")
      // ]);
      // console.log("metaTxData:", metaTxData);

      const tx = await wallet.executeMetaTx(
        metaTx.to,
        metaTx.nonce.toString(10),
        metaTx.gasToken,
        metaTx.gasPrice.toString(10),
        metaTx.gasLimit.toString(10),
        metaTx.gasOverhead.toString(10),
        metaTx.feeRecipient,
        metaTx.requiresSuccess,
        metaTx.data,
        Buffer.from(metaTxSig.txSignature.slice(2), "hex")
      );
      const receipt = await tx.wait();
      // console.log("receipt:", receipt);
      const metaTxEvent = metaTxInterface.decodeEventLog(
        "MetaTxExecuted(uint256,bytes32,bytes32,bool,uint256)",
        receipt.events[1].data,
        receipt.events[1].topics
      );
      // console.log("metaTxEvent:", metaTxEvent);
      expect(metaTxEvent.success).to.equal(true);
      const toBalanceAfter = await ethers.provider.getBalance(transferTo);
      expect(toBalanceAfter).to.equal(ethers.utils.parseEther("10"));
    });

    it("call contract WA", async () => {
      const owner = await account1.getAddress();
      const guardian1 = await account2.getAddress();
      const guardian2 = await account3.getAddress();
      let wallet = await newWallet(owner, ethers.constants.AddressZero, 0, [
        guardian1,
        guardian2
      ]);
      const masterCopy = await wallet.getMasterCopy();

      await account2.sendTransaction({
        from: await account2.getAddress(),
        to: wallet.address,
        value: ethers.utils.parseEther("100")
      });

      const validUntil = new Date().getTime() + 1000 * 3600 * 24; // one day
      const callData = TestContract.interface.encodeFunctionData(
        "functionDefault",
        [10]
      );

      const sig1 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
        owner
      );

      const sig2 = signCallContractWA(
        masterCopy,
        wallet.address,
        new BN(validUntil),
        TestContract.address,
        new BN(0),
        Buffer.from(callData.slice(2), "hex"),
        guardian1
      );

      const sortedSigs = sortSignersAndSignatures(
        [owner, guardian1],
        [
          Buffer.from(sig1.txSignature.slice(2), "hex"),
          Buffer.from(sig2.txSignature.slice(2), "hex")
        ]
      );

      const approval = {
        signers: sortedSigs.sortedSigners,
        signatures: sortedSigs.sortedSignatures,
        validUntil,
        wallet: wallet.address
      };

      // callContractWA
      const data = wallet.interface.encodeFunctionData("callContractWA", [
        approval,
        TestContract.address,
        0,
        callData
      ]);

      wallet = wallet.connect(account3);
      const metaTx: MetaTx = {
        to: wallet.address,
        nonce: new BN(0),
        gasToken: ethers.constants.AddressZero,
        gasPrice: new BN(0),
        gasLimit: new BN(2000000),
        gasOverhead: new BN(0),
        feeRecipient,
        requiresSuccess: true,
        data: Buffer.from(data.slice(2, 10), "hex"),
        signature: Buffer.from(""),
        approvedHash: sig1.hash
      };
      const metaTxSig = signMetaTx(masterCopy, metaTx, owner);

      const tx = await wallet.executeMetaTx(
        metaTx.to,
        metaTx.nonce.toString(10),
        metaTx.gasToken,
        metaTx.gasPrice.toString(10),
        metaTx.gasLimit.toString(10),
        metaTx.gasOverhead.toString(10),
        metaTx.feeRecipient,
        metaTx.requiresSuccess,
        data,
        metaTxSig.txSignature
      );
      const receipt = await tx.wait();

      const eventsLen = receipt.events.length;
      const metaTxEvent = metaTxInterface.decodeEventLog(
        "MetaTxExecuted(uint256,bytes32,bytes32,bool,uint256)",
        receipt.events[eventsLen - 1].data,
        receipt.events[eventsLen - 1].topics
      );
      // console.log("metaTxEvent:", metaTxEvent);

      expect(metaTxEvent.metaTxHash).to.equal(
        "0x" + metaTxSig.hash.toString("hex")
      );
      expect(metaTxEvent.success).to.equal(true);

      // Check if the funtion has been called
      const event = await getFirstEvent(
        TestContract,
        tx.blockNumber,
        "Invoked"
      );
      expect(event.args.sender).to.equal(wallet.address);
    });
  });
});
