import BN = require("bn.js");
import { Constants, NftType } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let loopring: any;

  const checkWithdrawalMode = async (expectedInWithdrawalMode: boolean) => {
    const inWithdrawalMode = await exchange.isInWithdrawalMode();
    assert.equal(
      inWithdrawalMode,
      expectedInWithdrawalMode,
      "not in expected withdrawal mode state"
    );
  };

  const checkNotifyForcedRequestTooOld = async (
    accountID: number,
    tokenID: number,
    expectedInWithdrawalMode: boolean
  ) => {
    if (expectedInWithdrawalMode) {
      await exchange.notifyForcedRequestTooOld(accountID, tokenID);
      await exchangeTestUtil.assertEventEmitted(
        exchange,
        "WithdrawalModeActivated"
      );
    } else {
      await expectThrow(
        exchange.notifyForcedRequestTooOld(accountID, tokenID),
        "WITHDRAWAL_NOT_TOO_OLD"
      );
    }
  };

  const createExchange = async (
    setupTestState: boolean = true,
    useOwnerContract: boolean = true
  ) => {
    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState, useOwnerContract }
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  const withdrawFromMerkleTreeChecked = async (
    accountID: number,
    tokenID: number,
    expectedAmount: BN,
    nftToken?: string,
    nftID: string = "0"
  ) => {
    const recipient =
      accountID === 0
        ? await loopring.protocolFeeVault()
        : exchangeTestUtil.getAccount(accountID).owner;

    let token = exchangeTestUtil.getTokenAddressFromID(tokenID);
    if (nftToken) {
      token = nftToken;
    }

    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(
      nftToken === undefined
        ? exchangeTestUtil.depositContract.address
        : exchangeTestUtil.exchange.address,
      recipient,
      token,
      expectedAmount,
      "deposit contract",
      "owner",
      nftID
    );

    // Do the withdrawal
    await exchangeTestUtil.withdrawFromMerkleTree(accountID, tokenID);

    // Verify balances
    await snapshot.verifyBalances();

    // Try to withdraw again
    await expectThrow(
      exchangeTestUtil.withdrawFromMerkleTree(accountID, tokenID),
      "WITHDRAWN_ALREADY"
    );
  };

  const withdrawFromDepositRequestChecked = async (
    owner: string,
    token: string,
    expectedAmount: BN
  ) => {
    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(
      exchangeTestUtil.depositContract.address,
      owner,
      token,
      expectedAmount,
      "deposit contract",
      "owner"
    );

    // Do the withdrawal
    await exchangeTestUtil.exchange.withdrawFromDepositRequest(owner, token);

    // Verify balances
    await snapshot.verifyBalances();
  };

  const withdrawFromNFTDepositRequestChecked = async (
    owner: string,
    token: string,
    nftType: NftType,
    nftID: string,
    expectedAmount: BN
  ) => {
    // Simulate all transfers
    const snapshot = new BalanceSnapshot(exchangeTestUtil);
    await snapshot.transfer(
      exchangeTestUtil.exchange.address,
      owner,
      token,
      expectedAmount,
      "exchange",
      "owner",
      nftID
    );

    // Do the withdrawal
    await exchangeTestUtil.exchange.withdrawFromNFTDepositRequest(
      owner,
      token,
      nftType,
      nftID
    );

    // Verify balances
    await snapshot.verifyBalances();
  };

  describe("Withdrawal Mode", function() {
    this.timeout(0);

    it("should go into withdrawal mode when a forced withdrawal request isn't processed", async () => {
      await createExchange(true);
      // Try to notify using a request that doesn't exist
      await checkNotifyForcedRequestTooOld(
        2,
        exchangeTestUtil.getTokenIdFromNameOrAddress("LRC"),
        false
      );
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      //console.log(exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 100
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Do a forced withdrawal
      const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(
        deposit
      );
      const tokenID = withdrawal.tokenID;
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE - 100
      );
      // We shouldn't be in withdrawal mode yet
      await checkNotifyForcedRequestTooOld(
        withdrawal.accountID,
        tokenID,
        false
      );
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(200);
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(withdrawal.accountID, tokenID, true);
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);
    });

    it("should go into withdrawal mode when shutdown when not processing forced withdrawals", async () => {
      await createExchange(false, false);
      // Do a deposit
      const deposit = await exchangeTestUtil.doRandomDeposit();
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE - 10
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);

      // Shut down the exchange
      await exchange.shutdown({ from: exchangeTestUtil.exchangeOwner });

      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MIN_TIME_IN_SHUTDOWN + 100
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);

      // Do a forced withdrawal
      await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);

      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MIN_TIME_IN_SHUTDOWN - 100
      );
      // We shouldn't be in withdrawal mode yet
      await checkWithdrawalMode(false);
      // Wait
      await exchangeTestUtil.advanceBlockTimestamp(200);
      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(
        deposit.accountID,
        deposit.tokenID,
        true
      );
      // We should be in withdrawal mode
      await checkWithdrawalMode(true);

      // Burn the stake
      await exchange.burnExchangeStake();
    });

    it("ERC20: withdraw from merkle tree", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("7.1", "ether"));
      const token = exchangeTestUtil.getTokenAddress("LRC");

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const tokenID = deposit.tokenID;

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(deposit.accountID, tokenID),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        balance,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(deposit.accountID, tokenID, true);

      // Try to withdraw with an incorrect proof
      const proof = await exchangeTestUtil.createMerkleTreeInclusionProof(
        deposit.accountID,
        tokenID
      );
      proof.balanceLeaf.balance = new BN(proof.balanceLeaf.balance)
        .mul(new BN(2))
        .toString(10);
      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTreeWithProof(proof),
        "INVALID_MERKLE_TREE_DATA"
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(deposit.accountID, tokenID, balance);
    });

    it("ETH: withdraw from merkle tree", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const balance = new BN(web3.utils.toWei("1.7", "ether"));
      const token = exchangeTestUtil.getTokenAddress("ETH");

      const deposit = await exchangeTestUtil.deposit(
        owner,
        owner,
        token,
        balance
      );
      const tokenID = deposit.tokenID;

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(deposit.accountID, tokenID),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Do another deposit with the same amount to the account and process it in a block
      await exchangeTestUtil.deposit(owner, owner, token, balance);

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        owner,
        token,
        balance,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(deposit.accountID, tokenID, true);

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      // (Only the first deposit was submitted, so only that amount can be withdrawn from the Merkle tree)
      await withdrawFromMerkleTreeChecked(deposit.accountID, tokenID, balance);
    });

    it("NFT: withdraw from merkle tree", async () => {
      await createExchange();

      const ownerA = exchangeTestUtil.testContext.orderOwners[0];
      const ownerB = exchangeTestUtil.testContext.orderOwners[1];
      const token = exchangeTestUtil.getTokenAddress("ETH");
      const feeToken = exchangeTestUtil.getTokenAddress("ETH");
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftIDBN = new BN(nftID.slice(2), 16);

      const L2MintableERC1155 = artifacts.require("L2MintableERC1155");
      const NFTA = await L2MintableERC1155.new(
        "loopring",
        "loopring.nft",
        exchangeTestUtil.exchange.address
      );
      await NFTA.mint(ownerA, nftID, new BN(25), "0x");
      await NFTA.setApprovalForAll(exchangeTestUtil.exchange.address, true, {
        from: ownerA
      });

      const nftMint = await exchangeTestUtil.depositNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        new BN(10)
      );

      // Do a transfer
      const transfer = await exchangeTestUtil.transfer(
        ownerA,
        ownerB,
        "NFT",
        new BN(4),
        "ETH",
        new BN(0),
        {
          tokenID: nftMint.toTokenID,
          toTokenID: nftMint.toTokenID,
          amountToDeposit: new BN(0),
          transferToNew: true
        }
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(
          transfer.toAccountID,
          transfer.toTokenID
        ),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        ownerB,
        "NFT",
        new BN(4),
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          tokenID: transfer.toTokenID,
          nftMint: nftMint
        }
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(
        transfer.toAccountID,
        nftMint.toTokenID,
        true
      );

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      // (Only the first deposit was submitted, so only that amount can be withdrawn from the Merkle tree)
      await withdrawFromMerkleTreeChecked(
        transfer.toAccountID,
        nftMint.toTokenID,
        new BN(4),
        NFTA.address,
        nftID
      );
    });

    it("Withdraw from merkle tree (protocol fee account)", async () => {
      await createExchange();

      const protocolFees = await exchange.getProtocolFeeValues();

      // Ring with ETH and ERC20
      const ring: SpotTrade = {
        orderA: {
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether"))
        },
        orderB: {
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether"))
        }
      };

      await exchangeTestUtil.setupRing(ring);
      await exchangeTestUtil.sendRing(ring);

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      // Expected protocol fees earned
      const protocolFeeA = ring.orderA.amountB
        .mul(protocolFees.takerFeeBips)
        .div(new BN(100000));
      const protocolFeeB = ring.orderB.amountB
        .mul(protocolFees.makerFeeBips)
        .div(new BN(100000));

      await expectThrow(
        exchangeTestUtil.withdrawFromMerkleTree(0, ring.orderA.tokenIdB),
        "NOT_IN_WITHDRAW_MODE"
      );

      // Request withdrawal onchain
      await exchangeTestUtil.requestWithdrawal(
        Constants.zeroAddress,
        ring.orderA.tokenB,
        protocolFeeA.mul(new BN(2)),
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.FORCE }
      );

      // Operator doesn't do anything for a long time
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_FORCED_REQUEST_UNTIL_WITHDRAW_MODE + 1
      );

      // Enter withdrawal mode
      await checkNotifyForcedRequestTooOld(0, ring.orderA.tokenIdB, true);

      // We should be in withdrawal mode and able to withdraw directly from the merkle tree
      await withdrawFromMerkleTreeChecked(
        0,
        ring.orderA.tokenIdB,
        protocolFeeA
      );
      await withdrawFromMerkleTreeChecked(
        0,
        ring.orderB.tokenIdB,
        protocolFeeB
      );
    });

    it("Withdraw from deposit", async () => {
      await createExchange();

      const owner = exchangeTestUtil.testContext.orderOwners[0];
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftBalance = new BN(12);

      const L2MintableERC1155 = artifacts.require("L2MintableERC1155");
      const NFTA = await L2MintableERC1155.new(
        "loopring",
        "loopring.nft",
        exchangeTestUtil.exchange.address
      );
      await NFTA.mint(owner, nftID, new BN(25), "0x");
      await NFTA.setApprovalForAll(exchangeTestUtil.exchange.address, true, {
        from: owner
      });

      const tokenA = "LRC";
      const balanceA = new BN(web3.utils.toWei("2300.7", "ether"));
      const tokenB = "ETH";
      const balanceB = new BN(web3.utils.toWei("2.8", "ether"));
      const tokenC = "ETH";
      const balanceC = new BN(web3.utils.toWei("1.7", "ether"));
      const tokenD = "WETH";
      const balanceD = new BN(web3.utils.toWei("23.7", "ether"));

      const depositA = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenA,
        balanceA
      );

      await exchangeTestUtil.submitTransactions();
      await exchangeTestUtil.submitPendingBlocks();

      const depositB = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenB,
        balanceB
      );

      const depositC = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenC,
        balanceC
      );

      const depositD = await exchangeTestUtil.deposit(
        owner,
        owner,
        tokenD,
        balanceD
      );

      const mint = await exchangeTestUtil.depositNFT(
        owner,
        owner,
        NFTA.address,
        nftID,
        nftBalance
      );

      await expectThrow(
        exchangeTestUtil.exchange.withdrawFromDepositRequest(
          depositA.owner,
          depositA.token
        ),
        "DEPOSIT_NOT_WITHDRAWABLE_YET"
      );

      await expectThrow(
        exchangeTestUtil.exchange.withdrawFromNFTDepositRequest(
          depositA.owner,
          NFTA.address,
          NftType.ERC1155,
          nftID
        ),
        "DEPOSIT_NOT_WITHDRAWABLE_YET"
      );

      // Operator doesn't process the deposits
      await exchangeTestUtil.advanceBlockTimestamp(
        exchangeTestUtil.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND + 1
      );

      // We should be in withdrawal mode and able to withdraw from the pending deposits
      await withdrawFromDepositRequestChecked(
        depositB.owner,
        depositB.token,
        depositB.amount.add(depositC.amount)
      );
      await withdrawFromDepositRequestChecked(
        depositD.owner,
        depositD.token,
        depositD.amount
      );
      await withdrawFromNFTDepositRequestChecked(
        owner,
        NFTA.address,
        NftType.ERC1155,
        nftID,
        nftBalance
      );

      // Try to withdraw again
      await expectThrow(
        withdrawFromDepositRequestChecked(
          depositD.owner,
          depositD.token,
          depositD.amount
        ),
        "DEPOSIT_NOT_WITHDRAWABLE_YET"
      );

      // Try to withdraw a deposit that was processed
      await expectThrow(
        withdrawFromDepositRequestChecked(
          depositA.owner,
          depositA.token,
          depositA.amount
        ),
        "DEPOSIT_NOT_WITHDRAWABLE_YET"
      );

      // Try to withdraw again
      await expectThrow(
        withdrawFromNFTDepositRequestChecked(
          owner,
          NFTA.address,
          NftType.ERC1155,
          nftID,
          nftBalance
        ),
        "DEPOSIT_NOT_WITHDRAWABLE_YET"
      );
    });
  });
});
