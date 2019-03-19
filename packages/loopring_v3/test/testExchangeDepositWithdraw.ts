import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { OrderInfo, RingInfo } from "./types";

const {
  TESTToken,
} = new Artifacts(artifacts);

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;

  const zeroAddress = "0x" + "00".repeat(20);

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("DepositWithdraw", function() {
    this.timeout(0);

    it("ERC20: deposit + onchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, accountID, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ERC20: deposit + offchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = "LRC";
      const feeToken = "LRC";
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOffchain(stateID, accountID, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + onchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, accountID, token, balance.mul(new BN(2)), owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("ETH: deposit + offchain withdrawal", async () => {
      const stateID = 0;
      const keyPair = exchangeTestUtil.getKeyPairEDDSA();
      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const wallet = exchangeTestUtil.wallets[stateID][0];
      const balance = new BN(web3.utils.toWei("7", "ether"));
      const token = zeroAddress;
      const feeToken = zeroAddress;
      const fee = new BN(web3.utils.toWei("1", "ether"));

      const depositInfo = await exchangeTestUtil.deposit(stateID, owner,
                                                         keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                         wallet.walletID, token, balance);
      const accountID = depositInfo.accountID;
      await exchangeTestUtil.commitDeposits(stateID);

      await exchangeTestUtil.requestWithdrawalOffchain(stateID, accountID, token, balance.mul(new BN(2)),
                                                       feeToken, fee, 0, wallet.walletAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals();
    });

    it("Onchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderA.accountID,
                                                      "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderB.accountID,
                                                      "WETH", ring.orderB.amountB.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));

      // await exchangeTestUtil.exchange.withdrawBlockFee(stateID, 4);
    });

    it("Offchain withdrawal", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "ETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "ETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };
      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.accountID,
                                                 "GTO", ring.orderA.amountB.mul(new BN(2)),
                                                 "GTO", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderA.dualAuthAccountID);
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.accountID,
                                                 "ETH", ring.orderB.amountB.mul(new BN(2)),
                                                 "ETH", new BN(web3.utils.toWei("1", "ether")), 50,
                                                 ring.orderB.dualAuthAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Offchain wallet fee withdrawal (with burned fees)", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderA.dualAuthAccountID,
                                                 "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderA.dualAuthAccountID);
      exchangeTestUtil.requestWithdrawalOffchain(stateID, ring.orderB.dualAuthAccountID,
                                                 "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                 "LRC", new BN(web3.utils.toWei("1", "ether")), 20,
                                                 ring.orderB.dualAuthAccountID);
      await exchangeTestUtil.commitOffchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

    it("Onchain wallet fee withdrawal (with burned fees)", async () => {
      const stateID = 0;
      const ring: RingInfo = {
        orderA:
          {
            stateID,
            tokenS: "WETH",
            tokenB: "GTO",
            amountS: new BN(web3.utils.toWei("110", "ether")),
            amountB: new BN(web3.utils.toWei("200", "ether")),
            amountF: new BN(web3.utils.toWei("100", "ether")),
          },
        orderB:
          {
            stateID,
            tokenS: "GTO",
            tokenB: "WETH",
            amountS: new BN(web3.utils.toWei("200", "ether")),
            amountB: new BN(web3.utils.toWei("100", "ether")),
            amountF: new BN(web3.utils.toWei("90", "ether")),
          },
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(stateID, ring);

      await exchangeTestUtil.commitDeposits(stateID);
      await exchangeTestUtil.commitRings(stateID);

      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderA.dualAuthAccountID,
                                                      "LRC", ring.orderA.amountF.mul(new BN(2)),
                                                      ring.orderA.owner);
      await exchangeTestUtil.requestWithdrawalOnchain(stateID, ring.orderB.dualAuthAccountID,
                                                      "LRC", ring.orderB.amountF.mul(new BN(2)),
                                                      ring.orderB.owner);
      await exchangeTestUtil.commitOnchainWithdrawalRequests(stateID);
      await exchangeTestUtil.verifyPendingBlocks(stateID);
      await exchangeTestUtil.submitPendingWithdrawals(exchangeTestUtil.getAddressBook(ring));
    });

  });
});
