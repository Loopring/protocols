
const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");

var Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

const AccountantImpl = artifacts.require("./AccountantImpl.sol")

contract("AccountantImpl", (accounts) => {

  const owner = accounts[0];

  describe("AccountantImpl functionalities:", () => {
    it("TestCase1: constructor init", async () => {
      let instance = await AccountantImpl.deployed();
      const accountant0 = await instance.queryAccountant(0);
      //assert(accountant0 == 0xa878630705edf91dc5cf68f8c5e9bc41da35ece1);
      console.log(accountant0);
      assert(accountant0 == accounts[0]);
    });

    it("TestCase2: submitBlock", async () => {
      let instance = await AccountantImpl.deployed();
      var submitter = "0xa878630705edf91dc5cf68f8c5e9bc41da35ece1";
      var rootNum = 12345678;
      var seqNos = [0];
      var oldAccountants = [];
      oldAccountants.push(accounts[0]);
      var newAccountants = ["0x0f836425c0f0b0f744d919bbd720c4194ad2c75f"];
      var height = 100;
      var rootBefore = await instance.queryMerkleRoot(height);
      assert(rootBefore == 0);

      var hash = await instance.getHash(submitter, rootNum, seqNos, oldAccountants, newAccountants, height);
      var address = accounts[0];
      var sig = web3.eth.sign(address, hash).slice(2);
      var r = `0x${sig.slice(0, 64)}`;
      var s = `${sig.slice(64, 128)}`;
      var v = web3.toDecimal(sig.slice(128, 130)) + 27;
      var signatures =  '0x' + v.toString(16) + `${sig.slice(0, 64)}` + `${sig.slice(64, 128)}`;
      await instance.submitBlock(submitter, rootNum, seqNos, oldAccountants, newAccountants, height, signatures, {from: owner});
      const accountant0 = await instance.queryAccountant(0);
      assert(accountant0 == 0x0f836425c0f0b0f744d919bbd720c4194ad2c75f);
      var rootAfter = await instance.queryMerkleRoot(height);
      assert(rootAfter == 12345678);
    });

    it("TestCase3: withdraw", async () => {
      let instance = await AccountantImpl.deployed();
      var height = 100;
      const rawData = "0x" + "0074" + "A1".repeat(20) + "00".repeat(31) + "01" + accounts[0].slice(2); 
      console.log(rawData);
      const path = "0x" + "C3".repeat(32) + "D4".repeat(32);
      await instance.withdraw(height, rawData, [1,2], {from: accounts[0]});
      var heightStore = await instance.queryHeight(); 
      console.log(heightStore);
      var tokenStore = await instance.queryToken();
      console.log(tokenStore);
      var toStore = await instance.queryTo();
      console.log(toStore);
      var amountStore = await instance.queryAmount();  
      console.log(amountStore); 
      var root = await instance.getMerkleRoot(rawData, height, [1,2]);  
      console.log(root); 
    });

  });

});