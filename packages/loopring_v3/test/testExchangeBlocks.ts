import BN = require("bn.js");
import { Bitstream, BlockType, Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
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
          //bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          const block: OnchainBlock = {
            blockType: 0,
            blockSize: 1,
            blockVersion: blockVersion + 1,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
              from: exchangeTestUtil.exchangeOperator
            }),
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
          //bs.addNumber(0, 1);
          bs.addNumber(exchangeId + 1, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          const block: OnchainBlock = {
            blockType: 0,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
              from: exchangeTestUtil.exchangeOperator
            }),
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
          console.log(exchangeId);
          const bs = new Bitstream();
          //bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(2)), 32);
          const block: OnchainBlock = {
            blockType: 0,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
              from: exchangeTestUtil.exchangeOperator
            }),
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
          let timestamp = (await web3.eth.getBlock(
            await web3.eth.getBlockNumber()
          )).timestamp;
          timestamp -=
            exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1;
          const bs = new Bitstream();
          //bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.SNARK_SCALAR_FIELD, 32);
          bs.addNumber(timestamp, 4);
          const block: OnchainBlock = {
            blockType: BlockType.RING_SETTLEMENT,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_MERKLE_ROOT"
          );
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
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            const block: OnchainBlock = {
              blockType: BlockType.RING_SETTLEMENT,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              exchange.submitBlocks(
                [block],
                exchangeTestUtil.exchangeOperator,
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
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            const block: OnchainBlock = {
              blockType: BlockType.RING_SETTLEMENT,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              exchange.submitBlocks(
                [block],
                exchangeTestUtil.exchangeOperator,
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
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips.add(new BN(1)), 1);
            bs.addNumber(protocolFees.makerFeeBips, 1);
            const block: OnchainBlock = {
              blockType: BlockType.RING_SETTLEMENT,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              exchange.submitBlocks(
                [block],
                exchangeTestUtil.exchangeOperator,
                { from: exchangeTestUtil.exchangeOperator }
              ),
              "INVALID_PROTOCOL_FEES"
            );
          }
          // Invalid maker protocol fee
          {
            const bs = new Bitstream();
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips, 1);
            bs.addNumber(protocolFees.makerFeeBips.add(new BN(1)), 1);
            const block: OnchainBlock = {
              blockType: BlockType.RING_SETTLEMENT,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              exchange.submitBlocks(
                [block],
                exchangeTestUtil.exchangeOperator,
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
            await exchange.withdraw(owner, token, amount, {
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
              //bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex + 1, 4);
              bs.addNumber(2, 4);
              const block: OnchainBlock = {
                blockType,
                blockSize: 2,
                blockVersion: blockVersion,
                data: web3.utils.hexToBytes(bs.getData()),
                proof: [0, 0, 0, 0, 0, 0, 0, 0],
                offchainData: Constants.emptyBytes,
                auxiliaryData: Constants.emptyBytes
              };
              await expectThrow(
                exchange.submitBlocks(
                  [block],
                  exchangeTestUtil.exchangeOperator,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // count > blockSize
            {
              const bs = new Bitstream();
              //bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(4, 4);
              const block: OnchainBlock = {
                blockType,
                blockSize: 2,
                blockVersion: blockVersion,
                data: web3.utils.hexToBytes(bs.getData()),
                proof: [0, 0, 0, 0, 0, 0, 0, 0],
                offchainData: Constants.emptyBytes,
                auxiliaryData: Constants.emptyBytes
              };
              await expectThrow(
                exchange.submitBlocks(
                  [block],
                  exchangeTestUtil.exchangeOperator,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // startIdx + count > depositChain.length
            {
              const bs = new Bitstream();
              //bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16).add(new BN(1)), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(8, 4);
              const block: OnchainBlock = {
                blockType,
                blockSize: 8,
                blockVersion: blockVersion,
                data: web3.utils.hexToBytes(bs.getData()),
                proof: [0, 0, 0, 0, 0, 0, 0, 0],
                offchainData: Constants.emptyBytes,
                auxiliaryData: Constants.emptyBytes
              };
              await expectThrow(
                exchange.submitBlocks(
                  [block],
                  exchangeTestUtil.exchangeOperator,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_REQUEST_RANGE"
              );
            }
            // Wrong starting hash
            {
              const bs = new Bitstream();
              //bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(123), 32);
              bs.addBN(new BN(123), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              const block: OnchainBlock = {
                blockType,
                blockSize: 2,
                blockVersion: blockVersion,
                data: web3.utils.hexToBytes(bs.getData()),
                proof: [0, 0, 0, 0, 0, 0, 0, 0],
                offchainData: Constants.emptyBytes,
                auxiliaryData: Constants.emptyBytes
              };
              await expectThrow(
                exchange.submitBlocks(
                  [block],
                  exchangeTestUtil.exchangeOperator,
                  { from: exchangeTestUtil.exchangeOperator }
                ),
                "INVALID_STARTING_HASH"
              );
            }
            // Wrong ending hash
            {
              const bs = new Bitstream();
              //bs.addNumber(0, 1);
              bs.addNumber(exchangeId, 4);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
              bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
              bs.addBN(new BN(startingHash.slice(2), 16), 32);
              bs.addBN(new BN(0, 16), 32);
              bs.addNumber(startIndex, 4);
              bs.addNumber(2, 4);
              const block: OnchainBlock = {
                blockType,
                blockSize: 2,
                blockVersion: blockVersion,
                data: web3.utils.hexToBytes(bs.getData()),
                proof: [0, 0, 0, 0, 0, 0, 0, 0],
                offchainData: Constants.emptyBytes,
                auxiliaryData: Constants.emptyBytes
              };
              await expectThrow(
                exchange.submitBlocks(
                  [block],
                  exchangeTestUtil.exchangeOperator,
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
          await exchangeTestUtil.commitRings(exchangeId);
          // Try to submit the rings
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(exchangeId),
            "DEPOSIT_BLOCK_FORCED"
          );
          // Revert the nonce of the operator
        });

        it("On-chain requests should be forced after MAX_AGE_REQUEST_UNTIL_FORCED", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          // Do a deposit
          const deposit = await exchangeTestUtil.doRandomDeposit(5);
          // Do a withdrawal
          await exchangeTestUtil.requestWithdrawalOnchain(
            exchangeId,
            deposit.accountID,
            "ETH",
            new BN(123),
            deposit.owner
          );
          // Wait
          await exchangeTestUtil.advanceBlockTimestamp(
            exchangeTestUtil.MAX_AGE_REQUEST_UNTIL_FORCED + 1
          );
          // Try to submit trades
          const bs = new Bitstream();
          //bs.addNumber(0, 1);
          const merkleRoot = new BN(
            (await exchangeTestUtil.getMerkleRootOnchain()).slice(2),
            16
          );
          bs.addNumber(exchangeId, 4);
          bs.addBN(merkleRoot, 32);
          bs.addBN(merkleRoot.add(new BN(1)), 32);
          bs.addNumber(0, 4);
          const tradeBlock: OnchainBlock = {
            blockType: BlockType.RING_SETTLEMENT,
            blockSize: exchangeTestUtil.ringSettlementBlockSizes[0],
            blockVersion: 0,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await exchangeTestUtil.registerCircuit(
            tradeBlock.blockType,
            tradeBlock.blockSize,
            tradeBlock.blockVersion
          );
          await expectThrow(
            exchange.submitBlocks(
              [tradeBlock],
              exchangeTestUtil.exchangeOperator,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "WITHDRAWAL_BLOCK_FORCED"
          );

          // Commit the withdrawals
          await exchangeTestUtil.commitOnchainWithdrawalRequests(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);
          // Try to commit the rings again
          await expectThrow(
            exchange.submitBlocks(
              [tradeBlock],
              exchangeTestUtil.exchangeOperator,
              { from: exchangeTestUtil.exchangeOperator }
            ),
            "DEPOSIT_BLOCK_FORCED"
          );
          // Commit the deposits
          await exchangeTestUtil.commitDeposits(exchangeId);
          // Commit the rings
          await exchangeTestUtil.sendRing(
            exchangeId,
            exchangeTestUtil.dummyRing
          );
          await exchangeTestUtil.commitRings(exchangeId);
          // Submit the blocks
          await exchangeTestUtil.submitPendingBlocks(exchangeId);
        });
      });

      describe.skip("verifyBlocks", () => {
        it("should be able to verify submitted blocks in any order", async () => {
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
            await exchangeTestUtil.submitBlocks([block]);
          }
          const numBlocks = await exchangeTestUtil.getNumBlocksOnchain();
          assert.equal(
            exchangeTestUtil.blocks[exchangeId].length - 1,
            numBlocks,
            "all blocks should be submitted"
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
            await exchangeTestUtil.submitBlocks([block]);
          }
          // Try to verify all blocks agains
          for (const block of blocks) {
            await expectThrow(
              exchangeTestUtil.submitBlocks([block]),
              "BLOCK_VERIFIED_ALREADY"
            );
          }
        });

        it("should be able to verify multiple blocks using the same circuit", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          const count = 11;
          // Setup several rings
          const rings: RingInfo[] = [];
          for (let i = 0; i < count; i++) {
            const ring = await setupRandomRing(false);
            rings.push(ring);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

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
          await exchangeTestUtil.submitBlocks(blocks);

          const numBlocks = await exchangeTestUtil.getNumBlocksOnchain();
          assert.equal(
            exchangeTestUtil.blocks[exchangeId].length - 1,
            numBlocks,
            "all blocks should be submitted"
          );
        });

        it("should not be able to verify multiple blocks when one of the proofs is incorrect", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          const count = 7;
          // Setup several rings
          const rings: RingInfo[] = [];
          for (let i = 0; i < count; i++) {
            const ring = await setupRandomRing(false);
            rings.push(ring);
          }
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

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
            exchangeTestUtil.submitBlocks(blocks),
            "INVALID_PROOF"
          );
        });

        it("should not be able to verify multiple blocks using different circuits", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          // This will create and commit deposit and ring settlement blocks
          await setupRandomRing();
          await exchangeTestUtil.commitRings(exchangeId);

          const blocks = exchangeTestUtil.pendingBlocks[exchangeId];
          assert(blocks.length >= 2, "unexpected number of blocks");

          // Randomize the order in which the blocks are verified
          exchangeTestUtil.shuffle(blocks);

          // Verify all blocks at once
          await expectThrow(
            exchangeTestUtil.submitBlocks(blocks),
            "INVALID_BATCH_BLOCK_TYPE"
          );
        });

        it("should not be able to verify the same block twice in a single call", async () => {
          await createExchange();
          await exchangeTestUtil.commitDeposits(exchangeId);
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          const ring = await setupRandomRing(false);
          await exchangeTestUtil.commitDeposits(exchangeId);

          await exchangeTestUtil.sendRing(exchangeId, ring);
          const blocks = await exchangeTestUtil.commitRings(exchangeId);
          assert(blocks.length === 1, "unexpected number of blocks");

          // Verify the same block twice
          await expectThrow(
            exchangeTestUtil.submitBlocks([blocks[0], blocks[0]]),
            "BLOCK_VERIFIED_ALREADY"
          );
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
          await exchangeTestUtil.submitPendingBlocks(exchangeId);

          await exchangeTestUtil.sendRing(exchangeId, ring);

          exchangeTestUtil.commitWrongPublicDataOnce = true;
          await exchangeTestUtil.commitRings(exchangeId);

          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(exchangeId),
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
    });

    describe("anyone", () => {
      it("shouldn't be able to submit blocks", async () => {
        await createExchange();
        const block: OnchainBlock = {
          blockType: 0,
          blockSize: 1,
          blockVersion: 0,
          data: Constants.emptyBytes,
          proof: [0, 0, 0, 0, 0, 0, 0, 0],
          offchainData: Constants.emptyBytes,
          auxiliaryData: Constants.emptyBytes
        };
        // Try to submit a block
        await expectThrow(
          exchange.submitBlocks([block], exchangeTestUtil.exchangeOperator, {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
