var LoopringToken = artifacts.require("LoopringToken");

contract('LoopringToken', function(accounts) {
  it("should not be able to start ico sale when not called by owner.", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      console.log("loopring:", loopring.address);
      return loopring.target.call({from: accounts[1]});
    }).then(function(t){
      target = accounts[1];
      web3.eth.sendTransaction({from: accounts[1], to: loopring.address, value: web3.toWei(1) })
      return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(1) })
    }).then(function(tx) {
      console.log("tx:", tx);
      console.log("blockNumber:", web3.eth.blockNumber);
      return loopring.start(100, {from: accounts[1]});
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
      firstblock = t.blockNumber + 1;
      return web3.eth.sendTransaction({from: accounts[1], to: loopring.address, value: web3.toWei(1) });

    }).then(function(txHash) {
      console.log("txHash", txHash);
      // InvalidState event shoud emitted here.
      return true;
    }).then(function(result) {
      assert.equal(result, true, "create tokens before sale start");
    });
  });

  it("should be able to start ico sale when called by owner.", function() {
    console.log("\n" + "-".repeat(100) + "\n");
    var loopring;
    var target;
    return LoopringToken.deployed().then(function(instance) {
      loopring = instance;
      return loopring.target.call();
    }).then(function(t){
      target = t;
      return loopring.start(10, {from: target});
    }).then(function(tx) {
      console.log("tx: ", tx);
      if (tx.logs) {
        for (var i = 0; i < tx.logs.length; i++) {
          var log = tx.logs[i];
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
      return web3.eth.sendTransaction({from: accounts[1], to: loopring.address, value: web3.toWei(1), gas: 500000 });
    }).then(function(tx) {
      console.log("tx:", tx);
      return loopring.balanceOf(accounts[1], {from: accounts[1]});
    }).then(function(bal) {
      console.log("bal: ", bal.toNumber());
      assert.equal(bal.toNumber(), web3.toWei(6000), "no Loopring token Transfer event found");
    });
  });

  // it("should be able to compute LRC token amount correctly", function() {
  //   console.log("\n" + "-".repeat(100) + "\n");
  //   var loopring;
  //   var target;
  //   return LoopringToken.deployed().then(function(instance) {
  //     loopring = instance;
  //     return loopring.target.call({from: accounts[1]});
  //   }).then(function(t){
  //     target = t;
  //     return web3.eth.getBalance(target);
  //   }).then(function(balance) {
  //     console.log("target balance at begin:", balance.toNumber());
  //     return loopring.computeTokenAmount(web3.toWei(1));
  //   }).then(function(amount1) {
  //     console.log("amount1:", amount1);
  //     assert.equal(amount1.toNumber(), 6000e+18 * 1, "token amount not compute correctly in phase 1.");
  //     return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase });
  //   }).then(function(tx) {
  //     console.log("txHash 1: ", tx);
  //     return loopring.computeTokenAmount(web3.toWei(2.19));
  //   }).then(function(amount2){
  //     console.log("amount2:", amount2);
  //     assert.equal(amount2.toNumber(), 2.19e+18 * 5750, "token amount not compute correctly in phase 2.");
  //     return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase });
  //   }).then(function(tx) {
  //     console.log("txHash 2: ", tx);
  //     return loopring.computeTokenAmount(web3.toWei(3.04598));
  //   }).then(function(amount3){
  //     console.log("amount3:", amount3);
  //     assert.equal(amount3.toNumber(), 3.04598e+18 * 5500, "token amount not compute correctly in phase 3.");
  //     return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase });
  //   }).then(function(tx) {
  //     console.log("txHash 3: ", tx);
  //     return loopring.computeTokenAmount(web3.toWei(1237.472));
  //   }).then(function(amount4){
  //     console.log("amount4:", amount4);
  //     assert.equal(amount4.toNumber(), 1237.472e+18 * 5250, "token amount not compute correctly in phase 4.");
  //     return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase });
  //   }).then(function(tx) {
  //     console.log("txHash 4: ", tx);
  //     return loopring.computeTokenAmount(web3.toWei(0.01));
  //   }).then(function(amount5){
  //     console.log("amount5:", amount5);
  //     assert.equal(amount5.toNumber(), 0.01e+18 * 5000, "token amount not compute correctly in phase 5.");
  //     return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase * 3.1 });
  //   }).then(function(tx) {
  //     console.log("txHash 5: ", tx);
  //     return loopring.computeTokenAmount(web3.toWei(1));
  //   }).then(function(amount6){
  //     console.log("amount6:", amount6);
  //     assert.equal(amount6.toNumber(), 1e+18 * 5000, "token amount not compute correctly in phase 5.");
  //   });

  // });

});

// contract('LoopringToken', function(accounts) {
//   it("should be able to compute LRC token amount correctly when across phases", function() {
//     console.log("\n" + "-".repeat(100) + "\n");
//     var loopring;
//     var target;
//     var targetBalance;
//     var targetInitBalance;
//     var ethGoalPerPhase;
//     return LoopringToken.deployed().then(function(instance) {
//       loopring = instance;
//       return loopring.target.call({from: accounts[1]});
//     }).then(function(t){
//       target = t;
//       return loopring.ethGoalPerPhase.call({from: accounts[1]});
//     }).then(function(goal){
//       ethGoalPerPhase = goal;
//       console.log("ethGoalPerPhase:", ethGoalPerPhase);
//       return web3.eth.getBalance(target);
//     }).then(function(balance) {
//       console.log("target balance at begin:", balance.toNumber());
//       targetBalance = balance.toNumber();
//       return web3.eth.sendTransaction({from: accounts[1], to: target, value: ethGoalPerPhase - targetBalance - web3.toWei(1) });
//     }).then(function(tx) {
//       console.log("txHash 1: ", tx);
//       return loopring.computeTokenAmount(web3.toWei(12.19), {from: accounts[1]});
//     }).then(function(amount1){
//       console.log("amount1:", amount1);
//       assert.equal(amount1.toNumber(), (1e+18) * 6000 + 11.19e+18 * 5750, "token amount not computed correctly in phase 1 across phase 2.");
//     });

//   });
// });

// contract('LoopringToken', function(accounts) {
//   it("should be able to compute LRC token amount correctly for owner after sale.", function() {
//     console.log("\n" + "-".repeat(100) + "\n");
//     var loopring;
//     var target;
//     var targetBalance;
//     var targetInitBalance;
//     var ethGoalPerPhase;
//     var totalEthAmountAchieved;
//     return LoopringToken.deployed().then(function(instance) {
//       loopring = instance;
//       return loopring.target.call({from: accounts[1]});
//     }).then(function(t){
//       target = t;
//       return loopring.ethGoalPerPhase.call({from: accounts[1]});
//     }).then(function(goal){
//       ethGoalPerPhase = goal;
//       console.log("ethGoalPerPhase:", ethGoalPerPhase);
//       return web3.eth.getBalance(target);
//     }).then(function(balance) {
//       console.log("target balance at begin:", balance.toNumber());
//       targetBalance = balance.toNumber();
//       totalEthAmountAchieved = 50000 + Math.random() * 10000;
//       console.log("totalEthAmountAchieved: ", totalEthAmountAchieved);
//       return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(totalEthAmountAchieved) - targetBalance });
//     }).then(function(tx) {
//       console.log("txHash 1: ", tx);
//       return loopring.tokenAmountForOwner({from: accounts[1]});
//     }).then(function(amount1){
//       console.log("amount1:", amount1);
//       var tokenSaled = 20000 * 6000 + 20000 * 5750 + (totalEthAmountAchieved - 40000) * 5500;
//       console.log("tokenSaled:", tokenSaled);
//       assert.equal(amount1.toNumber(), web3.toWei(tokenSaled) * (60.0/40) , "token amount not computed correctly for owner after sale.");
//       totalEthAmountAchieved += 10000;
//       return web3.eth.sendTransaction({from: accounts[1], to: target, value: web3.toWei(10000) });
//     }).then(function(tx) {
//       console.log("txHash 1: ", tx);
//       return loopring.tokenAmountForOwner({from: accounts[1]});
//     }).then(function(amount1){
//       console.log("amount1:", amount1);
//       var tokenSaled = 20000 * 6000 + 20000 * 5750 + (totalEthAmountAchieved - 40000) * 5500;
//       console.log("tokenSaled:", tokenSaled);
//       assert.equal(amount1.toNumber(), web3.toWei(tokenSaled) * (60.0/40) , "token amount not computed correctly for owner after sale.");
//     });

//   });
// });
