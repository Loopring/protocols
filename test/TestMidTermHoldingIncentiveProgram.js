var TestToken = artifacts.require("TestToken");
var MidTerm = artifacts.require("LRCMidTermHoldingContract");

contract('LRCMidTermHoldingContract', function(accounts) {

  // it("should allow owner to deposit and drain ETH", function() {
  //   var testToken;
  //   var program;
  //   var target;

  //   return TestToken.deployed()
  //     .then(function(instance){
  //       testToken = instance;
  //       return MidTerm.deployed();
  //     }).then(function(instance){
  //       program = instance;
  //     }).then(function(){
  //       // accounts[0] is the owner, this is specified in `2_deploy_my_contracts.js`.
  //       return web3.eth.sendTransaction({from: accounts[0], to: program.address, value: web3.toWei(10) });
  //     }).then(function(){
  //       return web3.eth.getBalance(program.address);
  //     }).then(function(balance) {
  //       assert.equal(balance.toNumber(), web3.toWei(10));
  //       return program.drain(7);
  //     }).then(function(){
  //        return web3.eth.getBalance(program.address);
  //     }).then(function(balance){
  //       assert.equal(balance.toNumber(), web3.toWei(3));
  //       return program.drain(5);
  //     }).then(function(){
  //        return web3.eth.getBalance(program.address);
  //     }).then(function(balance){
  //       assert.equal(balance.toNumber(), web3.toWei(0));
  //     });
  // });

  // it("should allow get ETH for LRC", function() {
  //   var testToken;
  //   var program;
  //   var target;

  //   var user = accounts[2];
  //   var owner = accounts[0];

  //   return TestToken.deployed()
  //     .then(function(instance){
  //       testToken = instance;
  //       return MidTerm.deployed();
  //     }).then(function(instance){
  //       program = instance;
  //       (program.address);
  //       return web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", id: 1})
  //     }).then(function(){
  //       return web3.eth.sendTransaction({from: owner, to: program.address, value: 10});
  //     }).then(function(){
  //       var issueTx = testToken.issueToken(user, 15000); // Issue TestToken to user
  //     }).then(function(){
  //       return testToken.balanceOf.call(user);
  //     }).then(function(balance){
  //       assert.equal(balance.toNumber(), web3.toWei(15000))
  //       // return web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", id: 100})
  //     }).then(function(){
  //       return web3.eth.sendTransaction({from: user, to: program.address, value: 0, data: "1" });
  //     // }).then(function(){
  //     });
  // });
});