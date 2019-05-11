const BatchTransfer = artifacts.require("./BatchTransfer");
const LrcToken = artifacts.require("NewLRCToken");

contract("BatchTransfer", async (accounts) => {
  let lrcToken;
  let batchTransfer;
  const owner = accounts[0];

  before(async () => {
    lrcToken = await LrcToken.deployed();
    batchTransfer = await BatchTransfer.deployed();

    // transfer token to contract:
    const toContractAmount = web3.utils.toBN(10000e18.toString(16));
    await lrcToken.transfer(batchTransfer.address, toContractAmount, {from: owner});
  });

  it("owner should be able to set lrc token address", async() => {
    const zeroAddress = "0x" + "0".repeat(40);
    const lrcAddressBefore = await batchTransfer.lrcAddress();
    assert.equal(zeroAddress, lrcAddressBefore, "lrcAddress initial value not zero address");
    await batchTransfer.setLrcAddress(lrcToken.address, {from: owner});
    const lrcAddressAfter = await batchTransfer.lrcAddress();
    assert.equal(lrcToken.address, lrcAddressAfter, "lrcAddress not match");
  });

  it("owner do batch transfer via LrcToken's batchTransfer function", async() => {
    const users = [];
    const amounts = [];

    const amountHex = 10e18.toString(16);
    const amount = web3.utils.toBN(amountHex);
    for (let i = 0; i < 200; i++) {
      const newAccount = web3.eth.accounts.create().address;
      // console.log("newAccount:", newAccount);

      users.push(newAccount);
      amounts.push(amount);
    }

    const tx = await lrcToken.batchTransfer(users, amounts, {from: owner});
    console.log("\x1b[46m%s\x1b[0m", "gas used by token's batchTransfer: " + tx.receipt.gasUsed);

    const balaceX = await lrcToken.balanceOf(users[10]);
    assert(balaceX.eq(amount), "transfer amount not match");
  });

  it("owner should be able to do batch token transfer", async() => {
    const users = [];
    const amounts = [];

    const amountHex = 10e18.toString(16);
    const amount = web3.utils.toBN(amountHex);
    for (let i = 0; i < 200; i++) {
      const newAccount = web3.eth.accounts.create().address;
      // console.log("newAccount:", newAccount);

      users.push(newAccount);
      amounts.push(amount);
    }

    const tx = await batchTransfer.doBatchTransfer(users, amounts, {from: owner});
    console.log("\x1b[46m%s\x1b[0m", "gas used: " + tx.receipt.gasUsed);

    const balaceX = await lrcToken.balanceOf(users[10]);
    assert(balaceX.eq(amount), "transfer amount not match");
  });

  it("owner should be able to withdraw token in BatchTransfer contract", async() => {
    const balanceBefore = await lrcToken.balanceOf(owner);
    const amount = web3.utils.toBN(10e18.toString(16));
    await batchTransfer.withdrawToken(lrcToken.address, amount, {from: owner});
    const balanceBN = await lrcToken.balanceOf(owner);
    assert(balanceBN.sub(balanceBefore).eq(amount), "lrc withdrawn amount not match");
  });

  it("any other user should not be able to set lrc token address", async() => {
    try {
      await batchTransfer.setLrcAddress(lrcToken.address, {from: accounts[1]});
      assert(false);
    } catch (err) {
      assert(true);
    }
  });

  it("any other user should not be able to do batch token transfer", async() => {
    const users = [accounts[5]];
    const amounts = [web3.utils.toBN(10e18.toString(16))];
    try {
      const tx = await batchTransfer.doBatchTransfer(users, amounts, {from: accounts[1]});
      assert(false);
    } catch (err) {
      assert(true);
    }

  });

  it("any other user should not be able to withdraw token in BatchTransfer contract", async() => {
    try {
      const amount = web3.utils.toBN(10e18.toString(16));
      await batchTransfer.withdrawToken(lrcToken.address, amount, {from: accounts[1]});
      assert(false);
    } catch (err) {
      assert(true);
    }

  });

});
