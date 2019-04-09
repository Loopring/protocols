const LrcToken = artifacts.require("LRC_v2");
const LRC = artifacts.require("LRC");

contract("LRC", async (accounts) => {
  let lrcProxy;
  let proxyInstance;

  const numberToBN = (num) => {
    const numHex = "0x" + num.toString(16);
    return web3.utils.toBN(numHex);
  };

  before(async () => {
    await LrcToken.deployed();
    lrcProxy = await new LRC(
      LrcToken.address,
      accounts[0],
      "0x0"
    );

    // console.log("LrcToken:", LrcToken.address);
    // console.log("lrcProxy:", lrcProxy.address);

    proxyInstance = await LrcToken.at(lrcProxy.address);
  });

  it("should be able to get name, decimals and totalSupply", async () => {
    const name = await proxyInstance.name();
    const symbol = await proxyInstance.symbol();
    const decimals = await proxyInstance.decimals();
    const totalSupply = await proxyInstance.totalSupply();

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
    const balance0 = await proxyInstance.balanceOf(deployer);
    assert(web3.utils.toBN("1395076054523857892274603100").eq(balance0), "initial balance not match");
  });

  it("an address should be able to transfer token to another address", async () => {
    const from = accounts[0];
    const receiver = accounts[1];
    const banlanceBeforeBN = await proxyInstance.balanceOf(receiver);
    const transferAmountBN = numberToBN(100e18);
    const blockNumber = await web3.eth.getBlockNumber();
    await proxyInstance.transfer(receiver, transferAmountBN, {from: from});
    const events = await proxyInstance.getPastEvents("Transfer", { fromBlock: blockNumber });
    // console.log("from:", from);
    //console.log("transfer events from:", events[0].args.from);
    const proxyTransferFrom = events[0].args.from;
    assert(from, proxyTransferFrom, "transfer from not equal");

    const balanceAfterBN = await proxyInstance.balanceOf(receiver);
    assert(transferAmountBN.eq(balanceAfterBN.sub(banlanceBeforeBN)), "transfer amount not match");
  });

  it("an address should be able to burn its LRC token", async () => {
    const from = accounts[0];
    const balanceBeforeBN = await proxyInstance.balanceOf(from);
    const burnAmountBN = numberToBN(10000e18);
    await proxyInstance.burn(burnAmountBN, {from: from});
    const balanceAfterBN = await proxyInstance.balanceOf(from);
    assert((balanceBeforeBN.sub(balanceAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
  });

  it("totalSupply should be decrease when an address burn its LRC token", async () => {
    const from = accounts[0];
    const totalSupplyBeforeBN = await proxyInstance.totalSupply();
    const burnAmountBN = numberToBN(10000e18);
    await proxyInstance.burn(burnAmountBN, {from: from});
    const totalSupplyAfterBN = await proxyInstance.totalSupply();
    assert((totalSupplyBeforeBN.sub(totalSupplyAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
  });

  it("transfer LRC to 0x0 address will equivalent to burn its LRC token", async () => {
    const from = accounts[0];
    const zeroAddress = "0x" + "0".repeat(40);
    const balanceBeforeBN = await proxyInstance.balanceOf(from);
    const totalSupplyBeforeBN = await proxyInstance.totalSupply();
    const burnAmountBN = numberToBN(10000e18);
    await proxyInstance.transfer(zeroAddress, burnAmountBN, {from: from});
    const totalSupplyAfterBN = await proxyInstance.totalSupply();
    const balanceAfterBN = await proxyInstance.balanceOf(from);
    assert((totalSupplyBeforeBN.sub(totalSupplyAfterBN)).eq(burnAmountBN), "burn amount not equal to balance decrease amount");
    const balanceOfZeroAddressBN = await proxyInstance.balanceOf(zeroAddress);
    assert(web3.utils.toBN(0).eq(balanceOfZeroAddressBN), "zeroAddress balance not equal to 0");
  });

  it("an address should be able to approve another address", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const allowanceBeforeBN = await proxyInstance.allowance(owner, spender);
    const approveAmountBN = numberToBN(500e18);
    await proxyInstance.approve(spender, approveAmountBN, {from: owner});
    const allowanceAfterBN = await proxyInstance.allowance(owner, spender);
    assert(allowanceAfterBN.sub(allowanceBeforeBN).eq(approveAmountBN), "approve amount not match");
  });

  it("address A should be able to transfer LRC token from address B if A has been approved by B", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const receiver = accounts[3];
    const ownerBalanceBeforeBN = await proxyInstance.balanceOf(owner);
    const receiverBalanceBeforeBN = await proxyInstance.balanceOf(receiver);
    const approveAmountBN = numberToBN(500e18);
    await proxyInstance.approve(spender, approveAmountBN, {from: owner});
    await proxyInstance.transferFrom(owner, receiver, approveAmountBN, {from: spender});
    const ownerBalanceAfterBN = await proxyInstance.balanceOf(owner);
    const receiverBalanceAfterBN = await proxyInstance.balanceOf(receiver);
    assert(ownerBalanceBeforeBN.sub(ownerBalanceAfterBN).eq(approveAmountBN), "transfer from amount not match");
    assert(receiverBalanceAfterBN.sub(receiverBalanceBeforeBN).eq(approveAmountBN), "receiver balance not match with transfer amount");
  });

  it("address A should be able to burn LRC token of address B if has been approved by B", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const balanceBeforeBN = await proxyInstance.balanceOf(owner);
    const totalSupplyBeforeBN = await proxyInstance.totalSupply();
    const approveAmountBN = numberToBN(500e18);
    await proxyInstance.approve(spender, approveAmountBN, {from: owner});
    await proxyInstance.burnFrom(owner, approveAmountBN, {from: spender});
    const balanceAfterBN = await proxyInstance.balanceOf(owner);
    const totalSupplyAfterBN = await proxyInstance.totalSupply();
    assert(balanceBeforeBN.sub(balanceAfterBN).eq(approveAmountBN), "burn from amount not match");
    assert(totalSupplyBeforeBN.sub(totalSupplyAfterBN).eq(approveAmountBN), "burn from amount not match");
  });

  it("transferFrom LRC to 0x0 address will equivalent to burn owner's LRC token", async () => {
    const owner = accounts[0];
    const spender = accounts[2];
    const zeroAddress = "0x" + "0".repeat(40);
    const balanceBeforeBN = await proxyInstance.balanceOf(owner);
    const totalSupplyBeforeBN = await proxyInstance.totalSupply();
    const approveAmountBN = numberToBN(500e18);
    await proxyInstance.approve(spender, approveAmountBN, {from: owner});
    await proxyInstance.transferFrom(owner, zeroAddress, approveAmountBN, {from: spender});
    const balanceAfterBN = await proxyInstance.balanceOf(owner);
    const totalSupplyAfterBN = await proxyInstance.totalSupply();
    assert(balanceBeforeBN.sub(balanceAfterBN).eq(approveAmountBN), "burn from amount not match");
    assert(totalSupplyBeforeBN.sub(totalSupplyAfterBN).eq(approveAmountBN), "burn from amount not match");

    const balanceOfZeroAddressBN = await proxyInstance.balanceOf(zeroAddress);
    assert(web3.utils.toBN(0).eq(balanceOfZeroAddressBN), "zeroAddress balance not equal to 0");
  });

});
