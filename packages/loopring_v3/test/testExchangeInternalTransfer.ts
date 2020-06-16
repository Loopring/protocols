import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { OnchainBlock, ExchangeTestUtil } from "./testExchangeUtil";
import { Bitstream } from "loopringV3.js";

export interface TransferOptions {
  conditionalTransfer?: boolean;
  autoApprove?: boolean;
  amountToDeposit?: BN;
  feeToDeposit?: BN;
}

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    operatorAccountID = await exchangeTestUtil.getActiveOperator(exchangeID);
    operator = exchangeTestUtil.getAccount(operatorAccountID).owner;
  };

  const transfer = async (
    from: string,
    to: string,
    token: string,
    amount: BN,
    feeToken: string,
    fee: BN,
    options: TransferOptions = {}
  ) => {
    const amountToDeposit = options.amountToDeposit
      ? options.amountToDeposit
      : amount;
    const feeToDeposit = options.feeToDeposit ? options.feeToDeposit : fee;
    const conditionalTransfer =
      options.conditionalTransfer !== undefined
        ? options.conditionalTransfer
        : false;
    const autoApprove =
      options.autoApprove !== undefined ? options.autoApprove : true;
    // From
    let accountFromId = await exchangeTestUtil.depositToOwner(
      from,
      token,
      amountToDeposit
    );
    await exchangeTestUtil.depositToOwner(from, feeToken, feeToDeposit);
    // To
    let accountToId = await exchangeTestUtil.depositToOwner(
      to,
      token,
      new BN(0)
    );
    if (conditionalTransfer && autoApprove) {
      await exchangeTestUtil.approveOffchainTransfer(from, to, token, amount);
      await exchangeTestUtil.approveOffchainTransfer(
        from,
        operator,
        feeToken,
        fee
      );
    }
    // Do the transfer
    const request = await exchangeTestUtil.requestInternalTransfer(
      exchangeID,
      accountFromId,
      accountToId,
      token,
      amount,
      feeToken,
      fee,
      undefined,
      conditionalTransfer
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

    describe("Conditional transfers", function() {
      const tokenA = "ETH";
      const tokenB = "LRC";
      const amountA = new BN(web3.utils.toWei("1.8", "ether"));
      const amountB = new BN(web3.utils.toWei("3.4", "ether"));
      const amountC = new BN(web3.utils.toWei("0.1", "ether"));
      const amountD = new BN(web3.utils.toWei("0.01", "ether"));

      it("General transfers (mixed conditional/non-conditional)", async () => {
        await createExchange();
        // Do some transfers
        await transfer(ownerA, ownerD, tokenA, amountA, tokenB, amountC);
        await transfer(ownerB, ownerC, tokenA, amountB, tokenA, amountD);
        await transfer(ownerA, ownerB, tokenA, amountC, tokenB, amountD, {
          conditionalTransfer: true
        });
        await transfer(ownerA, ownerB, tokenB, amountD, tokenA, amountA);
        // Submit the transfers
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks(exchangeID);
      });

      it("Conditional transfers with same (from, to, token) values", async () => {
        await createExchange();
        // Do some transfers with the same (from, to, token) values
        await transfer(ownerA, ownerB, tokenA, amountA, tokenB, amountC, {
          conditionalTransfer: true
        });
        await transfer(ownerB, ownerA, tokenA, amountA, tokenB, amountC, {
          conditionalTransfer: true
        });
        await transfer(ownerB, ownerA, tokenA, amountB, tokenB, amountD, {
          conditionalTransfer: true
        });
        await transfer(ownerA, ownerB, tokenA, amountA, tokenB, amountC, {
          conditionalTransfer: true
        });
        // Submit the transfers
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks(exchangeID);
      });

      it("Conditional transfers with insufficient approval", async () => {
        await createExchange();
        // Do some transfers with insufficient approval
        await transfer(ownerA, ownerB, tokenA, amountA, tokenB, amountC, {
          conditionalTransfer: true,
          autoApprove: false
        });
        await transfer(ownerB, ownerA, tokenB, amountB, tokenB, amountD, {
          conditionalTransfer: true
        });
        // Submit the transfers
        await exchangeTestUtil.submitTransactions();
        await expectThrow(
          exchangeTestUtil.submitPendingBlocks(exchangeID),
          "SUB_UNDERFLOW"
        );
        // Aprove the main transfer, but not yet the fee
        await exchangeTestUtil.approveOffchainTransfer(
          ownerA,
          ownerB,
          tokenA,
          amountA
        );
        await expectThrow(
          exchangeTestUtil.submitPendingBlocks(exchangeID),
          "SUB_UNDERFLOW"
        );
        // Now also approve the fee payment
        await exchangeTestUtil.approveOffchainTransfer(
          ownerA,
          operator,
          tokenB,
          amountC
        );
        await exchangeTestUtil.submitPendingBlocks(exchangeID);
      });

      it("Combine multiple approvals into a single transfer", async () => {
        // Should be able to do multiple approvals that result in a single transfer
        await exchangeTestUtil.approveOffchainTransfer(
          ownerA,
          ownerB,
          tokenA,
          amountA
        );
        await exchangeTestUtil.approveOffchainTransfer(
          ownerA,
          ownerB,
          tokenA,
          amountB
        );
        await exchangeTestUtil.approveOffchainTransfer(
          ownerA,
          ownerB,
          tokenA,
          amountC
        );
        await transfer(
          ownerA,
          ownerB,
          tokenA,
          amountA.add(amountB).add(amountC),
          tokenB,
          new BN(0),
          { conditionalTransfer: true, autoApprove: false }
        );
        // Submit the single transfer
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks(exchangeID);
      });

      it("Invalid auxiliary data", async () => {
        await createExchange();
        // Do some transfers
        await transfer(ownerA, ownerD, tokenA, amountA, tokenB, amountC, {
          conditionalTransfer: true
        });
        await transfer(ownerB, ownerC, tokenA, amountB, tokenA, amountD);
        await transfer(ownerA, ownerB, tokenA, amountC, tokenB, amountD, {
          conditionalTransfer: true
        });
        await transfer(ownerA, ownerB, tokenB, amountD, tokenA, amountA);
        // Submit the deposits
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks(exchangeID);
        // Commmit the transfers
        await exchangeTestUtil.submitTransactions();

        // Submit the transfers: invalid length
        await expectThrow(
          exchangeTestUtil.submitPendingBlocks(
            exchangeID,
            (blocks: OnchainBlock[]) => {
              assert(blocks.length === 1, "unexpected number of blocks");
              const auxiliaryData = new Bitstream();
              auxiliaryData.addNumber(0, 4);
              blocks[0].auxiliaryData = web3.utils.hexToBytes(
                auxiliaryData.getData()
              );
            }
          ),
          "INVALID_AUXILIARYDATA_LENGTH"
        );

        // Submit the transfers: duplicated index
        await expectThrow(
          exchangeTestUtil.submitPendingBlocks(
            exchangeID,
            (blocks: OnchainBlock[]) => {
              assert(blocks.length === 1, "unexpected number of blocks");
              const auxiliaryData = new Bitstream();
              auxiliaryData.addNumber(2, 4);
              auxiliaryData.addNumber(2, 4);
              blocks[0].auxiliaryData = web3.utils.hexToBytes(
                auxiliaryData.getData()
              );
            }
          ),
          "INVALID_AUXILIARYDATA_DATA"
        );

        // Submit the transfers: index points to a normal transfer
        await expectThrow(
          exchangeTestUtil.submitPendingBlocks(
            exchangeID,
            (blocks: OnchainBlock[]) => {
              assert(blocks.length === 1, "unexpected number of blocks");
              const auxiliaryData = new Bitstream();
              auxiliaryData.addNumber(0, 4);
              auxiliaryData.addNumber(1, 4);
              blocks[0].auxiliaryData = web3.utils.hexToBytes(
                auxiliaryData.getData()
              );
            }
          ),
          "INVALID_AUXILIARYDATA_DATA"
        );

        // Submit the transfers: everything alright
        await exchangeTestUtil.submitPendingBlocks(
          exchangeID,
          (blocks: OnchainBlock[]) => {
            assert(blocks.length === 1, "unexpected number of blocks");
            const auxiliaryData = new Bitstream();
            auxiliaryData.addNumber(0, 4);
            auxiliaryData.addNumber(2, 4);
            blocks[0].auxiliaryData = web3.utils.hexToBytes(
              auxiliaryData.getData()
            );
          }
        );
      });
    });

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

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
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

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
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

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
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

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
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

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks(exchangeID);
    });

    it("insufficient balance (token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await transfer(ownerA, ownerB, token, amount, feeToken, fee, {
        amountToDeposit: amount,
        feeToDeposit: new BN(0)
      });

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.submitTransactions(),
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
      await transfer(ownerA, ownerB, token, amount, feeToken, fee, {
        amountToDeposit: amount.div(new BN(2)),
        feeToDeposit: fee
      });

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.submitTransactions(),
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
      await transfer(ownerA, ownerB, token, amount, feeToken, fee, {
        amountToDeposit: amount,
        feeToDeposit: new BN(0)
      });

      // Commit the transfers
      await expectThrow(
        exchangeTestUtil.submitTransactions(),
        "invalid block"
      );
    });
  }); // end of describe()
}); // end of contract()
