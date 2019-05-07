const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");
const LrcToken = artifacts.require("LRC");
const GtoToken = artifacts.require("GTO");

contract("Auction", async (accounts) => {
  let curve;
  let oedax;
  let lrcToken;
  let gtoToken;

  before(async () => {
    curve = await Curve.deployed();
    oedax = await Oedax.deployed();
    lrcToken = await LrcToken.deployed();
    gtoToken = await GtoToken.deployed();
  });

  it("should create an  auction", async () => {
    await oedax.updateSettings(accounts[0], curve.address, 5, 100, 200, 15, 25, 5);

    await oedax.setTokenRank(lrcToken.address, 100);

    await oedax.setTokenRank(gtoToken.address, 50);

    const creatorEtherStake = await oedax.creatorEtherStake();

    console.log(creatorEtherStake)

    balanceBefore = await web3.eth.getBalance(accounts[0])   
    console.log(balanceBefore)
    const auctionAddr = await oedax.createAuction(gtoToken.address, lrcToken.address, 50, 5, 10, 10000, {from: accounts[0], value: 15e+18});
    balanceAfter = await web3.eth.getBalance(accounts[0])   
    console.log(balanceAfter)
    console.log(auctionAddr);

  });

});