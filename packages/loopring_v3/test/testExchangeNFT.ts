import BN = require("bn.js");
import { Constants, NftType } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { BalanceSnapshot, ExchangeTestUtil } from "./testExchangeUtil";
import { AuthMethod, OrderInfo, SpotTrade, NftMint } from "./types";

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;
  const bVerify = true;

  const L2MintableERC1155 = artifacts.require("L2MintableERC1155");
  const NFTFactory = artifacts.require("NFTFactory");
  const CounterfactualNFT = artifacts.require("CounterfactualNFT");

  let NFTA: any;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const checkBalanceNFT = async (
    token: any,
    owner: string,
    nftID: string,
    expectedAmount: BN
  ) => {
    assert.equal(
      (await token.balanceOf(owner, nftID)).toString(10),
      expectedAmount.toString(10),
      "unexpected L1 balance"
    );
  };

  const withdrawNFTOnceChecked = async (
    owner: string,
    token: string,
    tokenID: number,
    nftID: string,
    nftType: NftType,
    minter: string,
    expectedAmount: BN
  ) => {
    const snapshot = new BalanceSnapshot(ctx);
    await snapshot.transfer(
      ctx.exchange.address,
      owner,
      token,
      expectedAmount,
      "depositContract",
      "owner",
      nftID
    );

    // Check how much will be withdrawn
    const onchainAmountWithdrawableBefore = await ctx.exchange.getAmountWithdrawableNFT(
      owner,
      token,
      nftType,
      nftID,
      minter
    );
    assert(
      onchainAmountWithdrawableBefore.eq(expectedAmount),
      "unexpected withdrawable amount"
    );

    await ctx.exchange.withdrawFromApprovedWithdrawalsNFT(
      [owner],
      [minter],
      [nftType],
      [token],
      [nftID],
      {
        from: ctx.testContext.orderOwners[10]
      }
    );

    // Complete amount needs to be withdrawn
    const onchainAmountWithdrawableAfter = await ctx.exchange.getAmountWithdrawableNFT(
      owner,
      token,
      nftType,
      nftID,
      minter
    );
    assert(
      onchainAmountWithdrawableAfter.eq(new BN(0)),
      "unexpected withdrawable amount"
    );

    // Verify balances
    await snapshot.verifyBalances();

    // Get the WithdrawalCompleted event
    const event = await ctx.assertEventEmitted(
      ctx.exchange,
      "NftWithdrawalCompleted"
    );
    assert.equal(event.from, owner, "from unexpected");
    assert.equal(event.to, owner, "to unexpected");
    assert.equal(event.token, token, "token unexpected");
    assert(event.nftID.eq(new BN(nftID.slice(2), 16)), "nftID should match");
    assert.equal(event.tokenID.toNumber(), tokenID, "tokenID should match");
    assert(event.amount.eq(expectedAmount), "amount unexpected");
  };

  const withdrawNFTChecked = async (
    owner: string,
    token: string,
    tokenID: number,
    nftID: string,
    nftType: NftType,
    minter: string,
    expectedAmount: BN
  ) => {
    // Withdraw
    await withdrawNFTOnceChecked(
      owner,
      token,
      tokenID,
      nftID,
      nftType,
      minter,
      expectedAmount
    );
    // Withdraw again, no tokens should be transferred
    await withdrawNFTOnceChecked(
      owner,
      token,
      tokenID,
      nftID,
      nftType,
      minter,
      new BN(0)
    );
  };

  const mintNFTOnceChecked = async (
    owner: string,
    token: string,
    tokenID: number,
    nftID: string,
    nftType: NftType,
    minter: string,
    expectedAmount: BN
  ) => {
    // Check how much will be withdrawn
    const onchainAmountWithdrawableBefore = await ctx.exchange.getAmountWithdrawableNFT(
      owner,
      token,
      nftType,
      nftID,
      minter
    );
    assert(
      onchainAmountWithdrawableBefore.eq(expectedAmount),
      "unexpected withdrawable amount before"
    );

    await ctx.exchange.withdrawFromApprovedWithdrawalsNFT(
      [owner],
      [minter],
      [nftType],
      [token],
      [nftID],
      {
        from: ctx.testContext.orderOwners[10]
      }
    );

    // Complete amount needs to be withdrawn
    const onchainAmountWithdrawableAfter = await ctx.exchange.getAmountWithdrawableNFT(
      owner,
      token,
      nftType,
      nftID,
      minter
    );
    assert(
      onchainAmountWithdrawableAfter.eq(new BN(0)),
      "unexpected withdrawable amount after"
    );

    // Get the WithdrawalCompleted event
    const event = await ctx.assertEventEmitted(
      ctx.exchange,
      "NftWithdrawalCompleted"
    );
    assert.equal(event.from, owner, "from unexpected");
    assert.equal(event.to, owner, "to unexpected");
    assert.equal(event.token, token, "token unexpected");
    assert(event.nftID.eq(new BN(nftID.slice(2), 16)), "nftID should match");
    assert.equal(event.tokenID.toNumber(), 0, "tokenID should be 0");
    assert(event.amount.eq(expectedAmount), "amount unexpected");
  };

  const mintNFTChecked = async (
    owner: string,
    token: string,
    tokenID: number,
    nftID: string,
    nftType: NftType,
    minter: string,
    expectedAmount: BN
  ) => {
    // Mint
    await mintNFTOnceChecked(
      owner,
      token,
      tokenID,
      nftID,
      nftType,
      minter,
      expectedAmount
    );
    // Mint again, no tokens should be minted
    await mintNFTOnceChecked(
      owner,
      token,
      tokenID,
      nftID,
      nftType,
      minter,
      new BN(0)
    );
  };

  const verify = async () => {
    if (bVerify) {
      await ctx.submitPendingBlocks();
    }
  };

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);

    ownerA = ctx.testContext.orderOwners[0];
    ownerB = ctx.testContext.orderOwners[1];
    ownerC = ctx.testContext.orderOwners[2];
    ownerD = ctx.testContext.orderOwners[3];
  });

  after(async () => {
    await ctx.stop();
  });

  beforeEach(async () => {
    // Fresh Exchange for each test
    await ctx.createExchange(ctx.testContext.stateOwners[0]);

    NFTA = await L2MintableERC1155.new(
      "loopring",
      "loopring.nft",
      ctx.exchange.address
    );
  });

  describe("NFT", function() {
    this.timeout(0);

    it("L2 minting", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftIDA =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftIDB =
        "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);
      await ctx.deposit(ownerB, ownerB, feeToken, balance);
      await ctx.deposit(ownerC, ownerC, feeToken, balance);

      // Mint to self
      await ctx.mintNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftIDA,
        new BN(10),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.EDDSA
        }
      );
      await ctx.mintNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftIDA,
        new BN(20),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );
      await ctx.mintNFT(
        ownerB,
        ownerB,
        NFTA.address,
        nftIDA,
        new BN(30),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.EDDSA
        }
      );

      await ctx.submitTransactions(16);

      // Mint to others
      await ctx.mintNFT(
        ownerA,
        ownerB,
        NFTA.address,
        nftIDA,
        new BN(1),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );
      await ctx.mintNFT(
        ownerA,
        ownerB,
        NFTA.address,
        nftIDB,
        new BN(2),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );
      await ctx.mintNFT(
        ownerB,
        ownerA,
        NFTA.address,
        nftIDA,
        new BN(3),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );
      await ctx.mintNFT(
        ownerB,
        ownerA,
        NFTA.address,
        nftIDA,
        new BN(4),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );

      // Mint to new account
      await ctx.mintNFT(
        ownerB,
        ownerD,
        NFTA.address,
        nftIDA,
        new BN(3),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.ECDSA
        }
      );

      await ctx.submitTransactions(16);
      await verify();
    });

    it("L2 minting and withdrawing", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);
      await ctx.deposit(ownerB, ownerB, feeToken, balance);
      await ctx.deposit(ownerC, ownerC, feeToken, balance);

      // Setup minter
      await NFTA.addManager(ownerA);

      const nftMint = await ctx.mintNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        new BN(10),
        feeToken,
        fee
      );

      // Do a transfer
      const transfer = await ctx.transfer(
        ownerA,
        ownerB,
        "NFT",
        new BN(4),
        feeToken,
        fee,
        { tokenID: nftMint.toTokenID, amountToDeposit: new BN(0) }
      );

      // Do a trade
      const ring: SpotTrade = {
        orderA: {
          owner: ownerB,
          tokenS: "NFT",
          tokenB: "WETH",
          amountS: new BN(4),
          amountB: new BN(web3.utils.toWei("20", "ether")),
          tokenIdS: transfer.toTokenID
        },
        orderB: {
          owner: ownerC,
          tokenS: "WETH",
          tokenB: "NFT",
          amountS: new BN(web3.utils.toWei("10", "ether")),
          amountB: new BN(2),
          nftDataB: nftMint.nftData,
          feeBips: 0
        },
        expected: {
          orderA: { filledFraction: 0.5, spread: new BN(0) },
          orderB: { filledFraction: 1.0 }
        }
      };

      await ctx.setupRing(ring, true, true, false, false);
      await ctx.sendRing(ring);

      // Do a withdrawal
      const withdrawal = await ctx.requestWithdrawal(
        ownerC,
        "NFT",
        new BN(2),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.EDDSA,
          tokenID: ring.orderB.tokenIdB,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);

      await checkBalanceNFT(NFTA, ownerC, nftID, new BN(0));
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
      await verify();
      await checkBalanceNFT(NFTA, ownerC, nftID, withdrawal.amount);
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
    });

    it("Counterfactual L2 minting and withdrawing", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftIDBN = new BN(nftID.slice(2), 16);

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);

      // Setup counterfactual NFT contract for the owner
      const nftImplementation = await CounterfactualNFT.new(ctx.exchange.address);
      const factory = await NFTFactory.new(nftImplementation.address);
      const tokenAddress = await factory.computeNftContractAddress(ownerA, "");

      // Mint an NFT to this contract
      const nftMint = await ctx.mintNFT(
        ownerA,
        ownerA,
        tokenAddress,
        nftID,
        new BN(10),
        feeToken,
        fee
      );

      // Try to withdraw the NFT
      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(2),
        feeToken,
        fee,
        {
          authMethod: AuthMethod.EDDSA,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint,
          to: ownerB,
        }
      );

      await ctx.submitTransactions(16);
      await verify();

      // Check that the withdrawal did indeed fail
      const event = await ctx.assertEventEmitted(
        ctx.exchange,
        "NftWithdrawalFailed"
      );
      assert.equal(event.from, ownerA, "from should match");
      assert.equal(event.to, ownerB, "to should match");
      assert.equal(event.token, tokenAddress, "token should match");
      assert(event.nftID.eq(nftIDBN), "nftID should match");
      assert.equal(event.tokenID, withdrawal.tokenID, "tokenID should match");
      assert(event.amount.eq(withdrawal.amount), "amount should match");

      // Try to withdraw the NFTs manually before creating the contract
      await expectThrow(
        mintNFTOnceChecked(
          ownerB,
          tokenAddress,
          nftMint.toTokenID,
          nftID,
          nftMint.nftType,
          nftMint.minter,
          withdrawal.amount,
        ),
        "NFT_TRANSFER_FAILURE"
      );

      // Now create the NFT contract so the NFT can be minted
      await factory.createNftContract(ownerA, "");
      const nft = await CounterfactualNFT.at(tokenAddress);

      // Withdraw the NFT
      await mintNFTChecked(
        ownerB,
        tokenAddress,
        nftMint.toTokenID,
        nftID,
        nftMint.nftType,
        nftMint.minter,
        withdrawal.amount
      );
      // Check that the user received the NFT on L1
      await checkBalanceNFT(nft, ownerB, nftID, withdrawal.amount);
    });

    it("NFT Forced withdrawal (NFT exists, correct owner)", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);

      // Setup minter
      await NFTA.addManager(ownerA);

      const nftMint = await ctx.mintNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        new BN(10),
        feeToken,
        fee
      );

      // Do a forced withdrawal
      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(10),
        feeToken,
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);
      await verify();
      await checkBalanceNFT(NFTA, ownerA, nftID, withdrawal.amount);
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
    });

    it("NFT Forced withdrawal (NFT exists, incorrect owner)", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);

      // Setup minter
      await NFTA.addManager(ownerA);

      const nftMint = await ctx.mintNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        new BN(10),
        feeToken,
        fee
      );

      // Do an invalid forced withdrawal
      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(10),
        feeToken,
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          signer: ownerB,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);
      await verify();
      await checkBalanceNFT(NFTA, ownerA, nftID, new BN(0));
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
    });

    it("NFT Forced withdrawal (NFT doesn't exist, correct owner)", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);

      // Non-existing NFT
      const nftMint: NftMint = {
        txType: "NftMint",
        exchange: ctx.exchange.address,
        type: 2,
        minterAccountID: 0,
        tokenAccountID: 0,
        amount: new BN(0),
        toAccountID: 0,
        toTokenID: 45000,
        minter: Constants.zeroAddress,
        nftType: 0,
        tokenAddress: Constants.zeroAddress,
        nftID: new BN(nftID.slice(2), 16).toString(10),
        nftIDHi: new BN(nftID.substr(2, 32), 16).toString(10),
        nftIDLo: new BN(nftID.substr(2 + 32, 32), 16).toString(10),
        creatorFeeBips: 0
      };

      // Do a forced withdrawal
      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(0),
        feeToken,
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);
      await verify();
      await checkBalanceNFT(NFTA, ownerA, nftID, withdrawal.amount);
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
    });

    it("NFT Forced withdrawal (NFT doesn't exist, incorrect owner)", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);

      // Non-existing NFT
      const nftMint: NftMint = {
        txType: "NftMint",
        exchange: ctx.exchange.address,
        type: 2,
        minterAccountID: 0,
        tokenAccountID: 0,
        amount: new BN(0),
        toAccountID: 0,
        toTokenID: 45000,
        minter: Constants.zeroAddress,
        nftType: 0,
        tokenAddress: Constants.zeroAddress,
        nftID: new BN(nftID.slice(2), 16).toString(10),
        nftIDHi: new BN(nftID.substr(2, 32), 16).toString(10),
        nftIDLo: new BN(nftID.substr(2 + 32, 32), 16).toString(10),
        creatorFeeBips: 0
      };

      // Do a forced withdrawal
      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(0),
        feeToken,
        new BN(0),
        {
          authMethod: AuthMethod.FORCE,
          signer: ownerB,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);
      await verify();
      await checkBalanceNFT(NFTA, ownerA, nftID, withdrawal.amount);
      await checkBalanceNFT(NFTA, ctx.exchange.address, nftID, new BN(0));
    });

    it("NFT Forced withdrawal (NFT doesn't exist, account doesn't exist)", async () => {
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";

      const nftMint: NftMint = {
        txType: "NftMint",
        exchange: ctx.exchange.address,
        type: 2,
        minterAccountID: 0,
        tokenAccountID: 0,
        amount: new BN(0),
        toAccountID: 0,
        toTokenID: 45000,
        minter: Constants.zeroAddress,
        nftType: 0,
        tokenAddress: Constants.zeroAddress,
        nftID: new BN(nftID.slice(2), 16).toString(10),
        nftIDHi: new BN(nftID.substr(2, 32), 16).toString(10),
        nftIDLo: new BN(nftID.substr(2 + 32, 32), 16).toString(10),
        creatorFeeBips: 0
      };

      // For testing checks, doesn't actually create an account
      ctx.createNewAccount(ownerC);

      const withdrawal = await ctx.requestWithdrawal(
        ownerC,
        "NFT",
        new BN(2),
        Constants.zeroAddress,
        new BN(0),
        {
          to: Constants.zeroAddress,
          authMethod: AuthMethod.FORCE,
          signer: ownerB,
          tokenID: nftMint.toTokenID,
          nftMint,
          forceUseNftData: true
        }
      );
      // The account actually doesn't exist so set the owner to zero
      withdrawal.owner = Constants.zeroAddress;

      await ctx.submitTransactions(8);
      await verify();
    });

    it("Deposit/Withdraw NFT", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftIDBN = new BN(nftID.slice(2), 16);
      const depositAmount = new BN(10);

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);
      await ctx.deposit(ownerB, ownerB, feeToken, balance);

      await checkBalanceNFT(NFTA, ownerA, nftID, new BN(0));
      await NFTA.mint(ownerA, nftIDBN, new BN(25), "0x");
      await checkBalanceNFT(NFTA, ownerA, nftID, new BN(25));

      await NFTA.setApprovalForAll(ctx.exchange.address, true, {
        from: ownerA
      });

      const nftMint = await ctx.depositNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        depositAmount
      );

      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(2),
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.EDDSA,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint
        }
      );

      await ctx.submitTransactions(16);

      const snapshot = new BalanceSnapshot(ctx);
      await snapshot.transfer(
        ctx.exchange.address,
        ownerA,
        NFTA.address,
        withdrawal.amount,
        "exchange",
        "ownerA",
        nftID
      );

      await verify();

      await snapshot.verifyBalances();

      // Try to mint for
      ctx.mintNFT(
        NFTA.address,
        ownerA,
        NFTA.address,
        nftID,
        withdrawal.amount,
        "ETH",
        new BN(0),
        { authMethod: AuthMethod.DEPOSIT }
      );
      await ctx.submitTransactions(16);
      await expectThrow(verify(), "DEPOSIT_NOT_EXIST");
    });

    it("Withdraw from approved withdrawal", async () => {
      const feeToken = "WETH";
      const balance = new BN(web3.utils.toWei("100.0", "ether"));
      const fee = new BN(web3.utils.toWei("0.1", "ether"));
      const nftID =
        "0x0123456789012345678901234567890123456789012345678901234567891234";
      const nftIDBN = new BN(nftID.slice(2), 16);
      const depositAmount = new BN(10);

      // Fund some accounts
      await ctx.deposit(ownerA, ownerA, feeToken, balance);
      await ctx.deposit(ownerB, ownerB, feeToken, balance);

      await checkBalanceNFT(NFTA, ownerA, nftID, new BN(0));
      await NFTA.mint(ownerA, nftIDBN, new BN(25), "0x");
      await checkBalanceNFT(NFTA, ownerA, nftID, new BN(25));

      await NFTA.setApprovalForAll(ctx.exchange.address, true, {
        from: ownerA
      });

      const nftMint = await ctx.depositNFT(
        ownerA,
        ownerA,
        NFTA.address,
        nftID,
        depositAmount
      );

      const withdrawal = await ctx.requestWithdrawal(
        ownerA,
        "NFT",
        new BN(2),
        "ETH",
        new BN(0),
        {
          authMethod: AuthMethod.EDDSA,
          tokenID: nftMint.toTokenID,
          nftMint: nftMint,
          to: ownerB,
          gas: 100
        }
      );

      await ctx.submitTransactions(16);

      const snapshot = new BalanceSnapshot(ctx);
      await snapshot.transfer(
        ctx.exchange.address,
        ownerA,
        NFTA.address,
        new BN(0),
        "exchange",
        "ownerA",
        nftID
      );
      await snapshot.transfer(
        ctx.exchange.address,
        ownerB,
        NFTA.address,
        new BN(0),
        "exchange",
        "ownerB",
        nftID
      );

      await verify();

      const event = await ctx.assertEventEmitted(
        ctx.exchange,
        "NftWithdrawalFailed"
      );
      assert.equal(event.from, ownerA, "from should match");
      assert.equal(event.to, ownerB, "to should match");
      assert.equal(event.token, NFTA.address, "token should match");
      assert(event.nftID.eq(nftIDBN), "nftID should match");
      assert.equal(event.tokenID, withdrawal.tokenID, "tokenID should match");
      assert(event.amount.eq(withdrawal.amount), "amount should match");

      await snapshot.verifyBalances();

      await withdrawNFTChecked(
        ownerB,
        NFTA.address,
        0,
        nftID,
        nftMint.nftType,
        nftMint.minter,
        withdrawal.amount
      );
    });

    describe("Transfers", function() {
      it("NFT transfers", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";
        const nftIDB =
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);
        await ctx.deposit(ownerC, ownerC, feeToken, balance);

        // Setup minter
        await NFTA.addManager(ownerA);

        const nftMintA = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(10),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        const nftMintB = await ctx.mintNFT(
          ownerB,
          ownerB,
          NFTA.address,
          nftIDB,
          new BN(10),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        // Do a partial transfer
        await ctx.transfer(ownerA, ownerB, "NFT", new BN(4), feeToken, fee, {
          tokenID: nftMintA.toTokenID,
          toTokenID: Constants.NFT_TOKEN_ID_START + 1,
          amountToDeposit: new BN(0)
        });
        // now transfer the remaining amount out
        await ctx.transfer(ownerA, ownerB, "NFT", new BN(6), feeToken, fee, {
          tokenID: nftMintA.toTokenID,
          toTokenID: Constants.NFT_TOKEN_ID_START + 1,
          amountToDeposit: new BN(0),
          authMethod: AuthMethod.ECDSA
        });
        // reuse the slot to store a different NFT
        await ctx.transfer(ownerB, ownerA, "NFT", new BN(4), feeToken, fee, {
          tokenID: nftMintB.toTokenID,
          toTokenID: nftMintA.toTokenID,
          amountToDeposit: new BN(0)
        });

        // Now transfer some different tokens to another address
        await ctx.transfer(ownerB, ownerC, "NFT", new BN(2), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START,
          toTokenID: Constants.NFT_TOKEN_ID_START + 1,
          amountToDeposit: new BN(0),
          authMethod: AuthMethod.ECDSA
        });
        await ctx.transfer(ownerB, ownerC, "NFT", new BN(1), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START + 1,
          toTokenID: Constants.NFT_TOKEN_ID_START,
          amountToDeposit: new BN(0)
        });

        await ctx.submitTransactions();
        await verify();
      });

      it("NFT self transfers", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";
        const nftIDB =
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);
        await ctx.deposit(ownerC, ownerC, feeToken, balance);

        // Setup minter
        await NFTA.addManager(ownerA);

        await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(10),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        // To different slot fully
        await ctx.transfer(ownerA, ownerA, "NFT", new BN(10), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START,
          toTokenID: Constants.NFT_TOKEN_ID_START + 1,
          amountToDeposit: new BN(0)
        });

        // To different slot partially, 1st part
        await ctx.transfer(ownerA, ownerA, "NFT", new BN(4), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START + 1,
          toTokenID: Constants.NFT_TOKEN_ID_START + 2,
          amountToDeposit: new BN(0)
        });

        // To different slot partially, 2nd part (now fully)
        await ctx.transfer(ownerA, ownerA, "NFT", new BN(6), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START + 1,
          toTokenID: Constants.NFT_TOKEN_ID_START + 2,
          amountToDeposit: new BN(0)
        });

        // To same slot, partially
        await ctx.transfer(ownerA, ownerA, "NFT", new BN(3), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START + 2,
          toTokenID: Constants.NFT_TOKEN_ID_START + 2,
          amountToDeposit: new BN(0)
        });

        // To same slot, fully
        await ctx.transfer(ownerA, ownerA, "NFT", new BN(10), feeToken, fee, {
          tokenID: Constants.NFT_TOKEN_ID_START + 2,
          toTokenID: Constants.NFT_TOKEN_ID_START + 2,
          amountToDeposit: new BN(0)
        });

        await ctx.submitTransactions();
        await verify();
      });

      it("Invalid transfer - transfer to used tokenID", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";
        const nftIDB =
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);

        // Setup minter
        await NFTA.addManager(ownerA);

        const nftMintA = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(10),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        const nftMintB = await ctx.mintNFT(
          ownerB,
          ownerB,
          NFTA.address,
          nftIDB,
          new BN(10),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        // Do a transfer to a tokenID that already contains a different NFT
        await ctx.transfer(ownerA, ownerB, "NFT", new BN(4), feeToken, fee, {
          tokenID: nftMintA.toTokenID,
          toTokenID: Constants.NFT_TOKEN_ID_START,
          amountToDeposit: new BN(0)
        });

        await expectThrow(ctx.submitTransactions(12), "invalid block");
      });
    });

    describe("Trade", function() {
      it("NFT <-> ERC20", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);

        const mintA = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(4),
          feeToken,
          fee
        );

        // NFT <-> ERC20 trade
        const ringA: SpotTrade = {
          orderA: {
            owner: ownerA,
            tokenS: "NFT",
            tokenB: "WETH",
            amountS: new BN(4),
            amountB: new BN(web3.utils.toWei("20", "ether")),
            tokenIdS: mintA.toTokenID,
            maxFeeBips: 500
          },
          orderB: {
            owner: ownerB,
            tokenS: "WETH",
            tokenB: "NFT",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(2),
            nftDataB: mintA.nftData,
            maxFeeBips: 200
          },
          expected: {
            orderA: { filledFraction: 0.5, spread: new BN(0) },
            orderB: { filledFraction: 1.0 }
          }
        };

        await ctx.setupRing(ringA, true, true, false, false);
        await ctx.sendRing(ringA);

        const ringB: SpotTrade = {
          orderA: {
            owner: ownerA,
            tokenS: "NFT",
            tokenB: "WETH",
            amountS: new BN(2),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            tokenIdS: mintA.toTokenID,
            maxFeeBips: 500
          },
          orderB: {
            owner: ownerB,
            tokenS: "WETH",
            tokenB: "NFT",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(2),
            nftDataB: mintA.nftData,
            maxFeeBips: 100
          },
          expected: {
            orderA: { filledFraction: 1.0, spread: new BN(0) },
            orderB: { filledFraction: 1.0 }
          }
        };

        await ctx.setupRing(ringB, true, true, false, false);
        await ctx.sendRing(ringB);

        await ctx.submitTransactions();
        await verify();
      });

      it("ERC20 <-> NFT", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);

        const mintB = await ctx.mintNFT(
          ownerB,
          ownerB,
          NFTA.address,
          nftIDA,
          new BN(1),
          feeToken,
          fee
        );

        // NFT <-> ERC20 trade
        const ring: SpotTrade = {
          orderA: {
            owner: ownerA,
            tokenS: "WETH",
            tokenB: "NFT",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(1),
            nftDataB: mintB.nftData,
            maxFeeBips: 1234
          },
          orderB: {
            owner: ownerB,
            tokenS: "NFT",
            tokenB: "WETH",
            amountS: new BN(1),
            amountB: new BN(web3.utils.toWei("10", "ether")),
            tokenIdS: mintB.toTokenID,
            maxFeeBips: 1000
          },
          expected: {
            orderA: { filledFraction: 1.0, spread: new BN(0) },
            orderB: { filledFraction: 1.0 }
          }
        };

        await ctx.setupRing(ring, true, true, false, false);
        await ctx.sendRing(ring);

        await ctx.submitTransactions();
        await verify();
      });

      it("NFT <-> NFT", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";
        const nftIDB =
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);

        const mintA = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(10),
          feeToken,
          fee
        );

        const mintB = await ctx.mintNFT(
          ownerB,
          ownerB,
          NFTA.address,
          nftIDB,
          new BN(10),
          feeToken,
          fee
        );

        // NFT <-> NFT trade
        const ring: SpotTrade = {
          orderA: {
            owner: ownerA,
            tokenS: "NFT",
            tokenB: "NFT",
            amountS: new BN(3),
            amountB: new BN(2),
            tokenIdS: mintA.toTokenID,
            nftDataB: mintB.nftData,
            feeBips: 0
          },
          orderB: {
            owner: ownerB,
            tokenS: "NFT",
            tokenB: "NFT",
            amountS: new BN(2),
            amountB: new BN(3),
            tokenIdS: mintB.toTokenID,
            nftDataB: mintA.nftData,
            feeBips: 0
          },
          expected: {
            orderA: { filledFraction: 1.0, spread: new BN(0) },
            orderB: { filledFraction: 1.0 }
          }
        };

        await ctx.setupRing(ring, true, true, false, false);
        await ctx.sendRing(ring);

        await ctx.submitTransactions(12);
        await verify();
      });

      it("self trading", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";
        const nftIDB =
          "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddead";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);

        const mintA1 = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(1),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START }
        );

        const mintA2 = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDB,
          new BN(1),
          feeToken,
          fee,
          { toTokenID: Constants.NFT_TOKEN_ID_START + 10 }
        );

        // Same slot
        {
          const ring: SpotTrade = {
            orderA: {
              owner: ownerA,
              tokenS: "WETH",
              tokenB: "NFT",
              amountS: new BN(web3.utils.toWei("10", "ether")),
              amountB: new BN(1),
              nftDataB: mintA1.nftData,
              tokenIdB: Constants.NFT_TOKEN_ID_START,
              feeBips: 0
            },
            orderB: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "WETH",
              amountS: new BN(1),
              amountB: new BN(web3.utils.toWei("10", "ether")),
              tokenIdS: Constants.NFT_TOKEN_ID_START,
              maxFeeBips: 1000
            },
            expected: {
              orderA: { filledFraction: 1.0, spread: new BN(0) },
              orderB: { filledFraction: 1.0 }
            }
          };
          await ctx.setupRing(ring, true, true, false, false);
          await ctx.sendRing(ring);
        }

        // Different slot
        {
          const ring: SpotTrade = {
            orderA: {
              owner: ownerA,
              tokenS: "WETH",
              tokenB: "NFT",
              amountS: new BN(web3.utils.toWei("10", "ether")),
              amountB: new BN(1),
              nftDataB: mintA1.nftData,
              tokenIdB: Constants.NFT_TOKEN_ID_START + 1,
              feeBips: 0
            },
            orderB: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "WETH",
              amountS: new BN(1),
              amountB: new BN(web3.utils.toWei("10", "ether")),
              tokenIdS: Constants.NFT_TOKEN_ID_START,
              maxFeeBips: 1000
            },
            expected: {
              orderA: { filledFraction: 1.0, spread: new BN(0) },
              orderB: { filledFraction: 1.0 }
            }
          };
          await ctx.setupRing(ring, true, true, false, false);
          await ctx.sendRing(ring);
        }

        // NFTs, same slot
        {
          const ring: SpotTrade = {
            orderA: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "NFT",
              amountS: new BN(1),
              amountB: new BN(1),
              nftDataB: mintA2.nftData,
              tokenIdS: Constants.NFT_TOKEN_ID_START + 1,
              tokenIdB: Constants.NFT_TOKEN_ID_START + 10,
              feeBips: 0
            },
            orderB: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "NFT",
              amountS: new BN(1),
              amountB: new BN(1),
              nftDataB: mintA1.nftData,
              tokenIdS: Constants.NFT_TOKEN_ID_START + 10,
              tokenIdB: Constants.NFT_TOKEN_ID_START + 1,
              feeBips: 0
            },
            expected: {
              orderA: { filledFraction: 1.0, spread: new BN(0) },
              orderB: { filledFraction: 1.0 }
            }
          };
          await ctx.setupRing(ring, true, true, false, false);
          await ctx.sendRing(ring);
        }

        // NFTs, different slot
        {
          const ring: SpotTrade = {
            orderA: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "NFT",
              amountS: new BN(1),
              amountB: new BN(1),
              nftDataB: mintA2.nftData,
              tokenIdS: Constants.NFT_TOKEN_ID_START + 1,
              tokenIdB: Constants.NFT_TOKEN_ID_START + 11,
              feeBips: 0
            },
            orderB: {
              owner: ownerA,
              tokenS: "NFT",
              tokenB: "NFT",
              amountS: new BN(1),
              amountB: new BN(1),
              nftDataB: mintA1.nftData,
              tokenIdS: Constants.NFT_TOKEN_ID_START + 10,
              tokenIdB: Constants.NFT_TOKEN_ID_START + 2,
              feeBips: 0
            },
            expected: {
              orderA: { filledFraction: 1.0, spread: new BN(0) },
              orderB: { filledFraction: 1.0 }
            }
          };

          await ctx.setupRing(ring, true, true, false, false);
          await ctx.sendRing(ring);
        }

        await ctx.submitTransactions(12);
        await verify();
      });

      it("Invalid NFT match", async () => {
        const feeToken = "WETH";
        const balance = new BN(web3.utils.toWei("100.0", "ether"));
        const fee = new BN(web3.utils.toWei("0.1", "ether"));
        const nftIDA =
          "0x0123456789012345678901234567890123456789012345678901234567891234";

        // Fund some accounts
        await ctx.deposit(ownerA, ownerA, feeToken, balance);
        await ctx.deposit(ownerB, ownerB, feeToken, balance);

        const mintA = await ctx.mintNFT(
          ownerA,
          ownerA,
          NFTA.address,
          nftIDA,
          new BN(10),
          feeToken,
          fee
        );

        // NFT <-> ERC20 trade
        const ring: SpotTrade = {
          orderA: {
            owner: ownerA,
            tokenS: "NFT",
            tokenB: "WETH",
            amountS: new BN(4),
            amountB: new BN(web3.utils.toWei("20", "ether")),
            tokenIdS: mintA.toTokenID,
            maxFeeBips: 500
          },
          orderB: {
            owner: ownerB,
            tokenS: "WETH",
            tokenB: "NFT",
            amountS: new BN(web3.utils.toWei("10", "ether")),
            amountB: new BN(2),
            nftDataB: new BN(mintA.nftData).add(new BN(1)).toString(10),
            feeBips: 0
          },
          expected: {
            orderA: { filledFraction: 0.5, spread: new BN(0) },
            orderB: { filledFraction: 1.0 }
          }
        };

        await ctx.setupRing(ring, true, true, false, false);
        await ctx.sendRing(ring);

        await expectThrow(ctx.submitTransactions(), "invalid block");
      });
    });
  });
});
