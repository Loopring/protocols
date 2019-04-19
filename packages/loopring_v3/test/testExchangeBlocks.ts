import BN = require("bn.js");
import * as pjs from "protocol2-js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, BlockType, DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;
  let exchange: any;
  let loopring: any;

  const revertBlockChecked = async (block: Block) => {
    const LRC = await exchangeTestUtil.getTokenContract("LRC");

    const blockIdxBefore = (await exchangeTestUtil.exchange.getBlockHeight()).toNumber();
    const lrcBalanceBefore = await exchangeTestUtil.getOnchainBalance(exchangeTestUtil.exchange.address, "LRC");
    const lrcSupplyBefore = await LRC.totalSupply();

    await exchangeTestUtil.revertBlock(block.blockIdx);

    const blockIdxAfter = (await exchangeTestUtil.exchange.getBlockHeight()).toNumber();
    const lrcBalanceAfter = await exchangeTestUtil.getOnchainBalance(exchangeTestUtil.exchange.address, "LRC");
    const lrcSupplyAfter = await LRC.totalSupply();

    assert(blockIdxBefore > blockIdxAfter, "blockIdx should have decreased");
    assert.equal(blockIdxAfter, block.blockIdx - 1, "State should have been reverted to the specified block");

    assert(lrcBalanceBefore.eq(lrcBalanceAfter.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC balance of exchange needs to be reduced by STAKE_AMOUNT_IN_LRC");
    assert(lrcSupplyBefore.eq(lrcSupplyAfter.add(exchangeTestUtil.STAKE_AMOUNT_IN_LRC)),
           "LRC supply needs to be reduced by STAKE_AMOUNT_IN_LRC");
  };

  const withdrawBlockFeeChecked = async (blockIdx: number, operator: string, totalBlockFee: BN,
                                         expectedBlockFee: BN, allowedDelta: BN = new BN(0)) => {
    const token = "ETH";
    const balanceOperatorBefore = await exchangeTestUtil.getOnchainBalance(operator, token);
    const balanceContractBefore = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const balanceBurnedBefore = await exchangeTestUtil.getOnchainBalance(loopring.address, token);

    await exchange.withdrawBlockFee(blockIdx, {from: operator, gasPrice: 0});

    const balanceOperatorAfter = await exchangeTestUtil.getOnchainBalance(operator, token);
    const balanceContractAfter = await exchangeTestUtil.getOnchainBalance(exchange.address, token);
    const balanceBurnedAfter = await exchangeTestUtil.getOnchainBalance(loopring.address, token);

    const expectedBurned = totalBlockFee.sub(expectedBlockFee);

    assert(balanceOperatorAfter.sub(balanceOperatorBefore.add(expectedBlockFee)).abs().lte(allowedDelta),
           "Token balance of operator should be increased by rewarded block fee");
    assert(balanceContractAfter.eq(balanceContractBefore.sub(totalBlockFee)),
           "Token balance of exchange should be decreased by total block fee");
    assert(balanceBurnedAfter.sub(balanceBurnedBefore.add(expectedBurned)).abs().lte(allowedDelta),
           "Burned amount should be increased by burned block fee");

    // Get the BlockFeeWithdrawn event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      exchange, "BlockFeeWithdrawn", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return [eventObj.args.blockIdx, eventObj.args.amount];
    });
    assert.equal(items[0][0].toNumber(), blockIdx, "Block idx in event not correct");
    assert(items[0][1].eq(totalBlockFee), "Block fee different than expected");
  };

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState,
    );
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
  };

  const setupRandomRing = async () => {
    const ring: RingInfo = {
      orderA:
        {
          realmID: exchangeId,
          tokenS: "WETH",
          tokenB: "GTO",
          amountS: new BN(web3.utils.toWei("100", "ether")),
          amountB: new BN(web3.utils.toWei("200", "ether")),
          amountF: new BN(web3.utils.toWei("1000", "ether")),
        },
      orderB:
        {
          realmID: exchangeId,
          tokenS: "GTO",
          tokenB: "WETH",
          amountS: new BN(web3.utils.toWei("200", "ether")),
          amountB: new BN(web3.utils.toWei("100", "ether")),
          amountF: new BN(web3.utils.toWei("900", "ether")),
        },
      expected: {
        orderA: { filledFraction: 1.0, margin: new BN(0) },
        orderB: { filledFraction: 1.0 },
      },
    };
    await exchangeTestUtil.setupRing(ring);
    await exchangeTestUtil.sendRing(exchangeId, ring);
    await exchangeTestUtil.commitDeposits(exchangeId);
    return ring;
  };

  const commitSomeWork = async () => {
    await setupRandomRing();
    await exchangeTestUtil.commitRings(exchangeId);
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  describe("Blocks", function() {
    this.timeout(0);

    describe("Operator", () => {

      describe("commitBlock", () => {
        it("should not be able to commit unsupported blocks", async () => {
          await createExchange(false);
          await exchangeTestUtil.blockVerifier.setVerifyingKey(0, true, 2, new Array(18).fill(1));
          const bs = new pjs.Bitstream();
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          await expectThrow(
            exchange.commitBlock(0, 1, web3.utils.hexToBytes(bs.getData()),
            {from: exchangeTestUtil.exchangeOperator}),
            "CANNOT_VERIFY_BLOCK",
          );
        });

        it("should not be able to commit block from different exchanges", async () => {
          await createExchange(false);
          await exchangeTestUtil.blockVerifier.setVerifyingKey(0, true, 2, new Array(18).fill(1));
          const bs = new pjs.Bitstream();
          bs.addNumber(exchangeId + 1, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          await expectThrow(
            exchange.commitBlock(0, 2, web3.utils.hexToBytes(bs.getData()),
            {from: exchangeTestUtil.exchangeOperator}),
            "INVALID_EXCHANGE_ID",
          );
        });

        it("should not be able to commit blocks starting from a wrong merkle root state", async () => {
          await createExchange(false);
          await exchangeTestUtil.blockVerifier.setVerifyingKey(0, true, 2, new Array(18).fill(1));
          const bs = new pjs.Bitstream();
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(2)), 32);
          await expectThrow(
            exchange.commitBlock(0, 2, web3.utils.hexToBytes(bs.getData()),
            {from: exchangeTestUtil.exchangeOperator}),
            "INVALID_MERKLE_ROOT",
          );
        });

        it("should not be able to commit settlement blocks with an invalid timestamp", async () => {
          await createExchange(false);
          await exchangeTestUtil.blockVerifier.setVerifyingKey(
            BlockType.RING_SETTLEMENT, true, 2, new Array(18).fill(1),
          );
          // Timestamp too early
          {
            let timestamp = (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp;
            timestamp -= (exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1);
            const bs = new pjs.Bitstream();
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            await expectThrow(
              exchange.commitBlock(BlockType.RING_SETTLEMENT, 2, web3.utils.hexToBytes(bs.getData()),
              {from: exchangeTestUtil.exchangeOperator}),
              "INVALID_TIMESTAMP",
            );
          }
          // Timestamp too late
          {
            let timestamp = (await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp;
            timestamp += (exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 15);
            const bs = new pjs.Bitstream();
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            await expectThrow(
              exchange.commitBlock(BlockType.RING_SETTLEMENT, 2, web3.utils.hexToBytes(bs.getData()),
              {from: exchangeTestUtil.exchangeOperator}),
              "INVALID_TIMESTAMP",
            );
          }
        });

        it("should not be able to commit deposit/on-chain withdrawal blocks with invalid data", async () => {
          await createExchange(false);
          await exchangeTestUtil.blockVerifier.setVerifyingKey(
            BlockType.DEPOSIT, false, 2, new Array(18).fill(1),
          );
          await exchangeTestUtil.blockVerifier.setVerifyingKey(
            BlockType.DEPOSIT, false, 8, new Array(18).fill(1),
          );
          await exchangeTestUtil.blockVerifier.setVerifyingKey(
            BlockType.ONCHAIN_WITHDRAWAL, false, 2, new Array(18).fill(1),
          );
          await exchangeTestUtil.blockVerifier.setVerifyingKey(
            BlockType.ONCHAIN_WITHDRAWAL, false, 8, new Array(18).fill(1),
          );
          const numRequests = 4;
          // Do some deposit
          const fees = await exchange.getFees();
          const keyPair = exchangeTestUtil.getKeyPairEDDSA();
          const owner = exchangeTestUtil.testContext.orderOwners[0];
          const token = exchangeTestUtil.getTokenAddress("LRC");
          const amount = new BN(web3.utils.toWei("3", "ether"));
          // Deposits
          for (let i = 0; i < numRequests; i++) {
            await exchangeTestUtil.deposit(exchangeId, owner,
                                           keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                           token, amount);
          }
          // On-chain withdrawals
          for (let i = 0; i < numRequests; i++) {
            await exchange.withdraw(token, amount, {from: owner, value: fees._withdrawalFeeETH});
          }

          const blockTypes = [BlockType.DEPOSIT, BlockType.ONCHAIN_WITHDRAWAL];
          for (const blockType of blockTypes) {
            let startIndex = 0;
            let startingHash = "0x0";
            if (blockType === BlockType.DEPOSIT) {
              startIndex = (await exchange.getNumDepositRequestsProcessed()).toNumber();
              const firstRequestData = await exchange.getDepositRequest(startIndex - 1);
              startingHash = firstRequestData.accumulatedHash;
            } else {
              startIndex = (await exchange.getNumDepositRequestsProcessed()).toNumber();
              const firstRequestData = await exchange.getWithdrawRequest(startIndex - 1);
              startingHash = firstRequestData.accumulatedHash;
            }

            // startIdx != numRequestsCommitted
            {
              const bs = new pjs.Bitstream();
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN((new BN(startingHash.slice(2), 16)).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex + 1, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(blockType, 2, web3.utils.hexToBytes(bs.getData()),
                {from: exchangeTestUtil.exchangeOperator}),
                "INVALID_REQUEST_RANGE",
              );
            }
            // count > numElements
            {
              const bs = new pjs.Bitstream();
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN((new BN(startingHash.slice(2), 16)).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(4, 4);
              await expectThrow(
                exchange.commitBlock(blockType, 2, web3.utils.hexToBytes(bs.getData()),
                {from: exchangeTestUtil.exchangeOperator}),
                "INVALID_REQUEST_RANGE",
              );
            }
            // startIdx + count > depositChain.length
            {
              const bs = new pjs.Bitstream();
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN((new BN(startingHash.slice(2), 16)).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(8, 4);
              await expectThrow(
                exchange.commitBlock(blockType, 8, web3.utils.hexToBytes(bs.getData()),
                {from: exchangeTestUtil.exchangeOperator}),
                "INVALID_REQUEST_RANGE",
              );
            }
            // Wrong starting hash
            {
              const bs = new pjs.Bitstream();
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(123), 32);
              bs.addBN(new BN(123), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(blockType, 2, web3.utils.hexToBytes(bs.getData()),
                {from: exchangeTestUtil.exchangeOperator}),
                "INVALID_STARTING_HASH",
              );
            }
            // Wrong ending hash
            {
              const bs = new pjs.Bitstream();
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(blockType, 2, web3.utils.hexToBytes(bs.getData()),
                {from: exchangeTestUtil.exchangeOperator}),
                "INVALID_ENDING_HASH",
              );
            }
          }
        });

        it("On-chain requests should be forced after MAX_AGE_REQUEST_UNTIL_FORCED", async () => {
          await createExchange();
          // Prepare a ring
          const ring = await setupRandomRing();
          // Do a deposit
          const deposit = await exchangeTestUtil.doRandomDeposit(5);
          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED + 1);
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "DEPOSIT_BLOCK_FORCED",
          );
          // Now also do an on-chain withdrawal
          const accountID = await exchangeTestUtil.getAccountID(ring.orderA.owner);
          await exchangeTestUtil.requestWithdrawalOnchain(
            exchangeId, accountID, "ETH", new BN(123), ring.orderA.owner,
          );
          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED + 1);
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "WITHDRAWAL_BLOCK_FORCED",
          );
          // Commit the withdrawals
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "DEPOSIT_BLOCK_FORCED",
          );
          // Commit the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          // Commit the rings
          await exchangeTestUtil.commitRings(exchangeId);
        });
      });

      describe("verifyBlock", () => {
        it("should be able to verify blocks in any order", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          // Store all pending blocks
          const blocks: Block[] = [];
          for (const block of exchangeTestUtil.pendingBlocks[exchangeId]) {
            blocks.push(block);
          }
          // Randomize the order in which the blocks are verified
          exchangeTestUtil.shuffle(blocks);
          // Verify all blocks
          for (const block of blocks) {
            await exchangeTestUtil.verifyBlock(block.blockIdx, block.filename);
          }
          const numBlocks = (await exchange.getBlockHeight()).toNumber();
          const numBlocksFinalized = (await exchange.getNumBlocksFinalized()).toNumber();
          assert.equal(numBlocksFinalized, numBlocks, "all blocks should be finalized");
        });

        it("should not be able to verify a block more than once", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          // Store all pending blocks
          const blocks: Block[] = [];
          for (const block of exchangeTestUtil.pendingBlocks[exchangeId]) {
            blocks.push(block);
          }
          // Verify all blocks
          for (const block of blocks) {
            await exchangeTestUtil.verifyBlock(block.blockIdx, block.filename);
          }
          // Try to verify all blocks agains
          for (const block of blocks) {
            await expectThrow(
              exchangeTestUtil.verifyBlock(block.blockIdx, block.filename),
              "BLOCK_VERIFIED_ALREADY",
            );
          }
        });

        it("should not be able to verify a block too late", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          // Store all pending blocks
          const blocks: Block[] = [];
          for (const block of exchangeTestUtil.pendingBlocks[exchangeId]) {
            blocks.push(block);
          }
          // Wait
          exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_PROOF_GENERATION_TIME_IN_SECONDS + 1);
          // Try to verify the blocks
          for (const block of blocks) {
            await expectThrow(
              exchangeTestUtil.verifyBlock(block.blockIdx, block.filename),
              "PROOF_TOO_LATE",
            );
          }
        });

        it("should not be able to verify a block with an invalid proof", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          // Store all pending blocks
          const blocks: Block[] = [];
          for (const block of exchangeTestUtil.pendingBlocks[exchangeId]) {
            blocks.push(block);
          }
          // Try to verify the blocks
          for (const block of blocks) {
            await expectThrow(
              exchange.verifyBlock(block.blockIdx, new Array(8).fill(new BN(123)),
              {from: exchangeTestUtil.exchangeOperator}),
            );
          }
        });
      });

      describe("revertBlock", () => {
        it("Revert", async () => {
          await createExchange();
          const ring: RingInfo = {
            orderA:
              {
                realmID: exchangeId,
                tokenS: "WETH",
                tokenB: "GTO",
                amountS: new BN(web3.utils.toWei("100", "ether")),
                amountB: new BN(web3.utils.toWei("10", "ether")),
                amountF: new BN(web3.utils.toWei("1", "ether")),
              },
            orderB:
              {
                realmID: exchangeId,
                tokenS: "GTO",
                tokenB: "WETH",
                amountS: new BN(web3.utils.toWei("5", "ether")),
                amountB: new BN(web3.utils.toWei("45", "ether")),
                amountF: new BN(web3.utils.toWei("3", "ether")),
              },
          };
          await exchangeTestUtil.setupRing(ring);
          const blocksVerified = await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Try to revert proven blocks
          for (const block of blocksVerified) {
            await expectThrow(
              exchangeTestUtil.revertBlock(block.blockIdx),
              "INVALID_BLOCK_STATE",
            );
          }

          const keyPair = exchangeTestUtil.getKeyPairEDDSA();
          const owner = exchangeTestUtil.testContext.orderOwners[0];
          const token = "LRC";
          const balance = new BN(web3.utils.toWei("7.1", "ether"));

          const depositInfo = await exchangeTestUtil.deposit(exchangeId, owner,
                                                             keyPair.secretKey, keyPair.publicKeyX, keyPair.publicKeyY,
                                                             token, balance);
          const pendingDeposits = exchangeTestUtil.getPendingDeposits(exchangeId);

          const blocksA = await exchangeTestUtil.commitDeposits(exchangeId, pendingDeposits);
          assert(blocksA.length === 1);

          // Try to notify too early
          await expectThrow(
            exchangeTestUtil.revertBlock(blocksA[0].blockIdx),
            "PROOF_NOT_TOO_LATE",
          );

          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(exchangeTestUtil.MAX_PROOF_GENERATION_TIME_IN_SECONDS + 1);

          // Revert the block again, now correctly
          await revertBlockChecked(blocksA[0]);

          // Now commit the deposits again
          const blockIndicesB = await exchangeTestUtil.commitDeposits(exchangeId, pendingDeposits);
          assert(blockIndicesB.length === 1);

          // Submit some other work
          await exchangeTestUtil.sendRing(exchangeId, ring);
          await exchangeTestUtil.commitRings(exchangeId);

          // Verify all blocks
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);
        });
      });

      describe("Block fee", () => {
        it("Withdraw block fee (deposit block - in time)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some deposits
          const numDeposits = exchangeTestUtil.depositBlockSizes[0];
          const deposits: DepositInfo[] = [];
          let blockFee = new BN(0);
          for (let i = 0; i < numDeposits; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            deposits.push(deposit);
            blockFee = blockFee.add(deposit.fee);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          const blockIdx = await exchange.getBlockHeight();

          // Try to withdraw before the block is finalized
          await expectThrow(
            exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
            "BLOCK_NOT_FINALIZED",
          );

          // Finalize the block containing the deposits
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the block fee
          await withdrawBlockFeeChecked(
            blockIdx, exchangeTestUtil.exchangeOperator,
            blockFee, blockFee,
          );

          // Try to withdraw again
          await expectThrow(
            exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
            "FEE_WITHDRAWN_ALREADY",
          );
        });

        it("Withdraw block fee (deposit block - fined)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some deposits
          const numDeposits = exchangeTestUtil.depositBlockSizes[0];
          const deposits: DepositInfo[] = [];
          let blockFee = new BN(0);
          for (let i = 0; i < numDeposits; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            deposits.push(deposit);
            blockFee = blockFee.add(deposit.fee);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
                            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (half the complete block fee)
          const blockIdx = await exchange.getBlockHeight();
          await withdrawBlockFeeChecked(
            blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
            blockFee.div(new BN(2)), blockFee.div(new BN(100)),
          );
        });

        it("Withdraw block fee (deposit block - no reward)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some deposits
          const numDeposits = exchangeTestUtil.depositBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numDeposits; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            blockFee = blockFee.add(deposit.fee);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
                            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION + 1000;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (everything burned)
          const blockIdx = await exchange.getBlockHeight();
          await withdrawBlockFeeChecked(
            blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
            new BN(0),
          );
        });

        it("Withdraw block fee (withdrawal block - fined)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals = exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(deposit);
            blockFee = blockFee.add(withdrawal.withdrawalFee);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
                            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (half the complete block fee)
          const blockIdx = await exchange.getBlockHeight();
          await withdrawBlockFeeChecked(
            blockIdx, exchangeTestUtil.exchangeOperator, blockFee,
            blockFee.div(new BN(2)), blockFee.div(new BN(100)),
          );
        });

        it("should not be able to withdraw a block fee of a block type without a block fee", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals = exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            await exchangeTestUtil.doRandomOffchainWithdrawal(deposit);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
                            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Try to withdraw a block fee from a  block type doesn't have any
          const blockIdx = await exchange.getBlockHeight();
          await expectThrow(
            exchange.withdrawBlockFee(blockIdx, {from: exchangeTestUtil.exchangeOperator}),
            "BLOCK_HAS_NO_OPERATOR_FEE",
          );
        });
      });

    });

    describe("anyone", () => {
      it("shouldn't be able to commit blocks", async () => {
        await createExchange();
        // Try to commit a block
        await expectThrow(
          exchange.commitBlock(0, 2, web3.utils.hexToBytes("0x0"),
          {from: exchangeTestUtil.testContext.orderOwners[0]}),
          "UNAUTHORIZED",
        );
      });

      it("shouldn't be able to verify blocks", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.verifyBlock(1, [0, 0, 0, 0, 0, 0, 0, 0],
          {from: exchangeTestUtil.testContext.orderOwners[0]}),
          "UNAUTHORIZED",
        );
      });

      it("shouldn't be able to revert blocks", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.revertBlock(1,
          {from: exchangeTestUtil.testContext.orderOwners[0]}),
          "UNAUTHORIZED",
        );
      });

      it("shouldn't be able to withdraw the block fee", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.withdrawBlockFee(1,
            {from: exchangeTestUtil.testContext.orderOwners[0]}),
          "UNAUTHORIZED",
        );
      });
    });

  });
});
