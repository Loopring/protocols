var Oedax      = artifacts.require("./impl/Oedax.sol");
var Curve      = artifacts.require("./impl/Curve.sol");
var FOO        = artifacts.require("./test/tokens/FOO.sol");
var BAR        = artifacts.require("./test/tokens/BAR.sol");
var TESTA      = artifacts.require("./test/tokens/TESTA.sol");
var TESTB      = artifacts.require("./test/tokens/TESTB.sol");

module.exports = function(deployer, network, accounts) {
  const numToBN = (num) => {
    return web3.utils.toBN("0x" + num.toString(16), 16);
  };

  deployer.then(() => {
    return Promise.all([
      Oedax.deployed(),
      Curve.deployed(),
      FOO.deployed(),
      BAR.deployed(),
      TESTA.deployed(),
      TESTB.deployed(),
    ]);
  }).then(async (contracts) => {
    const [oedax, curve] = contracts;
    await oedax.updateSettings(
      accounts[0],    // feeRecipient
      curve.address,  // curve
      5,
      20,
      1,              // minDurationMinutes
      1000,           // maxDurationMinutes
      1,
      1,
      1,
      1,              // creatorEtherStake
      {
        from: accounts[0]
      }
    );

    const auction1 = await oedax.createAuction(
      FOO.address,  // askToken
      BAR.address,  // bidToken
      numToBN(1e18), // minAskAmount
      numToBN(1e18), // minBidAmount
      numToBN(10),  // P
      numToBN(5),   // S
      numToBN(2),   // M
      numToBN(60),  // T1: 60 seconds
      numToBN(120), // T2: 120 seconds.
      {
        from: accounts[0],
        value: 1e18
      }
    );

    const auction2 = await oedax.createAuction(
      FOO.address,
      BAR.address,
      numToBN(1e18),
      numToBN(1e18),
      numToBN(100),
      numToBN(5),
      numToBN(2),
      numToBN(600),
      numToBN(7200),
      {
        from: accounts[0],
        value: 1e18
      }
    );

    const auction3 = await oedax.createAuction(
      TESTA.address,
      TESTB.address,
      numToBN(1e18),
      numToBN(1e18),
      numToBN(1),
      numToBN(5),
      numToBN(2),
      numToBN(3600),  // 1 hour
      numToBN(36000), // 10 hour
      {
        from: accounts[0],
        value: 1e18
      }
    );

    console.log("auction1 address:", auction1);
    console.log("auction2 address:", auction2);
    console.log("auction3 address:", auction3);
  });
};
