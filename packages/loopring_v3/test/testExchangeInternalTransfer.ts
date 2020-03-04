import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeID = 0;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
  };

  const transfer = async (
    from: string,
    to: string,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    amountToDeposit?: BN,
    feeToDeposit?: BN
  ) => {
    if (amountToDeposit === undefined) {
      amountToDeposit = amount;
    }
    if (feeToDeposit === undefined) {
      feeToDeposit = fee;
    }
    // From
    let accountFromId = await exchangeTestUtil.depositToOwner(
      from,
      token,
      amountToDeposit
    );
    await exchangeTestUtil.depositTo(accountFromId, feeToken, feeToDeposit);
    // To
    let accountToId = await exchangeTestUtil.depositToOwner(
      to,
      token,
      new BN(0)
    );
    // Do the transfer
    const request = await exchangeTestUtil.requestInternalTransfer(
      exchangeID,
      accountFromId,
      accountToId,
      token,
      amount,
      feeToken,
      fee,
      exchangeTestUtil.getRandomInt(1000)
    );
    return request;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchangeID = 1;

    ownerA = exchangeTestUtil.testContext.orderOwners[0];
    ownerB = exchangeTestUtil.testContext.orderOwners[1];
    ownerC = exchangeTestUtil.testContext.orderOwners[2];
    ownerD = exchangeTestUtil.testContext.orderOwners[3];
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("InternalTransfer", function() {
    this.timeout(0);

    it("transfer (from != to, token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await transfer(ownerA, ownerB, token, amount, feeToken, fee);
      await transfer(
        ownerB,
        ownerD,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await transfer(ownerB, ownerA, token, amount, feeToken, fee);

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Commit the transfers
      await exchangeTestUtil.commitInternalTransfers(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("transfer (from != to, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("2.9", "ether"));
      const fee = new BN(web3.utils.toWei("12.3", "ether"));

      // Do a transfer
      await transfer(ownerA, ownerB, token, amount, feeToken, fee);
      await transfer(
        ownerB,
        ownerD,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await transfer(ownerB, ownerA, token, amount, feeToken, fee);

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Commit the transfers
      await exchangeTestUtil.commitInternalTransfers(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("transfer (from == to, token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await transfer(ownerA, ownerA, token, amount, feeToken, fee);
      await transfer(
        ownerB,
        ownerB,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await transfer(
        ownerC,
        ownerC,
        token,
        amount.mul(new BN(3)),
        feeToken,
        fee.mul(new BN(3))
      );
      await transfer(
        ownerD,
        ownerD,
        token,
        amount.mul(new BN(4)),
        feeToken,
        fee.mul(new BN(4))
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Commit the transfers
      await exchangeTestUtil.commitInternalTransfers(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("transfer (from != to, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("2.9", "ether"));
      const fee = new BN(web3.utils.toWei("12.3", "ether"));

      // Do a transfer
      await transfer(ownerA, ownerA, token, amount, feeToken, fee);
      await transfer(
        ownerB,
        ownerB,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await transfer(
        ownerC,
        ownerC,
        token,
        amount.mul(new BN(3)),
        feeToken,
        fee.mul(new BN(3))
      );
      await transfer(
        ownerD,
        ownerD,
        token,
        amount.mul(new BN(4)),
        feeToken,
        fee.mul(new BN(4))
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Commit the transfers
      await exchangeTestUtil.commitInternalTransfers(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("transfer (from == to == operator)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await transfer(ownerA, ownerB, token, amount, feeToken, fee);
      await transfer(ownerA, ownerA, token, amount, feeToken, fee);
      await transfer(ownerA, ownerB, token, amount, token, fee);
      await transfer(ownerA, ownerA, token, amount, token, fee);

      exchangeTestUtil.setActiveOperator(
        await exchangeTestUtil.getAccountID(ownerA)
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);
      // Commit the transfers
      await exchangeTestUtil.commitInternalTransfers(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("insufficient balance (token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        amount,
        new BN(0)
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.commitInternalTransfers(exchangeID),
        "invalid block"
      );
    });

    it("insufficient balance (token, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        amount.div(new BN(2)),
        fee
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.commitInternalTransfers(exchangeID),
        "invalid block"
      );
    });

    it("insufficient balance (feeToken, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        amount,
        new BN(0)
      );

      // Commit the deposits
      await exchangeTestUtil.commitDeposits(exchangeID);

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.commitInternalTransfers(exchangeID),
        "invalid block"
      );
    });
  }); // end of describe()
}); // end of contract()
