const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");
const Auction = artifacts.require("Auction");

//const auctionABI = '[{"constant":false,"inputs":[],"name":"settle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"bid","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getStatus","outputs":[{"name":"isBounded","type":"bool"},{"name":"timeRemaining","type":"uint256"},{"name":"actualPrice","type":"uint256"},{"name":"askPrice","type":"uint256"},{"name":"bidPrice","type":"uint256"},{"name":"askAllowed","type":"uint256"},{"name":"bidAllowed","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"users","type":"address[]"}],"name":"withdrawFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"ask","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"askAmount","type":"int256"},{"indexed":false,"name":"bidAmount","type":"int256"}],"name":"Trade","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]';

const abi = Auction.abi

contract("Oedax-Auction-Multi-Users-Success-Settle-Multi-Times", async(accounts) => {
  const deployer = accounts[0];
  const feeRecipient = accounts[1];
  const settler = accounts[2];

  const asker = accounts[5];
  const bidder = accounts[6];

  const asker1 = accounts[7];
  const bidder1 = accounts[8];

  const minAskAmount = 1;
  const minBidAmount = 1;

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

  it("should execute auction", async function() {

    console.log("deployer is:     ", deployer);
    console.log("feeRecipient is: ", feeRecipient);
    console.log("asker is:        ", asker);
    console.log("bidder is:       ", bidder);
    console.log("asker1 is:       ", asker1);
    console.log("bidder1 is:      ", bidder1);
    console.log("oedax addr:      ", oedax.address);
    console.log();

    // update oedax
    //await oedax.updateSettings(feeRecipient, curve.address, 5, 20, 1, 10, 15, 25, 35, 1);
    await oedax.updateSettings(feeRecipient, curve.address, 5, 20, 1, 300, 1, 1, 1, 1);

    const recipient = await oedax.feeRecipient();
    const curveAddress = await oedax.curveAddress();
    const settleGracePeriodBase = await oedax.settleGracePeriodBase();
    const settleGracePeriodPerUser = await oedax.settleGracePeriodPerUser();
    const minDuration = await oedax.minDuration();
    const maxDuration = await oedax.maxDuration();
    const protocolFeeBips = await oedax.protocolFeeBips();
    const ownerFeeBips = await oedax.ownerFeeBips();
    const takerFeeBips = await oedax.takerFeeBips();
    const creatorEtherStake = await oedax.creatorEtherStake();

    assert.equal(recipient, accounts[1], "feeRecipient error");
    assert.equal(curveAddress, curve.address,  "curveAddress error");
    assert.equal(settleGracePeriodBase, 5*60,  "settleGracePeriodBase error");
    assert.equal(settleGracePeriodPerUser, 20,  "settleGracePeriodPerUser error");
    assert.equal(minDuration, 1*60,  "minDuration error");
    assert.equal(maxDuration, 300*60,  "maxDuration error");
    assert.equal(protocolFeeBips, 1,  "protocolFeeBips error");
    assert.equal(ownerFeeBips, 1,  "ownerFeeBips error");
    assert.equal(takerFeeBips, 1,  "takerFeeBips error");
    assert.equal(creatorEtherStake, 1e18,  "creatorEtherStake error");
    console.log();

    await oedax.setTokenRank(fooToken.address, numToBN(10), {from: deployer});
    await oedax.setTokenRank(barToken.address, numToBN(100), {from: deployer});

    const blockBefore = await web3.eth.getBlockNumber();

    const  P = 10;
    const  S = 5;
    const  M = 2;
    const  T1 = 60;
    const  T2 = 10800;
    // create auction
    await oedax.createAuction(fooToken.address, barToken.address, numToBN(minAskAmount), numToBN(minBidAmount), 
                              numToBN(P), numToBN(S), numToBN(M), numToBN(T1), numToBN(T2), {from: deployer, value: 1e18});
    const blockAfter = await web3.eth.getBlockNumber();

    const auctionCreationEvent = await oedax.getPastEvents("AuctionCreated", {fromBlock: blockBefore, toBlock: blockAfter});

    const blockBefore1 = await web3.eth.getBlockNumber();
    const previousTimestamp = (await web3.eth.getBlock(blockBefore1)).timestamp;

    const auctionAddr = auctionCreationEvent[0].returnValues.auctionAddr;
    console.log("auctionAddr", auctionAddr)

    //const auctionInstance = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr);
    var auctionInstance = new web3.eth.Contract(abi, auctionAddr);

    await fooToken.setBalance(asker, numToBN(100000));
    await barToken.setBalance(bidder, numToBN(10));
    await fooToken.setBalance(asker1, numToBN(100000));
    await barToken.setBalance(bidder1, numToBN(10));

    // record init askers
    const askerFooTokenBefore = await fooToken.balanceOf(asker);
    assert.equal(askerFooTokenBefore, 100000, "askerFooTokenBefore error");
    const askerBarTokenBefore = await barToken.balanceOf(asker);
    console.log("askerBarTokenBefore: " + askerBarTokenBefore);
    assert.equal(askerBarTokenBefore, 0, "askerBarTokenBefore error");

    const asker1FooTokenBefore = await fooToken.balanceOf(asker1);
    assert.equal(asker1FooTokenBefore, 100000, "balance error");
    const asker1BarTokenBefore = await barToken.balanceOf(asker1);
    assert.equal(asker1BarTokenBefore, 0, "asker1BarTokenBefore error");

    // record init bidders
    const bidderFooTokenBefore = await fooToken.balanceOf(bidder);
    assert.equal(bidderFooTokenBefore, 0, "bidderFooTokenBefore error");
    const bidderBarTokenBefore = await barToken.balanceOf(bidder);
    assert.equal(bidderBarTokenBefore, 10, "bidderBarTokenBefore error");

    const bidder1FooTokenBefore = await fooToken.balanceOf(bidder1);
    assert.equal(bidder1FooTokenBefore, 0, "bidder1FooTokenBefore error");
    const bidder1BarTokenBefore = await barToken.balanceOf(bidder1);
    assert.equal(bidder1BarTokenBefore, 10, "bidder1BarTokenBefore error");

    // record init recipient
    const recipientFooTokenBefore = await fooToken.balanceOf(recipient);
    assert.equal(recipientFooTokenBefore, 0, "recipientFooTokenBefore error");
    const recipientBarTokenBefore = await barToken.balanceOf(recipient);
    assert.equal(recipientBarTokenBefore, 0, "recipientBarTokenBefore error");

    await fooToken.approve(oedax.address, numToBN(100000), {
      from: asker
    });

    await fooToken.approve(oedax.address, numToBN(100000), {
      from: asker1
    });

    await barToken.approve(oedax.address, numToBN(1000000000), {
      from: bidder
    });

    await barToken.approve(oedax.address, numToBN(1000000000), {
      from: bidder1
    });

    const status0 = await auctionInstance.methods.getStatus().call();
    console.log("status0 ");
    console.log("isBounded: ", status0.isBounded);
    console.log("timeRemaining: ", status0.timeRemaining);
    console.log("actualPrice: ", status0.actualPrice);
    console.log("askPrice: ", status0.askPrice);
    console.log("bidPrice: ", status0.bidPrice);
    console.log("askAllowed: ", status0.askAllowed);
    console.log("bidAllowed: ", status0.bidAllowed);
    console.log();

    // bid
    await auctionInstance.methods.bid(numToBN(10).toString(10)).send({
      from: bidder, gas: 1000000
    });

    await auctionInstance.methods.bid(numToBN(10).toString(10)).send({
      from: bidder1, gas: 1000000
    });

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [20], id: 0}, function() {console.log("increaseTime 20");});

    // ask
    await auctionInstance.methods.ask(numToBN(100000).toString(10)).send({
      from: asker, gas: 1000000
    });
    await auctionInstance.methods.ask(numToBN(100000).toString(10)).send({
      from: asker1, gas: 1000000
    });

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [1200], id: 0}, function() {
      console.log("increaseTime 1200");
    });

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [9600], id: 0}, function() {
      console.log("increaseTime 9600");
    });

    const auctionBidToken = await barToken.balanceOf(auctionAddr);
    assert.equal(auctionBidToken, 20, "auctionBidToken error");
    const auctionAskToken = await fooToken.balanceOf(auctionAddr);
    assert.equal(auctionAskToken, 200000, "auctionAskToken error");

    const auctionEthBeforeSettle = await web3.eth.getBalance(auctionAddr);
    console.log("auctionEthBeforeSettle ", auctionEthBeforeSettle);
    const oedaxEthBeforeSettle = await web3.eth.getBalance(oedax.address);
    console.log("oedaxEthBeforeSettle ", oedaxEthBeforeSettle);

    // ###########################settle#########################
    // ###########################settle#########################
    await auctionInstance.methods.settle().send({
      from: settler, gas: 150000
    });

    const bidderFooTokenAfter = await fooToken.balanceOf(bidder);
    console.log("bidderFooTokenAfter: " + bidderFooTokenAfter);
    assert.equal(bidderFooTokenAfter, 99975, "bidderFooTokenAfter error");
    const bidderBarTokenAfter = await barToken.balanceOf(bidder);
    console.log("bidderBarTokenAfter: " + bidderBarTokenAfter);
    assert.equal(bidderBarTokenAfter, 0, "bidderBarTokenAfter error");

    await auctionInstance.methods.settle().send({
      from: settler, gas: 150000
    });

    const bidder1FooTokenAfter = await fooToken.balanceOf(bidder1);
    console.log("bidder1FooTokenAfter: " + bidder1FooTokenAfter);
    assert.equal(bidder1FooTokenAfter, 99975, "bidder1FooTokenAfter error");
    const bidder1BarTokenAfter = await barToken.balanceOf(bidder1);
    console.log("bidder1BarTokenAfter: " + bidder1BarTokenAfter);
    assert.equal(bidder1BarTokenAfter, 0, "bidder1BarTokenAfter error");

    await auctionInstance.methods.settle().send({
      from: settler, gas: 150000
    });

    const askerFooTokenAfter = await fooToken.balanceOf(asker);
    console.log("askerFooTokenAfter: " + askerFooTokenAfter);
    assert.equal(askerFooTokenAfter, 5, "askerFooTokenAfter error");
    const askerBarTokenAfter = await barToken.balanceOf(asker);
    console.log("askerBarTokenAfter: " + askerBarTokenAfter);
    assert.equal(askerBarTokenAfter, 10, "askerBarTokenAfter error");

    await auctionInstance.methods.settle().send({
      from: settler, gas: 150000
    });

    const asker1FooTokenAfter = await fooToken.balanceOf(asker1);
    console.log("asker1FooTokenAfter: " + asker1FooTokenAfter);
    assert.equal(asker1FooTokenAfter, 5, "asker1FooTokenAfter error");
    const asker1BarTokenAfter = await barToken.balanceOf(asker1);
    console.log("asker1BarTokenAfter: " + asker1BarTokenAfter);
    assert.equal(asker1BarTokenAfter, 10, "asker1BarTokenAfter error");

    await auctionInstance.methods.settle().send({
      from: settler, gas: 300000
    });

    const auctionEthAfterSettle = await web3.eth.getBalance(auctionAddr);
    console.log("auctionEthAfterSettle " + auctionEthAfterSettle);
    const oedaxEthAfterSettle = await web3.eth.getBalance(oedax.address);
    console.log("oedaxEthAfterSettle " + oedaxEthAfterSettle);

    const auctionBidTokenAfter = await barToken.balanceOf(auctionAddr);
    console.log("auctionBidTokenAfter: " + auctionBidTokenAfter);
    assert.equal(auctionBidTokenAfter, 0, "auctionBidTokenAfter error");
    const auctionAskTokenAfter = await fooToken.balanceOf(auctionAddr);
    console.log("auctionAskTokenAfter: " + auctionAskTokenAfter);
    assert.equal(auctionAskTokenAfter, 0, "auctionAskTokenAfter error");

    console.log();
    console.log("askerFooTokenBefore: " + askerFooTokenBefore);
    console.log("askerBarTokenBefore: " + askerBarTokenBefore);
    console.log("asker1FooTokenBefore: " + asker1FooTokenBefore);
    console.log("asker1BarTokenBefore: " + asker1BarTokenBefore);

    console.log("bidderFooTokenBefore: " + bidderFooTokenBefore);
    console.log("bidderBarTokenBefore: " + bidder1BarTokenBefore);
    console.log("bidder1FooTokenBefore: " + bidder1FooTokenBefore);
    console.log("bidder1BarTokenBefore: " + bidderBarTokenBefore);

    console.log("recipientFooTokenBefore: " + recipientFooTokenBefore);
    console.log("recipientBarTokenBefore: " + recipientBarTokenBefore);
    console.log();

    const recipientFooTokenAfter = await fooToken.balanceOf(recipient);
    console.log("recipientFooTokenAfter: " + recipientFooTokenAfter);
    assert.equal(recipientFooTokenAfter, 20, "recipientFooTokenAfter error");
    const recipientBarTokenAfter = await barToken.balanceOf(recipient);
    console.log("recipientBarTokenAfter: " + recipientBarTokenAfter);
    assert.equal(recipientBarTokenAfter, 0, "recipientBarTokenAfter error");
  });

});