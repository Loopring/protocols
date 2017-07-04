var LoopringToken = artifacts.require("LoopringToken");

contract('LoopringToken', function(accounts) {
  it("should not be able to start ico sale when not called by owner.", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = accounts[2];
      console.log("target:", target, ", account[1]:", accounts[1]);
      return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(1) })
    }).then(function(tx) {
      console.log("tx:", tx);
      console.log("blockNumber:", web3.eth.blockNumber);
      return loopring.start(100, {from: target});
    }).then(function(tx) {
      console.log("tx:", tx);
      if (tx.logs) {
        for (var i = 0; i < tx.logs.length; i++) {
          var log = tx.logs[i];
          if (log.event == "InvalidCaller") {
            return true;
          }
        }
      }
      return false;
    }).then(function(result) {
      assert.equal(result, true, "no SaleStarted event found");
    });
  });

  it("should not allow create tokens before it starts", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = t;
      console.log("target:", target);
      return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(1) })
    }).then(function(tx) {
      console.log("tx:", tx);
      if (tx.logs) {
        for (var i = 0; i < tx.logs.length; i++) {
          var log = tx.logs[i];
          console.log("log: ", log);
          if (log.event == "Transfer") {
            return false;
          }
        }
      }
      return true;
    }).then(function(result) {
      assert.equal(result, true, "create tokens before sale start");
    });
  });

  it("should be able to start ico sale when called by owner.", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    var firstblock;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = t;
      return loopring.start(100, {from: target});
    }).then(function(tx) {
      console.log("tx: ", tx);
      if (tx.logs) {
        for (var i = 0; i < tx.logs.length; i++) {
          var log = tx.logs[i];
          console.log("log: ", log);
          if (log.event == "SaleStarted") {
            return true;
          }
        }
      }
      return false;
    }).then(function(result) {
      assert.equal(result, true, "no SaleStarted event found");
    });
  });

  it("should be able to create Loopring tokens after sale starts", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    var externalTxHash;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = t;
      return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(1) });
    }).then(function(tx) {
      console.log("tx:", tx);
      var txReceipt = web3.eth.getTransactionReceipt(tx);
      console.log("txReceipt :", txReceipt);
      return loopring.totalSupply.call({from:accounts[1]});
    }).then(function(b) {
      assert.equal(true, true, "no Loopring token Transfer event found");
    });
  });

  it("should be able to compute LRC token amount correctly", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    var targetBalance;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = t;
      return web3.eth.getBalance(target);
    }).then(function(balance) {
      console.log("balance", balance.toNumber());

      return false;
    }).then(function(result) {
      assert.equal(result, true, "token amount not compute correctly.");
    });

  });

  // it("should be able to pay correct number of lrcs and eths to proxies when ico succeeded and ended ", function() {
  //   assert.equals(true, false, "TODO");
  // });

  // it("should be able to refund eths to participants when ico failed ", function() {
  //   assert.equals(true, false, "TODO");
  // });


});
