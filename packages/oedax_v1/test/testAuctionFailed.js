const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");
const Auction = artifacts.require("Auction");

const auctionABI = '[{"constant":false,"inputs":[],"name":"settle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"bid","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getStatus","outputs":[{"name":"isBounded","type":"bool"},{"name":"timeRemaining","type":"uint256"},{"name":"actualPrice","type":"uint256"},{"name":"askPrice","type":"uint256"},{"name":"bidPrice","type":"uint256"},{"name":"askAllowed","type":"uint256"},{"name":"bidAllowed","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"users","type":"address[]"}],"name":"withdrawFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"ask","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"askAmount","type":"int256"},{"indexed":false,"name":"bidAmount","type":"int256"}],"name":"Trade","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]';

contract("Oedax-Auction-Failed", async(accounts) => {
  const deployer = accounts[0];
  const feeRecipient = accounts[1];
  const settler = accounts[2];
  const asker = accounts[5];
  const bidder = accounts[6];

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
    // update oedax
    await oedax.updateSettings(feeRecipient, curve.address, 5, 20, 1, 10, 15, 25, 35, 1);

    const minAskAmount = 100;
    const minBidAmount = 10;

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

    const auctionAddr = auctionCreationEvent[0].returnValues.auctionAddr;

    const auctionInstance = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr);

    await fooToken.setBalance(asker, numToBN(100000));
    await barToken.setBalance(bidder, numToBN(100000000));

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

    // ask
    await auctionInstance.methods.ask(numToBN(10000).toString(10)).send({
      from: asker, gas: 1000000
    });

    //some times past
    await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [125], id: 0}, function() {console.log("")});

    const auctionEthBeforeSettle = await web3.eth.getBalance(auctionAddr);
    //console.log("auctionEthBeforeSettle ", auctionEthBeforeSettle);
    const oedaxEthBeforeSettle = await web3.eth.getBalance(oedax.address);
    //console.log("oedaxEthBeforeSettle ", oedaxEthBeforeSettle);
    const feeRecipientEthBeforeSettle = await web3.eth.getBalance(feeRecipient);
    //console.log("feeRecipientEthBeforeSettle ", feeRecipientEthBeforeSettle);
    const settlerEthBeforeSettle = await web3.eth.getBalance(settler);
    //console.log("settlerEthBeforeSettle ", settlerEthBeforeSettle);
    
    // settle
    await auctionInstance.methods.settle().send({
      from: settler, gas: 6000000
    });
    const auctionEthAfterSettle = await web3.eth.getBalance(auctionAddr);
    assert.equal(auctionEthAfterSettle, 0, "auctionEthAfterSettle error!");
    const oedaxEthAfterSettle = await web3.eth.getBalance(oedax.address);
    const feeRecipientEthAfterSettle = await web3.eth.getBalance(feeRecipient);
    const settlerEthAfterSettle = await web3.eth.getBalance(settler);

    const auctionBidTokenAfter = await barToken.balanceOf(auctionAddr);
    assert.equal(auctionBidTokenAfter, 0,  "auctionBidTokenAfter error");
    const auctionAskTokenAfter = await fooToken.balanceOf(auctionAddr);
    assert.equal(auctionAskTokenAfter, 0,  "auctionAskTokenAfter error");
    const askerFooTokenAfter = await fooToken.balanceOf(asker);
    assert.equal(askerFooTokenAfter, 100000,  "askerFooTokenAfter error");
    const bidderBarTokenAfter = await barToken.balanceOf(bidder);
    assert.equal(bidderBarTokenAfter, 100000000,  "bidderBarTokenAfter error");
  });

});