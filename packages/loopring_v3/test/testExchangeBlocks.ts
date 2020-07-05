import BN = require("bn.js");
import { Bitstream, BlockType, Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
import { AuthMethod, SpotTrade } from "./types";

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
      },
      expected: {
        orderA: { filledFraction: 1.0, spread: new BN(0) },
        orderB: { filledFraction: 1.0 }
      }
    };
    await exchangeTestUtil.setupRing(ring);
    if (send) {
      await exchangeTestUtil.sendRing(exchangeId, ring);
    }
    return ring;
  };

  const commitSomeWork = async () => {
    await setupRandomRing();
    await exchangeTestUtil.submitTransactions();
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
            BlockType.NOOP,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          let timestamp = (
            await web3.eth.getBlock(await web3.eth.getBlockNumber())
          ).timestamp;
          timestamp -=
            exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1;
          const bs = new Bitstream();
          //bs.addNumber(0, 1);
          bs.addNumber(exchangeId, 4);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.SNARK_SCALAR_FIELD, 32);
          bs.addNumber(timestamp, 4);
          const block: OnchainBlock = {
            blockType: BlockType.NOOP,
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
            BlockType.NOOP,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          // Timestamp too early
          {
            let timestamp = (
              await web3.eth.getBlock(await web3.eth.getBlockNumber())
            ).timestamp;
            timestamp -=
              exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 1;
            const bs = new Bitstream();
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            const block: OnchainBlock = {
              blockType: BlockType.NOOP,
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
            let timestamp = (
              await web3.eth.getBlock(await web3.eth.getBlockNumber())
            ).timestamp;
            timestamp +=
              exchangeTestUtil.TIMESTAMP_HALF_WINDOW_SIZE_IN_SECONDS + 15;
            const bs = new Bitstream();
            //bs.addNumber(0, 1);
            bs.addNumber(exchangeId, 4);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            const block: OnchainBlock = {
              blockType: BlockType.NOOP,
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
            BlockType.NOOP,
            true,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const protocolFees = await loopring.getProtocolFeeValues(
            exchangeTestUtil.exchangeId,
            exchangeTestUtil.onchainDataAvailability
          );
          const timestamp = (
            await web3.eth.getBlock(await web3.eth.getBlockNumber())
          ).timestamp;
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
              blockType: BlockType.NOOP,
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
              blockType: BlockType.NOOP,
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
            BlockType.WITHDRAWAL,
            false,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          await exchangeTestUtil.blockVerifier.registerCircuit(
            BlockType.WITHDRAWAL,
            false,
            8,
            blockVersion,
            new Array(18).fill(1)
          );
          const numRequests = 4;
          // Do some deposit
          const withdrawalFee = await exchangeTestUtil.loopringV3.forcedWithdrawalFee();
          const owner = exchangeTestUtil.testContext.orderOwners[0];
          const token = exchangeTestUtil.getTokenAddress("LRC");
          const amount = new BN(web3.utils.toWei("3", "ether"));
          // Deposits
          for (let i = 0; i < numRequests; i++) {
            await exchangeTestUtil.deposit(
              owner,
              owner,
              token,
              amount
            );
          }
          // On-chain withdrawals
          for (let i = 0; i < numRequests; i++) {
            await exchange.withdraw(owner, token, amount, {
              from: owner,
              value: withdrawalFee
            });
          }

          const blockTypes = [BlockType.DEPOSIT, BlockType.WITHDRAWAL];
          for (const blockType of blockTypes) {
            let startIndex = 0;
            let startingHash = "0x0";
            if (blockType === BlockType.DEPOSIT) {
              startIndex = (
                await exchange.getNumDepositRequestsProcessed()
              ).toNumber();
              const firstRequestData = await exchange.getDepositRequest(
                startIndex - 1
              );
              startingHash = firstRequestData.accumulatedHash;
            } else {
              startIndex = (
                await exchange.getNumDepositRequestsProcessed()
              ).toNumber();
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

        it("should be able to submit blocks of different types", async () => {
          await createExchange();
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Verify all blocks
          await exchangeTestUtil.submitPendingBlocks();
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
