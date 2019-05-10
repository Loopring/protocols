const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const FOO = artifacts.require("FOO");
const BAR = artifacts.require("BAR");

contract("Oedax", async (accounts) => {
  const deployer = accounts[0];

contract("Oedax", async (accounts) => {
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
    return web3.utils.toBN(num.toString(10), 10);
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
      fooToken.address,
      barToken.address,
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
    // console.log("blockBefore:", blockBefore, "; blockAfter:", blockAfter);

    const auctionCreationEvent = await oedax.getPastEvents(
      "AuctionCreated",
      {
        fromBlock: blockBefore,
        toBlock: blockAfter
      }
    );
    // console.log("auctionCreationEvent:", auctionCreationEvent);

  });

});
