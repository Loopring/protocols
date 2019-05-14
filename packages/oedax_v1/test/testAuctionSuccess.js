const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");
const Auction = artifacts.require("Auction");

const auctionABI = '[{"constant":false,"inputs":[],"name":"settle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"bid","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getStatus","outputs":[{"name":"isBounded","type":"bool"},{"name":"timeRemaining","type":"uint256"},{"name":"actualPrice","type":"uint256"},{"name":"askPrice","type":"uint256"},{"name":"bidPrice","type":"uint256"},{"name":"askAllowed","type":"uint256"},{"name":"bidAllowed","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"users","type":"address[]"}],"name":"withdrawFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"ask","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"askAmount","type":"int256"},{"indexed":false,"name":"bidAmount","type":"int256"}],"name":"Trade","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]';

contract("Oedax-Auction-Success", async(accounts) => {
  const deployer = accounts[0];
  const feeRecipient = accounts[1];
  const settler = accounts[2];

  const asker = accounts[5];
  const bidder = accounts[6];

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

  it("should excute auction", async function() {

    console.log("deployer is:     ", deployer);
    console.log("feeRecipient is: ", feeRecipient);
    console.log("asker is:        ", asker);
    console.log("bidder is:       ", bidder);
    console.log("oedax addr:      ", oedax.address);
    console.log("settler is:      ", settler);
    console.log();
    console.log("ask token is:    ", fooToken.address);
    console.log("bid token is:    ", barToken.address);    

    // update oedax
    //await oedax.updateSettings(feeRecipient, curve.address, 5, 20, 1, 300, 15, 25, 35, 1);
    //await oedax.updateSettings(feeRecipient, curve.address, 5, 20, 1, 300, 0, 0, 0, 1);
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
                              numToBN(P), numToBN(S), numToBN(M), numToBN(T1), numToBN(T2), {from: deployer,value: 1e18});
    const blockAfter = await web3.eth.getBlockNumber();

    const auctionCreationEvent = await oedax.getPastEvents("AuctionCreated", {fromBlock: blockBefore, toBlock: blockAfter});

    const blockBefore1 = await web3.eth.getBlockNumber();
    const previousTimestamp = (await web3.eth.getBlock(blockBefore1)).timestamp;

    const auctionAddr = auctionCreationEvent[0].returnValues.auctionAddr;
    console.log("auctionAddr is: ", auctionAddr);

    const auctionInstance = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr);

    await fooToken.setBalance(asker, numToBN(100000));
    await barToken.setBalance(bidder, numToBN(10));

    const askerFooTokenBefore = await fooToken.balanceOf(asker);
    assert.equal(askerFooTokenBefore, 100000, "askerFooTokenBefore error");
    const askerBarTokenBefore = await barToken.balanceOf(asker);
    assert.equal(askerBarTokenBefore, 0, "askerBarTokenBefore error");

    const bidderFooTokenBefore = await fooToken.balanceOf(bidder);
    assert.equal(bidderFooTokenBefore, 0, "bidderFooTokenBefore error");
    const bidderBarTokenBefore = await barToken.balanceOf(bidder);
    assert.equal(bidderBarTokenBefore, 10, "bidderBarTokenBefore error");

    const recipientFooTokenBefore = await fooToken.balanceOf(recipient);
    assert.equal(recipientFooTokenBefore, 0, "recipientFooTokenBefore error");
    const recipientBarTokenBefore = await barToken.balanceOf(recipient);
    assert.equal(recipientBarTokenBefore, 0, "recipientBarTokenBefore error");
    const recipientEthBeforeSettle = await web3.eth.getBalance(recipient);

    const settlerFooTokenBefore = await fooToken.balanceOf(settler);
    assert.equal(settlerFooTokenBefore, 0, "settlerFooTokenBefore error");
    const settlerBarTokenBefore = await barToken.balanceOf(settler);
    assert.equal(settlerBarTokenBefore, 0, "settlerBarTokenBefore error");
    const settlerEthBeforeSettle = await web3.eth.getBalance(recipient);

    await fooToken.approve(oedax.address, numToBN(100000), {
        from: asker
    });

    await barToken.approve(oedax.address, numToBN(1000000000), {
      from: bidder
    });

    // bid
    await auctionInstance.methods.bid(numToBN(10).toString(10)).send({
      from: bidder, gas: 1000000
    });

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [20], id: 0}, function() {console.log("increaseTime 20");});

    // ask
    await auctionInstance.methods.ask(numToBN(100000).toString(10)).send({
      from: asker, gas: 1000000
    });


    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [10800], id: 0}, function() {console.log("increaseTime 10800")});

    const auctionBidTokenBefore = await barToken.balanceOf(auctionAddr);
    const auctionAskTokenBefore = await fooToken.balanceOf(auctionAddr);

    const auctionEthBeforeSettle = await web3.eth.getBalance(auctionAddr);
    const oedaxEthBeforeSettle = await web3.eth.getBalance(oedax.address);

    // ###########################settle#########################
    // ###########################settle#########################
    await auctionInstance.methods.settle().send({
      from: settler, gas: 6000000
    });
    
    console.log();
    console.log("auctionBidTokenBefore: " + auctionBidTokenBefore);
    console.log("auctionAskTokenBefore: " + auctionAskTokenBefore);
    console.log("auctionEthBeforeSettle ", auctionEthBeforeSettle);
    const auctionBidTokenAfter = await barToken.balanceOf(auctionAddr);
    console.log("auctionBidTokenAfter: " + auctionBidTokenAfter);
    const auctionAskTokenAfter = await fooToken.balanceOf(auctionAddr);
    console.log("auctionAskTokenAfter: " + auctionAskTokenAfter);
    const auctionEthAfterSettle = await web3.eth.getBalance(auctionAddr);
    console.log("auctionEthAfterSettle ", auctionEthAfterSettle);
    const oedaxEthAfterSettle = await web3.eth.getBalance(oedax.address);
    console.log("oedaxEthAfterSettle ", oedaxEthAfterSettle);

    console.log();
    console.log("askerFooTokenBefore: " + askerFooTokenBefore);
    assert.equal(askerFooTokenBefore, 100000, "askerFooTokenBefore error");
    console.log("askerBarTokenBefore: " + askerBarTokenBefore);
    assert.equal(askerBarTokenBefore, 0, "askerBarTokenBefore error");
    const askerFooTokenAfter = await fooToken.balanceOf(asker);
    console.log("askerFooTokenAfter: " + askerFooTokenAfter);
    assert.equal(askerFooTokenAfter, 5, "askerFooTokenAfter error");
    const askerBarTokenAfter = await barToken.balanceOf(asker);
    assert.equal(askerBarTokenAfter, 10, "askerBarTokenAfter error");
    console.log("askerBarTokenAfter: " + askerBarTokenAfter);
    console.log();

    console.log("bidderFooTokenBefore: " + bidderFooTokenBefore);
    assert.equal(bidderFooTokenBefore, 0, "bidderFooTokenBefore error");
    console.log("bidderBarTokenBefore: " + bidderBarTokenBefore);
    assert.equal(bidderBarTokenBefore, 10, "bidderBarTokenBefore error");
    const bidderFooTokenAfter = await fooToken.balanceOf(bidder);
    assert.equal(bidderFooTokenAfter, 99975, "bidderFooTokenAfter error");
    console.log("bidderFooTokenAfter: " + bidderFooTokenAfter);
    const bidderBarTokenAfter = await barToken.balanceOf(bidder);
    assert.equal(bidderBarTokenAfter, 0, "bidderBarTokenAfter error");
    console.log("bidderBarTokenAfter: " + bidderBarTokenAfter);
    console.log();

    console.log("recipientFooTokenBefore: " + recipientFooTokenBefore);
    console.log("recipientBarTokenBefore: " + recipientBarTokenBefore);
    console.log("recipientEthBeforeSettle ", recipientEthBeforeSettle);
    const recipientFooTokenAfter = await fooToken.balanceOf(recipient);
    assert.equal(recipientFooTokenAfter, 10, "recipientFooTokenAfter error");
    console.log("recipientFooTokenAfter: " + recipientFooTokenAfter);
    const recipientBarTokenAfter = await barToken.balanceOf(recipient);
    console.log("recipientBarTokenAfter: " + recipientBarTokenAfter);
    const recipientEthAfterSettle = await web3.eth.getBalance(recipient);
    console.log("recipientEthAfterSettle ", recipientEthAfterSettle);
    console.log();

    console.log("settlerFooTokenBefore: " + settlerFooTokenBefore);
    console.log("settlerBarTokenBefore: " + settlerBarTokenBefore);
    console.log("settlerEthBeforeSettle ", settlerEthBeforeSettle);
    const settlerFooTokenAfter = await fooToken.balanceOf(settler);
    assert.equal(settlerFooTokenAfter, 10, "settlerFooTokenAfter error");
    console.log("settlerFooTokenAfter: " + settlerFooTokenAfter);
    const settlerBarTokenAfter = await barToken.balanceOf(settler);
    console.log("settlerBarTokenAfter: " + settlerBarTokenAfter);
    const settlerEthAfterSettle = await web3.eth.getBalance(settler);
    console.log("settlerEthAfterSettle ", settlerEthAfterSettle);
    console.log();

  });

});