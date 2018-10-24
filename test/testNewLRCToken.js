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

      // console.log(userBalance);
      assert.equal(userBalance.toNumber(), amount, "transfer token amount error");
    });

  });

  describe("erc777 functionalities:", () => {

  });

});
