
const abi = require("ethereumjs-abi");
const ethUtil = require("ethereumjs-util");

var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const AccountantImpl = artifacts.require("./AccountantImpl.sol");
const TestToken = artifacts.require("./TestToken.sol")

contract("AccountantImpl", (accounts) => {

  const owner = accounts[0];

  describe("AccountantImpl functionalities:", () => {
    it("TestCase1: constructor init", async () => {
      let accountantImplInstance = await AccountantImpl.deployed();
      const accountant0 = await accountantImplInstance.queryAccountant(0);
      assert(accountant0 == accounts[0]);
    });

    /*it("TestCase2: submitBlock", async () => {
      let accountantImplInstance = await AccountantImpl.deployed();
      var submitter = "0xa878630705edf91dc5cf68f8c5e9bc41da35ece1";
      //var rootHash = 0xe90b7bceb6e7df5418fb78d8ee546e97c83a08bbccc01a0644d599ccd2a7c2e0;
      var rootHash = 0x58248317ccfe9809918025b09d45c3d2b1df58636edb40c2741f080cae6f89f0;
      
      var seqNos = [0];
      var oldAccountants = [];
      oldAccountants.push(accounts[0]);
      var newAccountants = ["0x0f836425c0f0b0f744d919bbd720c4194ad2c75f"];
      var height = 100;
      var rootBefore = await accountantImplInstance.queryMerkleRoot(height);
      assert(rootBefore == 0);

      var hash = await accountantImplInstance.getHash(seqNos, oldAccountants, newAccountants, height, rootHash, submitter);
      var address = accounts[0];
      var sig = web3.eth.sign(address, hash).slice(2);
      var r = `0x${sig.slice(0, 64)}`;
      var s = `${sig.slice(64, 128)}`;
      var v = web3.toDecimal(sig.slice(128, 130)) + 27;
      var signatures =  '0x' + `${sig.slice(0, 64)}` + `${sig.slice(64, 128)}` + v.toString(16);
      console.log("signatures = " + signatures);
      await accountantImplInstance.submitBlock(seqNos, oldAccountants, newAccountants, height, rootHash, submitter, signatures, {from: owner});
      const accountant0 = await accountantImplInstance.queryAccountant(0);
      assert(accountant0 == 0x0f836425c0f0b0f744d919bbd720c4194ad2c75f);
      var rootAfter = await accountantImplInstance.queryMerkleRoot(height);
      console.log(rootAfter);
      assert(rootAfter == 0x58248317ccfe9809918025b09d45c3d2b1df58636edb40c2741f080cae6f89f0);
    });*/

    it("TestCase3: submitBlock and withdraw", async () => {
      let accountantImplInstance = await AccountantImpl.deployed();
      let testToken = await TestToken.deployed();

      var submitter = "0xa878630705edf91dc5cf68f8c5e9bc41da35ece1";
      var withdrawAmount = "00".repeat(31) + "01";
      var tokenAddress = testToken.address;
      const rawData = "0x" + "00".repeat(12) + tokenAddress.slice(2) + withdrawAmount + "00".repeat(12) + accounts[1].slice(2); 
      var pathProof = "0x" + "00".repeat(31) + "A1";
      const rootHash = await accountantImplInstance.calcRoot(rawData, pathProof);
      var seqNos = [0];
      var oldAccountants = [];
      oldAccountants.push(accounts[0]);
      var newAccountants = ["0x0f836425c0f0b0f744d919bbd720c4194ad2c75f"];
      var baseHeight = 0;
      var height = 100;
      var rootBefore = await accountantImplInstance.queryMerkleRoot(height);
      var hash = await accountantImplInstance.getHash(seqNos, oldAccountants, newAccountants, baseHeight, height, rootHash, submitter);
      var address = accounts[0];
      var sig = web3.eth.sign(address, hash).slice(2);
      var r = `0x${sig.slice(0, 64)}`;
      var s = `${sig.slice(64, 128)}`;
      var v = web3.toDecimal(sig.slice(128, 130)) + 27;
      var signatures =  '0x' + `${sig.slice(0, 64)}` + `${sig.slice(64, 128)}` + v.toString(16);
      await accountantImplInstance.submitBlock(seqNos, oldAccountants, newAccountants, baseHeight, height, rootHash, submitter, signatures, {from: owner});
      var rootAfter = await accountantImplInstance.queryMerkleRoot(height);

      assert(rootAfter == rootHash);

      const initAmount = await testToken.balanceOf(accounts[0]);
      await testToken.transfer(accountantImplInstance.address, 10, {from: accounts[0]});
      await accountantImplInstance.withdraw(height, rawData, pathProof, {from: accounts[1]});
      const amount = await testToken.balanceOf(accounts[1]);

      assert(amount == 1);
    });

  });

});