import BN = require("bn.js");
import { Bitstream, BlockType, Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
import { AuthMethod, Block, SpotTrade } from "./types";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;
  let operator: any;
  let loopring: any;
  let blockVersionGenerator = 128;

  let ownerA: string;
  let ownerB: string;
  let ownerC: string;
  let ownerD: string;

  const createExchange = async (
    setupTestState: boolean = true,
    useOwnerContract: boolean = false
  ) => {
    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      { setupTestState, useOwnerContract }
    );
    exchange = exchangeTestUtil.exchange;
    operator = exchange;
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
      await exchangeTestUtil.sendRing(ring);
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

    ownerA = exchangeTestUtil.testContext.orderOwners[0];
    ownerB = exchangeTestUtil.testContext.orderOwners[1];
    ownerC = exchangeTestUtil.testContext.orderOwners[2];
    ownerD = exchangeTestUtil.testContext.orderOwners[3];
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Blocks", function() {
    this.timeout(0);

    describe("Operator", () => {
      const tokenA = "ETH";
      const tokenB = "LRC";
      const amountA = new BN(web3.utils.toWei("1.8", "ether"));
      const amountB = new BN(web3.utils.toWei("3.4", "ether"));
      const amountC = new BN(web3.utils.toWei("0.1", "ether"));
      const amountD = new BN(web3.utils.toWei("0.01", "ether"));

      describe("submitBlocks", () => {
        it("should not be able to submit blocks from different exchanges", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const bs = new Bitstream();
          bs.addAddress(exchangeTestUtil.blockVerifier.address);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          bs.addNumber(0, 1024);
          const block: OnchainBlock = {
            blockType: BlockType.UNIVERSAL,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            storeBlockInfoOnchain: true,
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            operator.submitBlocks([block], {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_EXCHANGE"
          );
        });

        it("should not be able to submit blocks starting from a wrong merkle root state", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const bs = new Bitstream();
          bs.addAddress(exchange.address);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(2)), 32);
          bs.addNumber(0, 1024);
          const block: OnchainBlock = {
            blockType: BlockType.UNIVERSAL,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            storeBlockInfoOnchain: true,
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            operator.submitBlocks([block], {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_MERKLE_ROOT"
          );
        });

        it("should not be able to submit blocks with an invalid new Merkle root", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
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
          bs.addAddress(exchange.address);
          bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
          bs.addBN(exchangeTestUtil.SNARK_SCALAR_FIELD, 32);
          bs.addNumber(timestamp, 4);
          bs.addNumber(0, 1024);
          const block: OnchainBlock = {
            blockType: BlockType.UNIVERSAL,
            blockSize: 2,
            blockVersion: blockVersion,
            data: web3.utils.hexToBytes(bs.getData()),
            proof: [0, 0, 0, 0, 0, 0, 0, 0],
            storeBlockInfoOnchain: true,
            offchainData: Constants.emptyBytes,
            auxiliaryData: Constants.emptyBytes
          };
          await expectThrow(
            operator.submitBlocks([block], {
              from: exchangeTestUtil.exchangeOperator
            }),
            "INVALID_MERKLE_ROOT"
          );
        });

        it("should not be able to submit settlement blocks with an invalid timestamp", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
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
            bs.addAddress(exchange.address);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(0, 1024);
            const block: OnchainBlock = {
              blockType: BlockType.UNIVERSAL,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              storeBlockInfoOnchain: true,
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              operator.submitBlocks([block], {
                from: exchangeTestUtil.exchangeOperator
              }),
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
            bs.addAddress(exchange.address);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(0, 1024);
            const block: OnchainBlock = {
              blockType: BlockType.UNIVERSAL,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              storeBlockInfoOnchain: true,
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              operator.submitBlocks([block], {
                from: exchangeTestUtil.exchangeOperator
              }),
              "INVALID_TIMESTAMP"
            );
          }
        });

        it("should not be able to submit settlement blocks with invalid protocol fees", async () => {
          await createExchange(false);
          const blockVersion = blockVersionGenerator++;
          await exchangeTestUtil.blockVerifier.registerCircuit(
            0,
            2,
            blockVersion,
            new Array(18).fill(1)
          );
          const protocolFees = await loopring.getProtocolFeeValues();
          const timestamp = (
            await web3.eth.getBlock(await web3.eth.getBlockNumber())
          ).timestamp;
          // Invalid taker protocol fee
          {
            const bs = new Bitstream();
            bs.addAddress(exchange.address);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips.add(new BN(1)), 1);
            bs.addNumber(protocolFees.makerFeeBips, 1);
            bs.addNumber(0, 1024);
            const block: OnchainBlock = {
              blockType: BlockType.UNIVERSAL,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              storeBlockInfoOnchain: true,
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              operator.submitBlocks([block], {
                from: exchangeTestUtil.exchangeOperator
              }),
              "INVALID_PROTOCOL_FEES"
            );
          }
          // Invalid maker protocol fee
          {
            const bs = new Bitstream();
            bs.addAddress(exchange.address);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT, 32);
            bs.addBN(exchangeTestUtil.GENESIS_MERKLE_ROOT.add(new BN(1)), 32);
            bs.addNumber(timestamp, 4);
            bs.addNumber(protocolFees.takerFeeBips, 1);
            bs.addNumber(protocolFees.makerFeeBips.add(new BN(1)), 1);
            bs.addNumber(0, 1024);
            const block: OnchainBlock = {
              blockType: BlockType.UNIVERSAL,
              blockSize: 2,
              blockVersion: blockVersion,
              data: web3.utils.hexToBytes(bs.getData()),
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              storeBlockInfoOnchain: true,
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            await expectThrow(
              operator.submitBlocks([block], {
                from: exchangeTestUtil.exchangeOperator
              }),
              "INVALID_PROTOCOL_FEES"
            );
          }
        });

        it("Invalid auxiliary data", async () => {
          await createExchange(true, true);
          // Do some transfers
          await exchangeTestUtil.transfer(
            ownerA,
            ownerD,
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
          // Commmit the transfers
          await exchangeTestUtil.submitTransactions(24);

          // Submit the transfers: wrong order
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(
              (onchainBlocks: OnchainBlock[], blocks: Block[]) => {
                assert(blocks.length === 1, "unexpected number of blocks");
                const auxiliaryData = exchangeTestUtil.getBlockAuxiliaryData(
                  blocks[0].blockInfoData
                );
                // Swap tx 0 and 1
                const temp = auxiliaryData[1];
                auxiliaryData[1] = auxiliaryData[0];
                auxiliaryData[0] = temp;
                onchainBlocks[0].auxiliaryData = exchangeTestUtil.encodeAuxiliaryData(
                  auxiliaryData
                );
              }
            ),
            "AUXILIARYDATA_INVALID_ORDER"
          );

          // Submit the transfers: duplicated index
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(
              (onchainBlocks: OnchainBlock[], blocks: Block[]) => {
                assert(blocks.length === 1, "unexpected number of blocks");
                const auxiliaryData = exchangeTestUtil.getBlockAuxiliaryData(
                  blocks[0].blockInfoData
                );
                // Set the idx of tx 0 on tx 1
                auxiliaryData[1][0] = auxiliaryData[0][0];
                onchainBlocks[0].auxiliaryData = exchangeTestUtil.encodeAuxiliaryData(
                  auxiliaryData
                );
              }
            ),
            "AUXILIARYDATA_INVALID_ORDER"
          );

          // Submit the transfers: invalid length
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks(
              (onchainBlocks: OnchainBlock[], blocks: Block[]) => {
                assert(blocks.length === 1, "unexpected number of blocks");
                const auxiliaryData = exchangeTestUtil.getBlockAuxiliaryData(
                  blocks[0].blockInfoData
                );
                auxiliaryData.push([0, false, web3.utils.hexToBytes("0x")]);
                onchainBlocks[0].auxiliaryData = exchangeTestUtil.encodeAuxiliaryData(
                  auxiliaryData
                );
              }
            ),
            "AUXILIARYDATA_INVALID_LENGTH"
          );

          // Submit the transfers: everything alright
          await exchangeTestUtil.submitPendingBlocks(
            (onchainBlocks: OnchainBlock[], blocks: Block[]) => {
              assert(blocks.length === 1, "unexpected number of blocks");
              const auxiliaryData = exchangeTestUtil.getBlockAuxiliaryData(
                blocks[0].blockInfoData
              );
              onchainBlocks[0].auxiliaryData = exchangeTestUtil.encodeAuxiliaryData(
                auxiliaryData
              );
            }
          );
        });

        it("should be able to submit blocks of different types", async () => {
          await createExchange(true, true);
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Verify all blocks
          await exchangeTestUtil.submitPendingBlocks();
        });

        it("should not be able to submit blocks when one of the proofs is incorrect", async () => {
          await createExchange(true, true);
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Try so submit blocks with invalid proofs
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks((blocks: OnchainBlock[]) => {
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
            }),
            "INVALID_PROOF"
          );
        });

        it("should not be able to submit blocks with incorrect public data", async () => {
          await createExchange(true, true);
          // Commit some blocks
          await commitSomeWork();
          await commitSomeWork();
          await commitSomeWork();
          // Try so submit blocks with invalid proofs
          await expectThrow(
            exchangeTestUtil.submitPendingBlocks((blocks: OnchainBlock[]) => {
              // Change the data of a random block
              const blockToModify = exchangeTestUtil.getRandomInt(
                blocks.length
              );
              blocks[blockToModify].data = web3.utils.hexToBytes(
                blocks[blockToModify].data + web3.utils.randomHex(1).slice(2)
              );
            }),
            "INVALID_PROOF"
          );
        });
      });
    });

    describe("anyone", () => {
      it("shouldn't be able to submit blocks", async () => {
        await createExchange();
        const block: OnchainBlock = {
          blockType: BlockType.UNIVERSAL,
          blockSize: 1,
          blockVersion: 0,
          data: Constants.emptyBytes,
          proof: [0, 0, 0, 0, 0, 0, 0, 0],
          storeBlockInfoOnchain: true,
          offchainData: Constants.emptyBytes,
          auxiliaryData: Constants.emptyBytes
        };
        // Try to submit a block
        await expectThrow(
          exchange.submitBlocks([block], {
            from: exchangeTestUtil.testContext.orderOwners[0]
          }),
          "UNAUTHORIZED"
        );
      });
    });
  });
});
