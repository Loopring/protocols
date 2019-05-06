const Curve = artifacts.require("Curve");
const Oedax = artifacts.require("Oedax");

contract("Curve", async (accounts) => {
  let curve;
  let oedax;

  before(async () => {
    curve = await Curve.deployed();
    oedax = await Oedax.deployed();
  });

  it("should update settings", async () => {
    await oedax.updateSettings(accounts[0], curve.address, 5, 100, 200, 15, 25, 1);
    const feeRecipient = await oedax.feeRecipient();
    const curveAddress = await oedax.curveAddress(); 
    const settleGracePeriod = await oedax.settleGracePeriod();    
    const minDuration = await oedax.minDuration();
    const maxDuration = await oedax.maxDuration();
    const protocolFeeBips = await oedax.protocolFeeBips();
    const takerFeeBips = await oedax.takerFeeBips();
    const creatorEtherStake = await oedax.creatorEtherStake();

    assert.equal(feeRecipient, accounts[0], "feeRecipient error");
    assert.equal(curveAddress, curve.address,  "curveAddress error");
    assert.equal(settleGracePeriod, 5*60,  "settleGracePeriod error");
    assert.equal(minDuration, 100*60,  "minDuration error");
    assert.equal(maxDuration, 200*60,  "maxDuration error");
    assert.equal(protocolFeeBips, 15,  "protocolFeeBips error");
    assert.equal(takerFeeBips, 25,  "takerFeeBips error");
    assert.equal(creatorEtherStake, 1000000000000000000,  "creatorEtherStake error");

  });

});