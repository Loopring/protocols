const ERC820Registry = artifacts.require("./ERC820Registry.sol")
const NewLRCToken = artifacts.require("./NewLRCToken.sol")

contract("NewLRCToken", (accounts) => {
  // console.log("accounts:", accounts);

  const owner = accounts[0];
  const newLrcToken = NewLRCToken.at(NewLRCToken.address);

  describe("erc20 functionalities:", () => {
    it("owner's initial token balance should be equal to totalsupply", async () => {
      const initialBalance = await newLrcToken.balanceOf(owner);
      const totalSupply = await newLrcToken.totalSupply();

      assert.equal(initialBalance.toNumber(), totalSupply.toNumber(), "intial amount not equal to totalsupply");
    });

    it("should be able to transfer tokens between addresses", async () => {
      const user = accounts[1];
      const amount = 100e18;
      await newLrcToken.transfer(user, amount, {from: owner});
      const userBalance = await newLrcToken.balanceOf(user);
      assert.equal(userBalance.toNumber(), amount, "transfer token amount error");
    });

    it("decimal should be 18", async () => {
      const decimal = await newLrcToken.decimals();
      assert.equal(decimal.toNumber(), 18, "decimal isn't 18");
    });

    it("approve and transferFrom", async () => {
      const spender = accounts[1];
      const receiver = accounts[2];
      const amount = 500e18;
      await newLrcToken.approve(spender, amount, {from: owner});
      const allowanceBefore = await newLrcToken.allowance(owner, spender);
      assert.equal(allowanceBefore.toNumber(), amount, "approve token amount error");

      const transferFromAmount = 250e18;
      const balanceOfOwnerBefore = await newLrcToken.balanceOf(owner);
      await newLrcToken.transferFrom(owner, receiver, transferFromAmount, {from: spender});
      const balanceOfReceiver = await newLrcToken.balanceOf(receiver);
      const balanceOfOwnerAfter = await newLrcToken.balanceOf(owner);
      const totalSupply = await newLrcToken.totalSupply();
      assert.equal(transferFromAmount, balanceOfReceiver.toNumber(), "the balance of receiver error after transferFrom");
      assert.equal(balanceOfOwnerAfter.toNumber(), balanceOfOwnerBefore.toNumber()-transferFromAmount, "the balance of owner error after transferFrom");
      const allowanceAfter = await newLrcToken.allowance(owner, spender);
      assert.equal(allowanceAfter.toNumber(), allowanceBefore.toNumber()-transferFromAmount, "the allowance error after transferFrom");

    });

  });

  describe("erc777 functionalities:", () => {

  });

});
