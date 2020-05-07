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

    describe("Operator", () => {
      describe("submitBlocks", () => {
        it("should not be able to submit blocks from different exchanges", async () => {
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

        it("should not be able to submit blocks starting from a wrong merkle root state", async () => {
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

        it("should not be able to submit blocks with an invalid new Merkle root", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.SETTLEMENT,
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
            blockType: BlockType.SETTLEMENT,
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

        it("should not be able to submit settlement blocks with an invalid timestamp", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.SETTLEMENT,
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
              blockType: BlockType.SETTLEMENT,
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
              blockType: BlockType.SETTLEMENT,
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

        it("should not be able to submit settlement blocks with invalid protocol fees", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.SETTLEMENT,
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
              blockType: BlockType.SETTLEMENT,
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
              blockType: BlockType.SETTLEMENT,
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

        it("should not be able to submit deposit/on-chain withdrawal blocks with invalid data", async () => {
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
            blockType: BlockType.SETTLEMENT,
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

        it("should be able to submit blocks of different types", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Verify all blocks
          await exchangeTestUtil.submitPendingBlocks(exchangeId);
        });

        it("should not be able to submit blocks when one of the proofs is incorrect", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Try so submit blocks with invalid proofs
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(
              exchangeId,
              (blocks: OnchainBlock[]) => {
                // Change a random proof
                const blockToModify = exchangeTestUtil.getRandomInt(
                  blocks.length
                );
                const proofIdxToModify = exchangeTestUtil.getRandomInt(8);
                blocks[blockToModify].proof[proofIdxToModify] =
                  "0x" +
                  new BN(
                    blocks[blockToModify].proof[proofIdxToModify].slice(2),
                    16
                  )
                    .add(new BN(1))
                    .toString(16);
              }
            ),
            "INVALID_PROOF"
          );
        });

        it("should not be able to submit blocks with incorrect public data", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Try so submit blocks with invalid proofs
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(
              exchangeId,
              (blocks: OnchainBlock[]) => {
                // Change the data of a random block
                const blockToModify = exchangeTestUtil.getRandomInt(
                  blocks.length
                );
                blocks[blockToModify].data = [
                  ...blocks[blockToModify].data,
                  ...web3.utils.hexToBytes(web3.utils.randomHex(1))
                ];
              }
            ),
            "INVALID_PROOF"
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
