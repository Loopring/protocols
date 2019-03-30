const LrcToken = artifacts.require("NewLRCToken");

contract("NewLRCToken", async (accounts) => {
  let lrcToken;

  const numberToBN = (num) => {
    const numHex = "0x" + num.toString(16);
    return web3.utils.toBN(numHex);
  };

  before(async () => {
    lrcToken = await LrcToken.deployed();
  });

  it("should be able to get name, decimals and totalSupply", async () => {
    const name = await lrcToken.name();
    const symbol = await lrcToken.symbol();
    const decimals = await lrcToken.decimals();
    const totalSupply = await lrcToken.totalSupply();

    // console.log("web3 version:", web3.version);
    // console.log("totalSupply:", totalSupply);
    // console.log("bn:", web3.utils.toBN("1395076054523857892274603100"));

    assert.equal("LoopringCoin V2", name, "name not match");
    assert.equal("LRC", symbol, "symbol not match");
    assert.equal(18, decimals.toNumber(), "decimals not match");
    assert(web3.utils.toBN("1395076054523857892274603100").eq(totalSupply), "totalSupply not match");
  });

  it("an address should be able to query its balance", async () => {
    const deployer = accounts[0];
    const balance0 = await lrcToken.balanceOf(deployer);
    assert(web3.utils.toBN("1395076054523857892274603100").eq(balance0), "initial balance not match");
  });

  it("an address should be able to transfer token to another address", async () => {
    const from = accounts[0];
    const receiver = accounts[1];
    const banlanceBeforeBN = await lrcToken.balanceOf(receiver);
    const transferAmountBN = numberToBN(100e18);
    await lrcToken.transfer(receiver, transferAmountBN, {from: from});
    const balanceAfterBN = await lrcToken.balanceOf(receiver);
    assert(transferAmountBN.eq(balanceAfterBN.sub(banlanceBeforeBN)), "transfer amount not match");
  });

  it("an address should be able to burn its LRC token", async () => {
    const from = accounts[0];
    const balanceBeforeBN = await lrcToken.balanceOf(from);
    const burnAmountBN = numberToBN(10000e18);
    await lrcToken.burn(burnAmountBN, {from: from});
    const balanceAfterBN = await lrcToken.balanceOf(from);
    assert((balanceBeforeBN.sub(balanceAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
  });

  it("totalSupply should be decrease when an address burn its LRC token", async () => {
    const from = accounts[0];
    const totalSupplyBeforeBN = await lrcToken.totalSupply();
    const burnAmountBN = numberToBN(10000e18);
    await lrcToken.burn(burnAmountBN, {from: from});
    const totalSupplyAfterBN = await lrcToken.totalSupply();
    assert((totalSupplyBeforeBN.sub(totalSupplyAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
  });

  it("transfer LRC to 0x0 address will equivalent to burn its LRC token", async () => {
    const from = accounts[0];
    const zeroAddress = "0x" + "0".repeat(40);
    const balanceBeforeBN = await lrcToken.balanceOf(from);
    const totalSupplyBeforeBN = await lrcToken.totalSupply();
    const burnAmountBN = numberToBN(10000e18);
    await lrcToken.transfer(zeroAddress, burnAmountBN, {from: from});
    const totalSupplyAfterBN = await lrcToken.totalSupply();
    const balanceAfterBN = await lrcToken.balanceOf(from);
    assert((totalSupplyBeforeBN.sub(totalSupplyAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
    const balanceOfZeroAddressBN = await lrcToken.balanceOf(zeroAddress);
    assert(web3.utils.toBN(0).eq(balanceOfZeroAddressBN), "zeroAddress balance not equal to 0");
  });

  it("an address should be able to approve another address", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const allowanceBeforeBN = await lrcToken.allowance(owner, spender);
    const approveAmountBN = numberToBN(500e18);
    await lrcToken.approve(spender, approveAmountBN, {from: owner});
    const allowanceAfterBN = await lrcToken.allowance(owner, spender);
    assert(allowanceAfterBN.sub(allowanceBeforeBN).eq(approveAmountBN), "approve amount not match");
  });

  it("address A should be able to transfer LRC token from address B if A has been approved by B", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const receiver = accounts[3];
    const ownerBalanceBeforeBN = await lrcToken.balanceOf(owner);
    const receiverBalanceBeforeBN = await lrcToken.balanceOf(receiver);
    const approveAmountBN = numberToBN(500e18);
    await lrcToken.approve(spender, approveAmountBN, {from: owner});
    await lrcToken.transferFrom(owner, receiver, approveAmountBN, {from: spender});
    const ownerBalanceAfterBN = await lrcToken.balanceOf(owner);
    const receiverBalanceAfterBN = await lrcToken.balanceOf(receiver);
    assert(ownerBalanceBeforeBN.sub(ownerBalanceAfterBN).eq(approveAmountBN), "transfer from amount not match");
    assert(receiverBalanceAfterBN.sub(receiverBalanceBeforeBN).eq(approveAmountBN), "receiver balance not match with transfer amount");
  });

  it("address A should be able to burn LRC token of address B if has been approved by B", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const balanceBeforeBN = await lrcToken.balanceOf(owner);
    const totalSupplyBeforeBN = await lrcToken.totalSupply();
    const approveAmountBN = numberToBN(500e18);
    await lrcToken.approve(spender, approveAmountBN, {from: owner});
    await lrcToken.burnFrom(owner, approveAmountBN, {from: spender});
    const balanceAfterBN = await lrcToken.balanceOf(owner);
    const totalSupplyAfterBN = await lrcToken.totalSupply();
    assert(balanceBeforeBN.sub(balanceAfterBN).eq(approveAmountBN), "burn from amount not match");
    assert(totalSupplyBeforeBN.sub(totalSupplyAfterBN).eq(approveAmountBN), "burn from amount not match");
  });

  it("transferFrom LRC to 0x0 address will equivalent to burn owner's LRC token", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const zeroAddress = "0x" + "0".repeat(40);
    const balanceBeforeBN = await lrcToken.balanceOf(owner);
    const totalSupplyBeforeBN = await lrcToken.totalSupply();
    const approveAmountBN = numberToBN(500e18);
    await lrcToken.approve(spender, approveAmountBN, {from: owner});
    await lrcToken.transferFrom(owner, zeroAddress, approveAmountBN, {from: spender});
    const balanceAfterBN = await lrcToken.balanceOf(owner);
    const totalSupplyAfterBN = await lrcToken.totalSupply();
    assert(balanceBeforeBN.sub(balanceAfterBN).eq(approveAmountBN), "burn from amount not match");
    assert(totalSupplyBeforeBN.sub(totalSupplyAfterBN).eq(approveAmountBN), "burn from amount not match");

    const balanceOfZeroAddressBN = await lrcToken.balanceOf(zeroAddress);
    assert(web3.utils.toBN(0).eq(balanceOfZeroAddressBN), "zeroAddress balance not equal to 0");
  });

});
