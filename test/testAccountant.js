
"use strict";
const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");

const AccountantImpl = artifacts.require("./AccountantImpl.sol")

contract("AccountantImpl", (accounts) => {

  const owner = accounts[0];
  const accountantImpl = AccountantImpl.at(AccountantImpl.address);

  describe("AccountantImpl functionalities:", () => {
    it("TestCase1: constructor init", async () => {
      const accountant0 = await accountantImpl.queryAccountant(0);
      const accountant1 = await accountantImpl.queryAccountant(1);
      console.log("constructor init accountants list:");
      console.log(accountant0);
      console.log(accountant1);
    });

    it("TestCase2: submitBlock", async () => {
      var rootNum = 12345678;
      var seqNos = [0, 1];
      var oldAccountants = ["0xf264cd2b6d02e5ed54dd6a1cef5bc7e2746ef893", "0x25c592617f439db108e5531c456016e823b7046d"];
      var newAccountants = ["0x25c592617f439db108e5531c456016e823b7046d", "0xf264cd2b6d02e5ed54dd6a1cef5bc7e2746ef893"];
      var height = 100;
      var signatures = "";
      var rootBefore = await accountantImpl.queryMerkleRoot(height);
      console.log(rootBefore);     
      await accountantImpl.submitBlock(rootNum, seqNos, oldAccountants, newAccountants, height, signatures, {from: owner});
      const accountant0After = await accountantImpl.queryAccountant(0);
      const accountant1After = await accountantImpl.queryAccountant(1);
      console.log("submitBlock list:");
      console.log(accountant0After);
      console.log(accountant1After);
      var rootAfter = await accountantImpl.queryMerkleRoot(height);
      console.log(rootAfter);
      var hashPackage = await accountantImpl.getPackage(rootNum, seqNos, oldAccountants, newAccountants, height, signatures);
      console.log(hashPackage);
      var hash = await accountantImpl.getHash(rootNum, seqNos, oldAccountants, newAccountants, height, signatures);
      console.log(hash);


      const privateKey = ethUtil.sha3("any strings");
      const address = ethUtil.bufferToHex(ethUtil.privateToAddress(privateKey));

      const finalTypes = ["bytes32"];
      const finalValues = [];
      finalValues.push(hash);

      const signature = ethUtil.ecsign(abi.soliditySHA3(finalTypes, finalValues), privateKey);
      console.log(signature);
      
      const sig = "0x" + "27" + "A1".repeat(32) + "B2".repeat(32) + "28" + "C3".repeat(32) + "D4".repeat(32);
      var parseSig = await accountantImpl.parseSignatures(sig, 2);
      console.log(parseSig);

    });

  });

});