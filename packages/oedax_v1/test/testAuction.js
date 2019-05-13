const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");
const Auction = artifacts.require("Auction");

const auctionABI = '[{"constant":false,"inputs":[],"name":"settle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"bid","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getStatus","outputs":[{"name":"isBounded","type":"bool"},{"name":"timeRemaining","type":"uint256"},{"name":"actualPrice","type":"uint256"},{"name":"askPrice","type":"uint256"},{"name":"bidPrice","type":"uint256"},{"name":"askAllowed","type":"uint256"},{"name":"bidAllowed","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"users","type":"address[]"}],"name":"withdrawFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"ask","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"askAmount","type":"int256"},{"indexed":false,"name":"bidAmount","type":"int256"}],"name":"Trade","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]';

contract("Oedax-Auction", async(accounts) => {
  const deployer = accounts[0];
  let curve;
  let oedax;
  let fooToken;
  let barToken;

  before(async() => {
    curve = await Curve.deployed();
    oedax = await Oedax.deployed();
    fooToken = await FOO.deployed();
    barToken = await BAR.deployed();
  });

  const numToBN = (num) => {
    return web3.utils.toBN("0x" + num.toString(16), 16);
  };

  it("should excute auction", async function() {

    console.log("oedax addr: ", oedax.address)
    console.log("accounts[0]: ", accounts[0])
    // update oedax
    await oedax.updateSettings(accounts[0], curve.address, 5, 20, 1, 10, 15, 25, 35, 1);

    const minAskAmount = 100e18;
    const minBidAmount = 10e18;

    await oedax.setTokenRank(fooToken.address, numToBN(10), {
      from: deployer
    });
    await oedax.setTokenRank(barToken.address, numToBN(100), {
      from: deployer
    });

    const blockBefore = await web3.eth.getBlockNumber();
    // create auction
    await oedax.createAuction(fooToken.address, barToken.address, numToBN(minAskAmount), numToBN(minBidAmount), numToBN(10), numToBN(5), numToBN(2), numToBN(60), numToBN(120), {
      from: deployer,
      value: 1e18
    });
    const blockAfter = await web3.eth.getBlockNumber();

    const auctionCreationEvent = await oedax.getPastEvents("AuctionCreated", {
      fromBlock: blockBefore,
      toBlock: blockAfter
    });

    const blockBefore1 = await web3.eth.getBlockNumber();
    const previousTimestamp = (await web3.eth.getBlock(blockBefore1)).timestamp;
/*
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [150001], id: 0}, function() {
        console.log("evm_increaseTime done")
      });*/

    const auctionAddr = auctionCreationEvent[0].returnValues.auctionAddr;
    console.log("auctionAddr", auctionAddr)

    const auctionInstance = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr);

    const asker = accounts[5];
    const bidder = accounts[6];

    const askerFooTokenNum = await fooToken.balanceOf(asker);
    console.log("asker fooToken num: " + askerFooTokenNum)

    await fooToken.setBalance(asker, numToBN(100000e18));
    await barToken.setBalance(bidder, numToBN(100000000e18));

    const askerFooTokenNumAfter = await fooToken.balanceOf(asker);
    console.log("askerFooTokenNumAfter asker fooToken num: " + askerFooTokenNumAfter)

    await fooToken.approve(oedax.address, numToBN(100000e18), {
      from: asker
    });

    await barToken.approve(oedax.address, numToBN(1000000000e18), {
      from: bidder
    });

    const blockAfter1 = await web3.eth.getBlockNumber();
    const currentTimestamp = (await web3.eth.getBlock(blockAfter1)).timestamp;
    console.log("blockBefore1:", blockBefore1, "; blockAfter1:", blockAfter1);
    console.log("previousTimestamp:", previousTimestamp, "; currentTimestamp:", currentTimestamp);

    const status = await auctionInstance.methods.getStatus().call();
    console.log("status!!!!!!!!! ");
    console.log("isBounded: ", status.isBounded);
    console.log("timeRemaining: ", status.timeRemaining);
    console.log("actualPrice: ", status.actualPrice);
    console.log("askPrice: ", status.askPrice);
    console.log("bidPrice: ", status.bidPrice);
    console.log("askAllowed: ", status.askAllowed);
    console.log("bidAllowed: ", status.bidAllowed);
    console.log();

    // bid
    await auctionInstance.methods.bid(numToBN(10e18).toString(10)).send({
      from: bidder, gas: 1000000
    });

    const status1 = await auctionInstance.methods.getStatus().call();
    console.log("status########## ");
    console.log("isBounded: ", status1.isBounded);
    console.log("timeRemaining: ", status1.timeRemaining);
    console.log("actualPrice: ", status1.actualPrice);
    console.log("askPrice: ", status1.askPrice);
    console.log("bidPrice: ", status1.bidPrice);
    console.log("askAllowed: ", status1.askAllowed);
    console.log("bidAllowed: ", status1.bidAllowed);
    console.log();

    // ask
    await auctionInstance.methods.ask(numToBN(10000e18).toString(10)).send({
      from: asker, gas: 1000000
    });

    const status2 = await auctionInstance.methods.getStatus().call();
    console.log("status2########## ");
    console.log("isBounded: ", status2.isBounded);
    console.log("timeRemaining: ", status2.timeRemaining);
    console.log("actualPrice: ", status2.actualPrice);
    console.log("askPrice: ", status2.askPrice);
    console.log("bidPrice: ", status2.bidPrice);
    console.log("askAllowed: ", status2.askAllowed);
    console.log("bidAllowed: ", status2.bidAllowed);
    console.log();

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [20], id: 0}, function() {
      console.log("evm_increaseTime done")
    });

    const status4 = await auctionInstance.methods.getStatus().call();
    console.log("status3########## ");
    console.log("isBounded: ", status4.isBounded);
    console.log("timeRemaining: ", status4.timeRemaining);
    console.log("actualPrice: ", status4.actualPrice);
    console.log("askPrice: ", status4.askPrice);
    console.log("bidPrice: ", status4.bidPrice);
    console.log("askAllowed: ", status4.askAllowed);
    console.log("bidAllowed: ", status4.bidAllowed);
    console.log();

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [100], id: 0}, function() {
      console.log("evm_increaseTime done")
    });

    const auctionBidToken = await barToken.balanceOf(auctionAddr);
    console.log("auctionBidToken: ", auctionBidToken)
    const auctionAskToken = await fooToken.balanceOf(auctionAddr);
    console.log("auctionAskToken: ", auctionAskToken)

    const auctionEthBeforeSettle = await web3.eth.getBalance(auctionAddr);
    console.log("auctionEthBeforeSettle ", auctionEthBeforeSettle);
    const oedaxEthBeforeSettle = await web3.eth.getBalance(oedax.address);
    console.log("oedaxEthBeforeSettle ", oedaxEthBeforeSettle);
    // settle
    await auctionInstance.methods.settle().send({
      from: bidder, gas: 6000000
    });
    const auctionEthAfterSettle = await web3.eth.getBalance(auctionAddr);
    console.log("auctionEthAfterSettle ", auctionEthAfterSettle);
    const oedaxEthAfterSettle = await web3.eth.getBalance(oedax.address);
    console.log("oedaxEthAfterSettle ", oedaxEthAfterSettle);

    const status5 = await auctionInstance.methods.getStatus().call();
    console.log("status5########## ");
    console.log("isBounded: ", status5.isBounded);
    console.log("timeRemaining: ", status5.timeRemaining);
    console.log("actualPrice: ", status5.actualPrice);
    console.log("askPrice: ", status5.askPrice);
    console.log("bidPrice: ", status5.bidPrice);
    console.log("askAllowed: ", status5.askAllowed);
    console.log("bidAllowed: ", status5.bidAllowed);
    console.log();

    const auctionBidTokenAfter = await barToken.balanceOf(auctionAddr);
    console.log("auctionBidTokenAfter: ", auctionBidTokenAfter)
    const auctionAskTokenAfter = await fooToken.balanceOf(auctionAddr);
    console.log("auctionAskTokenAfter: ", auctionAskTokenAfter)
    assert.equal(1, 2,  "error");
  });

});