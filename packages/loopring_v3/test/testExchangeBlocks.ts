import BN = require("bn.js");
import { Bitstream, BlockType, Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, DepositInfo, RingInfo } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;
  let exchange: any;
  let loopring: any;
  let blockVersionGenerator = 128;

  const createExchange = async (bSetupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
    loopring = exchangeTestUtil.loopringV3;
  };

  const setupRandomRing = async (send: boolean = true) => {
    const ring: RingInfo = {
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
      },
      expected: {
        orderA: { filledFraction: 1.0, spread: new BN(0) },
        orderB: { filledFraction: 1.0 }
      }
    };
    await exchangeTestUtil.setupRing(ring);
    await exchangeTestUtil.commitDeposits(exchangeId);
    if (send) {
      await exchangeTestUtil.sendRing(exchangeId, ring);
    }
    return ring;
  };

  const commitSomeWork = async () => {
    await setupRandomRing();
    await exchangeTestUtil.commitRings(exchangeId);
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Blocks", function() {
    this.timeout(0);

    describe("Operator 3", () => {
      describe("commitBlock", () => {
        it("should not be able to commit unsupported blocks", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const bs = new Bitstream();
          bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          await expectThrow(
            exchange.commitBlock(
              0,
              1,
              blockVersion + 1,
              web3.utils.hexToBytes(bs.getData()),
              Constants.emptyBytes,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "CANNOT_VERIFY_BLOCK"
          );
        });

        it("should not be able to commit block from different exchanges", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const bs = new Bitstream();
          bs.addNumber(0, 1);
          bs.addNumber(exchangeId + 1, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          await expectThrow(
            exchange.commitBlock(
              0,
              2,
              blockVersion,
              web3.utils.hexToBytes(bs.getData()),
              Constants.emptyBytes,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "INVALID_EXCHANGE_ID"
          );
        });

        it("should not be able to commit blocks starting from a wrong merkle root state", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const bs = new Bitstream();
          bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(2)), 32);
          await expectThrow(
            exchange.commitBlock(
              0,
              2,
              blockVersion,
              web3.utils.hexToBytes(bs.getData()),
              Constants.emptyBytes,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "INVALID_MERKLE_ROOT"
          );
        });

        it("should not be able to commit blocks with an invalid new Merkle root", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.RING_SETTLEMENT,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          {
            let timestamp = (await web3.eth.getBlock(
              await web3.eth.getBlockNumber()
            )).timestamp;
            timestamp -=
              exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1;
            const bs = new Bitstream();
            bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.SNARK_SCALAR_FIELD, 32);
            bs.addNumber(timestamp, 4);
            await expectThrow(
              exchange.commitBlock(
                BlockType.RING_SETTLEMENT,
                2,
                blockVersion,
                web3.utils.hexToBytes(bs.getData()),
                Constants.emptyBytes,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_MERKLE_ROOT"
            );
          }
        });

        it("should not be able to commit settlement blocks with an invalid timestamp", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.RING_SETTLEMENT,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          // Timestamp too early
          {
            let timestamp = (await web3.eth.getBlock(
              await web3.eth.getBlockNumber()
            )).timestamp;
            timestamp -=
              exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1;
            const bs = new Bitstream();
            bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            await expectThrow(
              exchange.commitBlock(
                BlockType.RING_SETTLEMENT,
                2,
                blockVersion,
                web3.utils.hexToBytes(bs.getData()),
                Constants.emptyBytes,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_TIMESTAMP"
            );
          }
          // Timestamp too late
          {
            let timestamp = (await web3.eth.getBlock(
              await web3.eth.getBlockNumber()
            )).timestamp;
            timestamp +=
              exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 15;
            const bs = new Bitstream();
            bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            await expectThrow(
              exchange.commitBlock(
                BlockType.RING_SETTLEMENT,
                2,
                blockVersion,
                web3.utils.hexToBytes(bs.getData()),
                Constants.emptyBytes,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_TIMESTAMP"
            );
          }
        });

        it("should not be able to commit settlement blocks with invalid protocol fees", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.RING_SETTLEMENT,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.onchainDataAvailability
          );
          const timestamp = (await web3.eth.getBlock(
            await web3.eth.getBlockNumber()
          )).timestamp;
          // Invalid taker protocol fee
          {
            const bs = new Bitstream();
            bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips.add(new BN(1)), 1);
            bs.addNumber(protocolFees.makerFeeBips, 1);
            await expectThrow(
              exchange.commitBlock(
                BlockType.RING_SETTLEMENT,
                2,
                blockVersion,
                web3.utils.hexToBytes(bs.getData()),
                Constants.emptyBytes,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_PROTOCOL_FEES"
            );
          }
          // Invalid maker protocol fee
          {
            const bs = new Bitstream();
            bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips, 1);
            bs.addNumber(protocolFees.makerFeeBips.add(new BN(1)), 1);
            await expectThrow(
              exchange.commitBlock(
                BlockType.RING_SETTLEMENT,
                2,
                blockVersion,
                web3.utils.hexToBytes(bs.getData()),
                Constants.emptyBytes,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_PROTOCOL_FEES"
            );
          }
        });

        it("should not be able to commit deposit/on-chain withdrawal blocks with invalid data", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.DEPOSIT,
            false,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.DEPOSIT,
            false,
            8,
            blockVersion,
            new Array(18).fill(1)
          );
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.ONCHAIN_WITHDRAWAL,
            false,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.ONCHAIN_WITHDRAWAL,
            false,
            8,
            blockVersion,
            new Array(18).fill(1)
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
            await exchangeTestUtil.deposit(
              exchangeId,
              owner,
              keyPair.secretKey,
              keyPair.publicKeyX,
              keyPair.publicKeyY,
              token,
              amount
            );
          }
          // On-chain withdrawals
          for (let i = 0; i < numRequests; i++) {
            await exchange.withdraw(token, amount, {
              from: owner,
              value: fees._withdrawalFeeETH
            });
          }

          const blockTypes = [BlockType.DEPOSIT, BlockType.ONCHAIN_WITHDRAWAL];
          for (const blockType of blockTypes) {
            let startIndex = 0;
            let startingHash = "0x0";
            if (blockType === BlockType.DEPOSIT) {
              startIndex = (await exchange.getNumDepositRequestsProcessed()).toNumber();
              const firstRequestData = await exchange.getDepositRequest(
                startIndex - 1
              );
              startingHash = firstRequestData.accumulatedHash;
            } else {
              startIndex = (await exchange.getNumDepositRequestsProcessed()).toNumber();
              const firstRequestData = await exchange.getWithdrawRequest(
                startIndex - 1
              );
              startingHash = firstRequestData.accumulatedHash;
            }

            // startIdx != numRequestsCommitted
            {
              const bs = new Bitstream();
              bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex + 1, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(
                  blockType,
                  2,
                  blockVersion,
                  web3.utils.hexToBytes(bs.getData()),
                  Constants.emptyBytes,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // count > blockSize
            {
              const bs = new Bitstream();
              bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(4, 4);
              await expectThrow(
                exchange.commitBlock(
                  blockType,
                  2,
                  blockVersion,
                  web3.utils.hexToBytes(bs.getData()),
                  Constants.emptyBytes,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // startIdx + count > depositChain.length
            {
              const bs = new Bitstream();
              bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(8, 4);
              await expectThrow(
                exchange.commitBlock(
                  blockType,
                  8,
                  blockVersion,
                  web3.utils.hexToBytes(bs.getData()),
                  Constants.emptyBytes,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // Wrong starting hash
            {
              const bs = new Bitstream();
              bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(123), 32);
              bs.addBN(new BN(123), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(
                  blockType,
                  2,
                  blockVersion,
                  web3.utils.hexToBytes(bs.getData()),
                  Constants.emptyBytes,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_STARTING_HASH"
              );
            }
            // Wrong ending hash
            {
              const bs = new Bitstream();
              bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              await expectThrow(
                exchange.commitBlock(
                  blockType,
                  2,
                  blockVersion,
                  web3.utils.hexToBytes(bs.getData()),
                  Constants.emptyBytes,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_ENDING_HASH"
              );
            }
          }
        });

        it("On-chain requests should be forced after MAX_AGE_REQUEST_UNTIL_FORCED", async () => {
          await createExchange();
          const operatorAccountId = await exchangeTestUtil.getActiveOperator(
            exchangeId
          );
          const operatorAccount =
            exchangeTestUtil.accounts[exchangeId][operatorAccountId];
          // Prepare a ring
          const ring = await setupRandomRing();
          // Do a deposit
          const deposit = await exchangeTestUtil.doRandomDeposit(5);
          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(
            exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED + 1
          );
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "DEPOSIT_BLOCK_FORCED"
          );
          // Revert the nonce of the operator
        });

        it("On-chain requests should be forced after MAX_AGE_REQUEST_UNTIL_FORCED", async () => {
          await createExchange();
          const operatorAccountId = await exchangeTestUtil.getActiveOperator(
            exchangeId
          );
          const operatorAccount =
            exchangeTestUtil.accounts[exchangeId][operatorAccountId];
          // Prepare a ring
          const ring = await setupRandomRing();

          const deposit = await exchangeTestUtil.doRandomDeposit(5);

          const accountID = await exchangeTestUtil.getAccountID(
            ring.orderA.owner
          );
          await exchangeTestUtil.requestWithdrawalOnchain(
            exchangeId,
            accountID,
            "ETH",
            new BN(123),
            ring.orderA.owner
          );
          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(
            exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED + 1
          );
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "WITHDRAWAL_BLOCK_FORCED"
          );

          operatorAccount.nonce--;
          // Commit the withdrawals
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          // Try to commit the rings
          await expectThrow(
            exchangeTestUtil.commitRings(exchangeId),
            "DEPOSIT_BLOCK_FORCED"
          );
          // Revert the nonce of the operator
          operatorAccount.nonce--;
          // Commit the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          // Commit the rings
          await exchangeTestUtil.commitRings(exchangeId);
        });
      });

      describe("verifyBlocks", () => {
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
            await exchangeTestUtil.verifyBlocks([block]);
          }
          const numBlocks = await exchangeTestUtil.getNumBlocksOnchain();
          const numBlocksFinalized = await exchangeTestUtil.getNumBlocksFinalizedOnchain();
          assert.equal(
            numBlocksFinalized,
            numBlocks,
            "all blocks should be finalized"
          );
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
            await exchangeTestUtil.verifyBlocks([block]);
          }
          // Try to verify all blocks agains
          for (const block of blocks) {
            await expectThrow(
              exchangeTestUtil.verifyBlocks([block]),
              "BLOCK_VERIFIED_ALREADY"
            );
          }
        });

        it("should be able to verify multiple blocks using the same circuit", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          const count = 11;
          // Setup several rings
          const rings: RingInfo[] = [];
          for (let i = 0; i < count; i++) {
            const ring = await setupRandomRing(false);
            rings.push(ring);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Commit several ring settlement blocks
          const blocks: Block[] = [];
          for (const ring of rings) {
            await exchangeTestUtil.sendRing(exchangeId, ring);
            const settlementBlocks = await exchangeTestUtil.commitRings(
              exchangeId
            );
            assert(
              settlementBlocks.length === 1,
              "unexpected number of blocks committed"
            );
            blocks.push(settlementBlocks[0]);
          }

          // Randomize the order in which the blocks are verified
          exchangeTestUtil.shuffle(blocks);

          // Verify all blocks at once
          await exchangeTestUtil.verifyBlocks(blocks);

          const numBlocks = await exchangeTestUtil.getNumBlocksOnchain();
          const numBlocksFinalized = await exchangeTestUtil.getNumBlocksFinalizedOnchain();
          assert.equal(
            numBlocksFinalized,
            numBlocks,
            "all blocks should be finalized"
          );
        });

        it("should not be able to verify multiple blocks when one of the proofs is incorrect", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          const count = 7;
          // Setup several rings
          const rings: RingInfo[] = [];
          for (let i = 0; i < count; i++) {
            const ring = await setupRandomRing(false);
            rings.push(ring);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Commit several ring settlement blocks
          const blocks: Block[] = [];
          for (const ring of rings) {
            await exchangeTestUtil.sendRing(exchangeId, ring);
            const settlementBlocks = await exchangeTestUtil.commitRings(
              exchangeId
            );
            assert(
              settlementBlocks.length === 1,
              "unexpected number of blocks committed"
            );
            blocks.push(settlementBlocks[0]);
          }

          // Randomize the order in which the blocks are verified
          exchangeTestUtil.shuffle(blocks);

          // Verify all blocks at once, but change a single proof element so it's invalid
          exchangeTestUtil.commitWrongProofOnce = true;
          await expectThrow(
            exchangeTestUtil.verifyBlocks(blocks),
            "INVALID_PROOF"
          );
        });

        it("should not be able to verify multiple blocks using different circuits", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // This will create and commit deposit and ring settlement blocks
          await setupRandomRing();
          await exchangeTestUtil.commitRings(exchangeId);

          const blocks = exchangeTestUtil.pendingBlocks[exchangeId];
          assert(blocks.length >= 2, "unexpected number of blocks");

          // Randomize the order in which the blocks are verified
          exchangeTestUtil.shuffle(blocks);

          // Verify all blocks at once
          await expectThrow(
            exchangeTestUtil.verifyBlocks(blocks),
            "INVALID_BATCH_BLOCK_TYPE"
          );
        });

        it("should not be able to verify the same block twice in a single call", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          const ring = await setupRandomRing(false);
          await exchangeTestUtil.commitDeposits(exchangeId);

          await exchangeTestUtil.sendRing(exchangeId, ring);
          const blocks = await exchangeTestUtil.commitRings(exchangeId);
          assert(blocks.length === 1, "unexpected number of blocks");

          // Verify the same block twice
          await expectThrow(
            exchangeTestUtil.verifyBlocks([blocks[0], blocks[0]]),
            "BLOCK_VERIFIED_ALREADY"
          );
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
          exchangeTestUtil.advanceBlockTimestamp(
            exchangeTestUtil.MAX_PROOF_GENERATION_TIME_IN_SECONDS + 1
          );
          // Try to verify the blocks
          for (const block of blocks) {
            await expectThrow(
              exchangeTestUtil.verifyBlocks([block]),
              "PROOF_TOO_LATE"
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
              exchange.verifyBlocks(
                [block.blockIdx],
                new Array(8).fill(new BN(123)),
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_PROOF"
            );
          }
        });

        it("should not be able to verify a block with incorrect public data", async () => {
          await createExchange();
          const ring: RingInfo = {
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
            },
            expected: {
              orderA: { filledFraction: 1.0, spread: new BN(0) },
              orderB: { filledFraction: 1.0 }
            }
          };

          await exchangeTestUtil.setupRing(ring);
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          await exchangeTestUtil.sendRing(exchangeId, ring);

          exchangeTestUtil.commitWrongPublicDataOnce = true;
          await exchangeTestUtil.commitRings(exchangeId);

          await expectThrow(
            exchangeTestUtil.verifyPendingBlocks(exchangeId),
            "INVALID_PROOF"
          );
        });

        it("should not be able to verify blocks with wrong call input format", async () => {
          await createExchange();

          await expectThrow(
            exchange.verifyBlocks([], [], {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_INPUT_ARRAYS"
          );
          await expectThrow(
            exchange.verifyBlocks([1, 2], new Array(15).fill(123), {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_PROOF_ARRAY"
          );
          await expectThrow(
            exchange.verifyBlocks([1, 2], new Array(3 * 8).fill(123), {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_INPUT_ARRAYS"
          );
        });
      });

      describe("revertBlock", () => {
        it("Revert", async () => {
          await createExchange();
          const ring: RingInfo = {
            orderA: {
              tokenS: "WETH",
              tokenB: "GTO",
              amountS: new BN(web3.utils.toWei("100", "ether")),
              amountB: new BN(web3.utils.toWei("10", "ether")),
              owner: exchangeTestUtil.testContext.orderOwners[0]
            },
            orderB: {
              tokenS: "GTO",
              tokenB: "WETH",
              amountS: new BN(web3.utils.toWei("5", "ether")),
              amountB: new BN(web3.utils.toWei("45", "ether")),
              owner: exchangeTestUtil.testContext.orderOwners[1]
            }
          };
          await exchangeTestUtil.setupRing(ring);
          const blocksVerified = await exchangeTestUtil.commitDeposits(
            exchangeId
          );
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Try to revert proven blocks
          for (const block of blocksVerified) {
            await expectThrow(
              exchangeTestUtil.revertBlock(block.blockIdx),
              "INVALID_BLOCK_STATE"
            );
          }

          const keyPair = exchangeTestUtil.getKeyPairEDDSA();
          const owner = exchangeTestUtil.testContext.orderOwners[2];
          const token = "LRC";
          const balance = new BN(web3.utils.toWei("7.1", "ether"));

          const depositInfo = await exchangeTestUtil.deposit(
            exchangeId,
            owner,
            keyPair.secretKey,
            keyPair.publicKeyX,
            keyPair.publicKeyY,
            token,
            balance
          );
          const pendingDeposits = exchangeTestUtil.getPendingDeposits(
            exchangeId
          );

          const blocksA = await exchangeTestUtil.commitDeposits(
            exchangeId,
            pendingDeposits
          );
          assert(blocksA.length === 1);

          // Revert the block again, now correctly
          await exchangeTestUtil.revertBlock(blocksA[0].blockIdx);

          // Try to commit a block without adding to the stake
          await expectThrow(
            exchangeTestUtil.commitDeposits(exchangeId, pendingDeposits),
            "INSUFFICIENT_EXCHANGE_STAKE"
          );

          // Deposit extra LRC to stake for the exchange
          const depositer = exchangeTestUtil.testContext.operators[2];
          const stakeAmount = await loopring.revertFineLRC();
          await exchangeTestUtil.setBalanceAndApprove(
            depositer,
            "LRC",
            stakeAmount,
            loopring.address
          );
          await loopring.depositExchangeStake(exchangeId, stakeAmount, {
            from: depositer
          });

          // Now commit the deposits again
          const blockIndicesB = await exchangeTestUtil.commitDeposits(
            exchangeId,
            pendingDeposits
          );
          assert(blockIndicesB.length === 1);

          // Submit some other work
          // exchangeTestUtil.signRing(ring);
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
          const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;

          // Try to withdraw before the block is finalized
          await expectThrow(
            exchange.withdrawBlockFee(
              blockIdx,
              exchangeTestUtil.exchangeOperator,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "BLOCK_NOT_FINALIZED"
          );

          // Finalize the block containing the deposits
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the block fee
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            blockFee,
            new BN(0)
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
          const addedTime =
            exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (half the complete block fee)
          const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            blockFee.div(new BN(2)),
            blockFee.div(new BN(100))
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
          const addedTime =
            exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION +
            1000;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (everything burned)
          const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            new BN(0),
            new BN(0)
          );
        });

        it("Withdraw block fee (withdrawal block - in time)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(
              deposit
            );
            blockFee = blockFee.add(withdrawal.withdrawalFee);
          }

          // Wait a bit until a bit before the block fee is reduced
          const addedTime = exchangeTestUtil.FEE_BLOCK_FINE_START_TIME - 100;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee
          const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            blockFee,
            new BN(0)
          );
        });

        it("Withdraw block fee (withdrawal block - fined)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(
              deposit
            );
            blockFee = blockFee.add(withdrawal.withdrawalFee);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime =
            exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (half the complete block fee)
          const blockIdx =
            (await exchangeTestUtil.getNumBlocksOnchain()) - 1 - 1;
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            blockFee.div(new BN(2)),
            blockFee.div(new BN(100))
          );
        });

        it("Withdraw block fee (withdrawal block - no reward)", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          let blockFee = new BN(0);
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            const withdrawal = await exchangeTestUtil.doRandomOnchainWithdrawal(
              deposit
            );
            blockFee = blockFee.add(withdrawal.withdrawalFee);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime =
            exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION * 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Withdraw the blockFee (half the complete block fee)
          const blockIdx =
            (await exchangeTestUtil.getNumBlocksOnchain()) - 1 - 1;
          await exchangeTestUtil.withdrawBlockFeeChecked(
            blockIdx,
            exchangeTestUtil.exchangeOperator,
            blockFee,
            new BN(0),
            new BN(0)
          );
        });

        it("should not be able to withdraw a block fee of a block type without a block fee", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Do some withdrawals
          const numWithdrawals =
            exchangeTestUtil.onchainWithdrawalBlockSizes[0];
          for (let i = 0; i < numWithdrawals; i++) {
            const deposit = await exchangeTestUtil.doRandomDeposit();
            await exchangeTestUtil.doRandomOffchainWithdrawal(deposit);
          }

          // Wait a bit until the operator only gets half the block fee
          const addedTime =
            exchangeTestUtil.FEE_BLOCK_FINE_START_TIME +
            exchangeTestUtil.FEE_BLOCK_FINE_MAX_DURATION / 2;
          await exchangeTestUtil.advanceBlockTimestamp(addedTime);

          // Commit and verify the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.commitOffchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.verifyPendingBlocks(exchangeId);

          // Try to withdraw a block fee from a  block type doesn't have any
          const blockIdx = (await exchangeTestUtil.getNumBlocksOnchain()) - 1;
          await expectThrow(
            exchange.withdrawBlockFee(
              blockIdx,
              exchangeTestUtil.exchangeOperator,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "BLOCK_HAS_NO_OPERATOR_FEE"
          );
        });
      });
    });

    describe("anyone", () => {
      it("shouldn't be able to commit blocks", async () => {
        await createExchange();
        // Try to commit a block
        await expectThrow(
          exchange.commitBlock(
            0,
            2,
            0,
            web3.utils.hexToBytes("0x0"),
            Constants.emptyBytes,
            { from: exchangeTestUtil.testContext.orderOwners[0] }
          ),
          "UNAUTHORIZED"
        );
      });

      it("shouldn't be able to verify blocks", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.verifyBlocks([1], [0, 0, 0, 0, 0, 0, 0, 0], {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });

      it("shouldn't be able to revert blocks", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.revertBlock(1, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });

      it("shouldn't be able to withdraw the block fee", async () => {
        await createExchange();
        // Try to verify a block
        await expectThrow(
          exchange.withdrawBlockFee(1, exchangeTestUtil.exchangeOperator, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
