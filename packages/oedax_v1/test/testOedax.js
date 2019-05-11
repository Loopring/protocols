const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");

const auctionABI = '[{"constant":false,"inputs":[],"name":"settle","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"bid","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getStatus","outputs":[{"name":"isBounded","type":"bool"},{"name":"timeRemaining","type":"uint256"},{"name":"actualPrice","type":"uint256"},{"name":"askPrice","type":"uint256"},{"name":"bidPrice","type":"uint256"},{"name":"askAllowed","type":"uint256"},{"name":"bidAllowed","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"users","type":"address[]"}],"name":"withdrawFor","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"ask","outputs":[{"name":"accepted","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"user","type":"address"},{"indexed":false,"name":"askAmount","type":"int256"},{"indexed":false,"name":"bidAmount","type":"int256"}],"name":"Trade","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"}]';

contract("Oedax", async (accounts) => {
  const deployer = accounts[0];
  let curve;
  let oedax;
  let fooToken;
  let barToken;

  before(async () => {
    curve = await Curve.deployed();
    oedax = await Oedax.deployed();
    fooToken = await FOO.deployed();
    barToken = await BAR.deployed();
  });

  const numToBN = (num) => {
    return web3.utils.toBN("0x" + num.toString(16), 16);
  };

  it("should update settings", async () => {
    await oedax.updateSettings(accounts[0], curve.address, 5, 20, 1, 10, 15, 25, 35, 1);
    const feeRecipient = await oedax.feeRecipient();
    const curveAddress = await oedax.curveAddress();
    const settleGracePeriodBase = await oedax.settleGracePeriodBase();
    const settleGracePeriodPerUser = await oedax.settleGracePeriodPerUser();
    const minDuration = await oedax.minDuration();
    const maxDuration = await oedax.maxDuration();
    const protocolFeeBips = await oedax.protocolFeeBips();
    const ownerFeeBips = await oedax.ownerFeeBips();
    const takerFeeBips = await oedax.takerFeeBips();
    const creatorEtherStake = await oedax.creatorEtherStake();

    assert.equal(feeRecipient, accounts[0], "feeRecipient error");
    assert.equal(curveAddress, curve.address,  "curveAddress error");
    assert.equal(settleGracePeriodBase, 5*60,  "settleGracePeriodBase error");
    assert.equal(settleGracePeriodPerUser, 20,  "settleGracePeriodPerUser error");
    assert.equal(minDuration, 1*60,  "minDuration error");
    assert.equal(maxDuration, 10*60,  "maxDuration error");
    assert.equal(protocolFeeBips, 15,  "protocolFeeBips error");
    assert.equal(ownerFeeBips, 25,  "ownerFeeBips error");
    assert.equal(takerFeeBips, 35,  "takerFeeBips error");
    assert.equal(creatorEtherStake, 1e18,  "creatorEtherStake error");

  });

  it("should be able to create new Auction", async () => {
    const minAskAmount = 100e18;
    const minBidAmount = 10e18;
    const blockBefore = await web3.eth.getBlockNumber();

    await oedax.setTokenRank(fooToken.address, numToBN(10), {from: deployer});
    await oedax.setTokenRank(barToken.address, numToBN(100), {from: deployer});
    await oedax.createAuction(
      fooToken.address,  // askToken
      barToken.address,  // bidToken
      numToBN(minAskAmount),
      numToBN(minBidAmount),
      numToBN(10),
      numToBN(5),
      numToBN(2),
      numToBN(60),
      numToBN(120),
      {
        from: deployer,
        value: 1e18
      }
    );

    const blockAfter = await web3.eth.getBlockNumber();
    const auctionCreationEvent = await oedax.getPastEvents(
      "AuctionCreated",
      {
        fromBlock: blockBefore,
        toBlock: blockAfter
      }
    );
    // console.log("auctionCreationEvent:", auctionCreationEvent);

    const auctionAddr = auctionCreationEvent[0].returnValues.auctionAddr;
    console.log("auctionAddr:", auctionAddr);
    console.log("oedax addr:", oedax.address);
    const auctionInstance = new web3.eth.Contract(JSON.parse(auctionABI), auctionAddr);

    // console.log("auctionInstance:", auctionInstance);

    const asker =  accounts[5];
    const bidder = accounts[6];

    await fooToken.setBalance(asker, numToBN(1000e18));
    await barToken.setBalance(bidder, numToBN(10000e18));

    await fooToken.approve(oedax.address, numToBN(1000e18), {from: asker});
    await barToken.approve(oedax.address, numToBN(10000e18), {from: bidder});

    const blockBefore2 = await web3.eth.getBlockNumber();
    await auctionInstance.methods.bid(numToBN(100e18).toString(10)).send(
      {
        from: bidder,
        gas: 6700000
      }
    );
    const blockAfter2 = await web3.eth.getBlockNumber();

  });

});
