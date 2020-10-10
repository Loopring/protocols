import BN = require("bn.js");
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod } from "./types";
import { Constants } from "loopringV3.js";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeID = 0;
  let operatorAccountID: number;
  let operator: string;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (setupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState }
    );
    operatorAccountID = await exchangeTestUtil.getActiveOperator(exchangeID);
    operator = exchangeTestUtil.getAccount(operatorAccountID).owner;
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
        await exchangeTestUtil.transfer(
          ownerA,
          ownerD,
          tokenA,
          amountA,
          tokenB,
          amountC
        );
        await exchangeTestUtil.transfer(
          ownerB,
          ownerC,
          tokenA,
          amountB,
          tokenA,
          amountD
        );
        await exchangeTestUtil.transfer(
          ownerA,
          ownerB,
          tokenA,
          amountC,
          tokenB,
          amountD,
          {
            authMethod: AuthMethod.APPROVE
          }
        );
        await exchangeTestUtil.transfer(
          ownerA,
          ownerB,
          tokenB,
          amountD,
          tokenA,
          amountA
        );
        // Submit the transfers
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks();
      });

      it("Conditional transfers with same (from, to, token) values", async () => {
        await createExchange();
        // Do some transfers with the same (from, to, token) values
        await exchangeTestUtil.transfer(
          ownerA,
          ownerB,
          tokenA,
          amountA,
          tokenB,
          amountC,
          {
            authMethod: AuthMethod.APPROVE
          }
        );
        await exchangeTestUtil.transfer(
          ownerB,
          ownerA,
          tokenA,
          amountA,
          tokenB,
          amountC,
          {
            authMethod: AuthMethod.APPROVE
          }
        );
        await exchangeTestUtil.transfer(
          ownerB,
          ownerA,
          tokenA,
          amountB,
          tokenB,
          amountD,
          {
            authMethod: AuthMethod.APPROVE
          }
        );
        await exchangeTestUtil.transfer(
          ownerA,
          ownerB,
          tokenA,
          amountA,
          tokenB,
          amountC,
          {
            authMethod: AuthMethod.APPROVE
          }
        );
        // Submit the transfers
        await exchangeTestUtil.submitTransactions();
        await exchangeTestUtil.submitPendingBlocks();
      });
    });

    it("transfer (from != to, token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerD,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2)),
        { maxFee: fee.mul(new BN(3)) }
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2)),
        { maxFee: fee.mul(new BN(4)), authMethod: AuthMethod.ECDSA }
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerA,
        token,
        amount,
        feeToken,
        fee
      );

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (from != to, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("2.9", "ether"));
      const fee = new BN(web3.utils.toWei("12.3", "ether"));

      // Do a transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerD,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2)),
        { putAddressesInDA: false }
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerA,
        token,
        amount,
        feeToken,
        fee
      );

      // Commit the transfers
      await exchangeTestUtil.submitTransactions();

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (from == to, token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerB,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await exchangeTestUtil.transfer(
        ownerC,
        ownerC,
        token,
        amount.mul(new BN(3)),
        feeToken,
        fee.mul(new BN(3))
      );
      await exchangeTestUtil.transfer(
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
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (from == to, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("2.9", "ether"));
      const fee = new BN(web3.utils.toWei("12.3", "ether"));

      // Do a transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerB,
        ownerB,
        token,
        amount.mul(new BN(2)),
        feeToken,
        fee.mul(new BN(2))
      );
      await exchangeTestUtil.transfer(
        ownerC,
        ownerC,
        token,
        amount.mul(new BN(3)),
        feeToken,
        fee.mul(new BN(3))
      );
      await exchangeTestUtil.transfer(
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
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (from == to == operator)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        feeToken,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        token,
        fee
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        token,
        fee
      );

      exchangeTestUtil.setActiveOperator(
        await exchangeTestUtil.getAccountID(ownerA)
      );

      // Commit the transfers
      // Make sure all transactions are done in a single block in this test,
      // the way we sign transactions in the tests (immediately upon request)
      // would provide a wrong nonce when the operator signs the block.
      await exchangeTestUtil.submitTransactions(24);

      // Verify the block
      await exchangeTestUtil.submitPendingBlocks();
    });

    [AuthMethod.EDDSA, AuthMethod.ECDSA].forEach(function(authMethod) {
      it(
        "should not be able to do transfer with fee > maxFee (" +
          authMethod +
          ")",
        async () => {
          await createExchange();

          const token = "ETH";
          const feeToken = "LRC";
          const amount = new BN(web3.utils.toWei("1", "ether"));
          const fee = new BN(web3.utils.toWei("0.1", "ether"));

          // Do some transfers transfer
          await exchangeTestUtil.transfer(
            ownerA,
            ownerD,
            token,
            amount,
            feeToken,
            fee,
            { maxFee: fee.div(new BN(2)), authMethod }
          );

          // Commit the transfers
          if (authMethod === AuthMethod.EDDSA) {
            await expectThrow(
              exchangeTestUtil.submitTransactions(),
              "invalid block"
            );
          } else {
            await exchangeTestUtil.submitTransactions();
            await expectThrow(
              exchangeTestUtil.submitPendingBlocks(),
              "TRANSFER_FEE_TOO_HIGH"
            );
          }
        }
      );
    });

    it("should be able to transfer to a new account", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { transferToNew: true }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("should be able to transfer to an unknown recipient (dual authoring)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { useDualAuthoring: true }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("should not be able to transfer to an unknown recipient without knowledge of secret (dual authoring)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { useDualAuthoring: true, secretKnown: false }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("should be able to authorize a transfer using an onchain signature", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { authMethod: AuthMethod.ECDSA }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("should not be able to authorize a transfer using a wrong onchain signature", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      const transfer = await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { authMethod: AuthMethod.ECDSA, signer: ownerD }
      );
      transfer.onchainSignature = await exchangeTestUtil.submitTransactions();
      await expectThrow(
        exchangeTestUtil.submitPendingBlocks(),
        "INVALID_SIGNATURE"
      );
    });

    it("should be able to authorize a transfer using an approved transfer onchain", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { authMethod: AuthMethod.APPROVE }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("should not be able to authorize a transfer from a different account using an approved transfer onchain", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { authMethod: AuthMethod.APPROVE, signer: ownerD }
      );

      await exchangeTestUtil.submitTransactions();
      await expectThrow(
        exchangeTestUtil.submitPendingBlocks(),
        "TX_NOT_APPROVED"
      );
    });

    it("should be not be able to do a transfer when not approved onchain and without signature", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerD,
        token,
        amount,
        feeToken,
        fee,
        { authMethod: AuthMethod.NONE }
      );

      await exchangeTestUtil.submitTransactions();
      await expectThrow(
        exchangeTestUtil.submitPendingBlocks(),
        "TX_NOT_APPROVED"
      );
    });

    it("insufficient balance (token == feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = token;
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        {
          amountToDeposit: amount,
          feeToDeposit: new BN(0)
        }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("insufficient balance (token, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        {
          amountToDeposit: amount.div(new BN(2)),
          feeToDeposit: fee
        }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("insufficient balance (feeToken, token != feeToken)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("4.8", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      // Do some transfers
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        {
          amountToDeposit: amount,
          feeToDeposit: new BN(0)
        }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("transfer (parallel transfers)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      let storageID = 123;

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        feeToken,
        fee,
        { storageID: storageID++ }
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        { storageID: storageID++ }
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerC,
        token,
        amount,
        token,
        fee,
        { storageID: storageID++ }
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        token,
        fee,
        { storageID: storageID++ }
      );

      // Verify the block
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (sequential transfers)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      let storageID = 123;

      // Do some transfers transfer
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        feeToken,
        fee,
        { storageID }
      );
      storageID += Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        { storageID }
      );
      storageID += Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.transfer(
        ownerA,
        ownerC,
        token,
        amount,
        token,
        fee,
        { storageID }
      );
      storageID += Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        token,
        fee,
        { storageID }
      );

      // Verify the block
      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("transfer (reuse storageID)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      let storageID = 123;

      // Do some transfers transfers with the same storageID
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        { storageID }
      );
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        token,
        fee,
        { storageID }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });

    it("transfer (reuse old storageID)", async () => {
      await createExchange();

      const token = "ETH";
      const feeToken = "LRC";
      const amount = new BN(web3.utils.toWei("1", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));

      let storageID = 123;

      // Do some transfers transfers with the same storageID
      await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        token,
        amount,
        feeToken,
        fee,
        { storageID }
      );
      storageID += Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.transfer(
        ownerA,
        ownerA,
        token,
        amount,
        token,
        fee,
        { storageID }
      );
      storageID -= Constants.NUM_STORAGE_SLOTS;
      await exchangeTestUtil.transfer(
        ownerA,
        ownerC,
        token,
        amount,
        token,
        fee,
        { storageID }
      );

      // Commit the transfers
      await expectThrow(exchangeTestUtil.submitTransactions(), "invalid block");
    });
  });
});
