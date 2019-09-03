import BN = require("bn.js");
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;
  let exchangeID = 0;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeID = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
    exchangeID = 1;
  });

  describe("DepositInternalTransfer", function() {
    this.timeout(0);

    it("Internal transfer (normal account)", async () => {
      await createExchange();

      const initBalance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const transAmount1 = new BN(web3.utils.toWei("2", "ether"));
      const transAmount2 = new BN(web3.utils.toWei("1.5", "ether"));
      const feeToken = exchangeTestUtil.getTokenAddress("ETH");
      const feeToO = new BN(web3.utils.toWei("0.1", "ether"));

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPairA.secretKey,
        keyPairA.publicKeyX,
        keyPairA.publicKeyY,
        token,
        initBalance
      );

      // init B by 0
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const keyPairB = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoB = await exchangeTestUtil.deposit(
        exchangeID,
        ownerB,
        keyPairB.secretKey,
        keyPairB.publicKeyX,
        keyPairB.publicKeyY,
        token,
        initBalance
      );

      // init C by 0
      const ownerC = exchangeTestUtil.testContext.orderOwners[2];
      const keyPairC = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoC = await exchangeTestUtil.deposit(
        exchangeID,
        ownerC,
        keyPairC.secretKey,
        keyPairC.publicKeyX,
        keyPairC.publicKeyY,
        token,
        new BN(0)
      );

      // init D by 0
      const ownerD = exchangeTestUtil.testContext.orderOwners[3];
      const keyPairD = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoD = await exchangeTestUtil.deposit(
        exchangeID,
        ownerD,
        keyPairD.secretKey,
        keyPairD.publicKeyX,
        keyPairD.publicKeyY,
        token,
        new BN(0)
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do the request
      await exchangeTestUtil.requestInternalTransfer(
        exchangeID,
        depositInfoA.accountID,
        depositInfoC.accountID,
        token,
        transAmount1,
        feeToken,
        feeToO,
        0
      );

      await exchangeTestUtil.requestInternalTransfer(
        exchangeID,
        depositInfoB.accountID,
        depositInfoD.accountID,
        token,
        transAmount2,
        feeToken,
        feeToO,
        0
      );

      // Commit the deposit
      await exchangeTestUtil.commitInternalTransferRequests(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("Internal transfer partial block with dummy trans", async () => {
      await createExchange();

      const initBalance = new BN(web3.utils.toWei("7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const transAmount1 = new BN(web3.utils.toWei("1", "ether"));
      const feeToken = exchangeTestUtil.getTokenAddress("ETH");
      const feeToO = new BN(web3.utils.toWei("0.1", "ether"));

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPairA.secretKey,
        keyPairA.publicKeyX,
        keyPairA.publicKeyY,
        token,
        initBalance
      );

      // init C by 0
      const ownerC = exchangeTestUtil.testContext.orderOwners[2];
      const keyPairC = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoC = await exchangeTestUtil.deposit(
        exchangeID,
        ownerC,
        keyPairC.secretKey,
        keyPairC.publicKeyX,
        keyPairC.publicKeyY,
        token,
        new BN(0)
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do the request
      await exchangeTestUtil.requestInternalTransfer(
        exchangeID,
        depositInfoA.accountID,
        depositInfoC.accountID,
        token,
        transAmount1,
        feeToken,
        new BN(0),
        0
      );

      // Commit the deposit
      await exchangeTestUtil.commitInternalTransferRequests(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });

    it("Internal transfer insufficient balance", async () => {
      await createExchange();

      const initBalance = new BN(web3.utils.toWei("1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const transAmount1 = new BN(web3.utils.toWei("1", "ether"));
      const feeToken = exchangeTestUtil.getTokenAddress("ETH");
      const feeToO = new BN(web3.utils.toWei("0.1", "ether"));

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const keyPairA = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoA = await exchangeTestUtil.deposit(
        exchangeID,
        ownerA,
        keyPairA.secretKey,
        keyPairA.publicKeyX,
        keyPairA.publicKeyY,
        token,
        initBalance
      );

      // init C by 0
      const ownerC = exchangeTestUtil.testContext.orderOwners[2];
      const keyPairC = exchangeTestUtil.getKeyPairEDDSA();
      const depositInfoC = await exchangeTestUtil.deposit(
        exchangeID,
        ownerC,
        keyPairC.secretKey,
        keyPairC.publicKeyX,
        keyPairC.publicKeyY,
        token,
        new BN(0)
      );

      await exchangeTestUtil.commitDeposits(exchangeID);

      // Do the request
      await exchangeTestUtil.requestInternalTransfer(
        exchangeID,
        depositInfoA.accountID,
        depositInfoC.accountID,
        token,
        transAmount1,
        feeToken,
        feeToO,
        0
      );

      // Commit the deposit
      await exchangeTestUtil.commitInternalTransferRequests(exchangeID);

      // Verify the block
      await exchangeTestUtil.verifyPendingBlocks(exchangeID);
    });
  }); // end of describe()
}); // end of contract()
