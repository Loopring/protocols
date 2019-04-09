const LongTermContract = artifacts.require("LRCLongTermHoldingContract_v2");
const LrcToken = artifacts.require("LRC_v2");

contract("LRCLongTermHoldingContract_v2", async (accounts) => {
  let lrcToken;
  let longTermContract;
  const owner = accounts[0];

  before(async () => {
    lrcToken = await LrcToken.deployed();
    longTermContract = await LongTermContract.deployed();
  });

  const numberToBN = (num) => {
    const numHex = "0x" + num.toString(16);
    return web3.utils.toBN(numHex);
  };

  it("no one should be able to deposit lrc again", async () => {
    const user = accounts[1];
    await lrcToken.transfer(user, numberToBN(1e25), {from: owner});
    await lrcToken.approve(longTermContract.address, numberToBN(1e23), {from: user});
    try {
      await longTermContract.depositLRC({from: user});
    } catch (err) {
      // console.log("err:", err.message);
      assert(err.message.includes("beyond deposit time period"), "not failed as expected.");
    }
  });

  it("should be able to setup deposit records by owner ", async () => {
    const users = [accounts[2], accounts[3], accounts[4]];
    const amounts = [numberToBN(10000e18), numberToBN(20000e18), numberToBN(30000e18)];
    const ts = [1504076283, 1504076293, 1504076373];

    try {
      await longTermContract.batchAddDepositRecordsByOwner(users, amounts, ts, {from: accounts[1]});
    } catch (err) {
      assert(err.message.includes("not owner"), "non-owner user can setup deposit record.");
    }

    await longTermContract.batchAddDepositRecordsByOwner(users, amounts, ts, {from: owner});

    const record2 = await longTermContract.records(accounts[2]);
    // console.log("record2:", record2);
    assert(record2.lrcAmount.eq(amounts[0]), "lrc deposit amount not match");
    assert.equal(record2.timestamp.toNumber(), ts[0], "timestamp not match");

  });

  it("should be able to withdrawl lrc partially", async () => {

  });

});
