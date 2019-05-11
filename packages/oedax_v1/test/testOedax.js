const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");
const Auction = artifacts.require("Auction");

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
      numToBN(60),  // T1: 60 seconds
      numToBN(120), // T2: 120 seconds.
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
    // console.log("auctionAddr:", auctionAddr);
    const auctionInstance = new web3.eth.Contract(Auction.abi, auctionAddr);

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
        gas: 6000000
      }
    );
    const blockAfter2 = await web3.eth.getBlockNumber();
    const bidEvent = await auctionInstance.getPastEvents(
      "Bid",
      {
        fromBlock: blockBefore2,
        toBlock: blockAfter2
      }
    );

    // console.log("bidEvent:", bidEvent);
    const bidInEvent = bidEvent[0].returnValues.user;
    const accepted = bidEvent[0].returnValues.accepted;
    assert.equal(bidder, bidInEvent, "bid address not correct");
    assert.equal(numToBN(100e18), accepted);

  });

});
