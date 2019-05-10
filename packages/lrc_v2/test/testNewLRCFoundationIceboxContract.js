const NewLRCFoundationIceboxContract = artifacts.require("NewLRCFoundationIceboxContract");
const LrcToken = artifacts.require("NewLRCToken");

contract("NewLRCLongTermHoldingContract", async (accounts) => {
  let lrcToken;
  let iceboxContract;
  const owner = accounts[0];

  before(async () => {
    lrcToken = await LrcToken.deployed();
    iceboxContract = await NewLRCFoundationIceboxContract.deployed();
  });

  const numberToBN = (num) => {
    const numHex = "0x" + num.toString(16);
    return web3.utils.toBN(numHex);
  };

  it("owner shoule be able to start Lrc locking program", async () => {
    const lockNum = web3.utils.toBN("279015212261928946137301500", 10);
    await lrcToken.transfer(
      iceboxContract.address,
      numberToBN(lockNum),
      {from: owner}
    );

    const startTime = 1504076215;
    await iceboxContract.start(numberToBN(startTime), {from: owner});
    const lrcUnlockPerMonth = await iceboxContract.lrcUnlockPerMonth();
    const startTimeInContract = await iceboxContract.startTime();
    assert.equal("11625633844247039422387562", lrcUnlockPerMonth.toString(10), "lrcUnlockPerMonth not correct.");
    assert.equal(startTime, startTimeInContract.toString(10), "startTimeInContract not correct.");
  });

  it("any non-owner address shoule not be able to withdraw lrc", async () => {
    const user = accounts[1];
    try {
      await iceboxContract.withdraw({from: user});
    } catch (err) {
      assert(err.message.includes("NOT_OWNER"), "not failed as expected.");
    }
  });

  it("should be able to transfer ownership", async () => {
    const ownerInContract = await iceboxContract.owner();
    assert.equal(ownerInContract, owner, "owner not correct.");

    const newOwner = accounts[2];
    await iceboxContract.transferOwnership(newOwner, {from: owner});
    const ownerInContract2 = await iceboxContract.owner();
    assert.equal(ownerInContract2, owner, "owner not correct.");
    const pendingOwner = await iceboxContract.pendingOwner();
    assert.equal(pendingOwner, newOwner, "pendingowner not correct.");

    await iceboxContract.claimOwnership({from: newOwner});
    const ownerInContract3 = await iceboxContract.owner();
    assert.equal(ownerInContract3, newOwner, "owner not correct.");
    const pendingOwner2 = await iceboxContract.pendingOwner();
    assert.equal(pendingOwner2, "0x" + "00".repeat(20), "pendingowner not correct.");

  });

});
