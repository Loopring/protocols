const Curve = artifacts.require("Curve");

contract("Curve", async (accounts) => {
  let curve;

  const numberToBN = (num) => {
    const numHex = "0x" + num.toString(16);
    return web3.utils.toBN(numHex);
  };

  before(async () => {
    curve = await Curve.deployed();
  });

  it("should query curve info", async () => {
    const paramC = await curve.getParamC(10, 10, 100);
    assert.equal(paramC, 89, "calc paramC error");
  });

});
