const ERC820Registry = artifacts.require("./ERC820Registry.sol")
const NewLRCToken = artifacts.require("./NewLRCToken.sol")

assertNumberEqualsWithPrecision = (n1, n2, desc, precision = 8) => {
  const numStr1 = (n1 / 1e18).toFixed(precision);
  const numStr2 = (n2 / 1e18).toFixed(precision);
  return assert.equal(Number(numStr1), Number(numStr2), desc);
}

contract("NewLRCToken", (accounts) => {

  const owner = accounts[0];
  const newLrcToken = NewLRCToken.at(NewLRCToken.address);

  describe("erc20 functionalities:", () => {
    it("TestCase1: owner's initial token balance should be equal to the totalsupply", async () => {
      const initialBalance = await newLrcToken.balanceOf(owner);
      const totalSupply = await newLrcToken.totalSupply();

      assert.equal(initialBalance.toNumber(), totalSupply.toNumber(), "initial amount doesn't equal to totalsupply");
    });

    it("TestCase2: should be able to transfer tokens between addresses", async () => {
      const receiver = accounts[1];
      const amount = 100e18;
      await newLrcToken.transfer(receiver, amount, {from: owner});
      const receiverBalance = await newLrcToken.balanceOf(receiver);
      assert.equal(receiverBalance.toNumber(), amount, "receiverBalance's token amount is wrong");
    });

    it("TestCase3: decimal should be 18", async () => {
      const decimal = await newLrcToken.decimals();
      assert.equal(decimal.toNumber(), 18, "the decimal isn't 18");
    });

    it("TestCase4: approve and transferFrom", async () => {
      const spender = accounts[1];
      const receiver = accounts[2];
      const amount = 500e18;
      await newLrcToken.approve(spender, amount, {from: owner});
      const allowanceBefore = await newLrcToken.allowance(owner, spender);
      assert.equal(allowanceBefore.toNumber(), amount, "the allowance is wrong");

      const transferFromAmount = 250e18;
      const balanceOfOwnerBefore = await newLrcToken.balanceOf(owner);
      await newLrcToken.transferFrom(owner, receiver, transferFromAmount, {from: spender});
      const balanceOfReceiver = await newLrcToken.balanceOf(receiver);
      const balanceOfOwnerAfter = await newLrcToken.balanceOf(owner);
      const totalSupply = await newLrcToken.totalSupply();
      assert.equal(transferFromAmount, balanceOfReceiver.toNumber(), "the balance of receiver is wrong after transferFrom");
      assert.equal(balanceOfOwnerAfter.toNumber(), balanceOfOwnerBefore.toNumber()-transferFromAmount, "the balance of owner is wrong after transferFrom");
      const allowanceAfter = await newLrcToken.allowance(owner, spender);
      assert.equal(allowanceAfter.toNumber(), allowanceBefore.toNumber()-transferFromAmount, "the allowance is wrong after transferFrom");

    });

    it("TestCase5: burn ", async () => {
      const burner = accounts[1];
      const balanceBefore = await newLrcToken.balanceOf(burner);
      const burnAmount = balanceBefore.toNumber() / 2;

      const totalSupplyBefore = await newLrcToken.totalSupply();
      await newLrcToken.burn(burnAmount, "", {from: burner});
      const balanceAfter = await newLrcToken.balanceOf(burner);
      const totalSupplyAfter = await newLrcToken.totalSupply();
      assertNumberEqualsWithPrecision(balanceBefore.toNumber(),
                   balanceAfter.toNumber() + burnAmount,
                   "wrong balance after burn");
      assertNumberEqualsWithPrecision(totalSupplyAfter.toNumber(), totalSupplyBefore.toNumber() - burnAmount, "wrong totalSupply amount after burn.");
    });

    it("TestCase6: burn: burn amount should <= balance ", async () => {
      const burner = accounts[1];
      const balanceBefore = await newLrcToken.balanceOf(burner);
      const burnAmount = balanceBefore.toNumber() + 1e18;

      const totalSupplyBefore = await newLrcToken.totalSupply();
      try {
        await newLrcToken.burn(burnAmount, "", {from: burner});
      } catch (err) {
        assert(true, "burn amount > balance");
      }
    });

  });

  describe("erc777 functionalities:", () => {
    it("TestCase1: granularity should always be 1 in EIP777", async () => {
      const granularity = await newLrcToken.granularity();
      assert.equal(granularity.toNumber(), 1, "granularity isn't 1");
    });

    it("TestCase1: defaultOperators() should be null in our token", async () => {
      var defaultOperators = await newLrcToken.defaultOperators();
      assert.equal(defaultOperators.length, 0, "the length of defaultOperators isn't 0");
    });

    it("TestCase3: isOperatorFor, authorizeOperator and revokeOperator", async () => {
      const operator = accounts[1];
      var result = await newLrcToken.isOperatorFor(operator, owner);
      assert.equal(result, false, "isOperatorFor returns true for an unauthorized operator");

      await newLrcToken.authorizeOperator(operator, {from: owner});
      result = await newLrcToken.isOperatorFor(operator, owner);
      assert.equal(result, true, "isOperatorFor returns false for an authorized operator");

      await newLrcToken.revokeOperator(accounts[2], {from: owner});
      result = await newLrcToken.isOperatorFor(operator, owner);
      assert.equal(result, true, "isOperatorFor returns false for an authorized operator");

      await newLrcToken.revokeOperator(operator, {from: owner});
      result = await newLrcToken.isOperatorFor(operator, owner);
      assert.equal(result, false, "isOperatorFor returns true after revokeOperator");
    });

    it("TestCase4: should be able to send tokens between addresses", async () => {
      const receiver = accounts[5];
      const amount = 100e18;
      await newLrcToken.sendx(receiver, amount, [], {from: owner});
      const balanceOfOwner = await newLrcToken.balanceOf(owner);
      const balanceOfReceiver = await newLrcToken.balanceOf(receiver);
      assert.equal(balanceOfReceiver.toNumber(), amount, "the balance of receiver doesn't equal to the amount of sending");
    });

    it("TestCase5: should be able to burn tokens", async () => {
      const amount = 1e18;
      const balanceOfOwnerBefore = await newLrcToken.balanceOf(owner);
      await newLrcToken.burn(amount, "", {from: owner});
      const balanceOfOwnerAfter = await newLrcToken.balanceOf(owner);
      //BigNumber { s: 1, e: 26, c: [ 1395072550000 ] }
      assert.equal(balanceOfOwnerBefore.c[0]-balanceOfOwnerAfter.c[0], 10000, "the balance of the owner is wrong after burning");
    });

    it("TestCase6: should be able to operatorSend tokens between addresses", async () => {
      const operator = accounts[1];
      await newLrcToken.authorizeOperator(operator, {from: owner});
      const receiver = accounts[3];
      const amount = 150e18;
      await newLrcToken.operatorSend(owner, receiver, amount, [], [], {from: operator});
      const balanceOfOwner = await newLrcToken.balanceOf(owner);
      const balanceOfReceiver = await newLrcToken.balanceOf(receiver);
      assert.equal(balanceOfReceiver.toNumber(), amount, "the balance of the receiver doesn't equal to the amount of operatorSend");
    });

    it("TestCase7: should be able to operatorBurn tokens between addresses", async () => {
      const operator = accounts[1];
      await newLrcToken.authorizeOperator(operator, {from: owner});
      const amount = 150e18;
      const balanceOfOwnerBefore = await newLrcToken.balanceOf(owner);
      const totalSupplyBefore = await newLrcToken.totalSupply();
      await newLrcToken.operatorBurn(owner, amount, [], [], {from: operator});
      const balanceOfOwnerAfter = await newLrcToken.balanceOf(owner);
      const totalSupplyAfter = await newLrcToken.totalSupply();
      assert.equal(balanceOfOwnerBefore.c[0]-balanceOfOwnerAfter.c[0], 1500000, "the balance of the owner is wrong after operatorSend");
      assert.equal(totalSupplyBefore.c[0]-totalSupplyAfter.c[0], 1500000, "the totalSupply is wrong after operatorSend");
    });

  });

});
