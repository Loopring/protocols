import BN = require("bn.js");
import fs = require("fs");
import { AmmPool } from "./ammUtils";
import { Constants } from "loopringV3.js";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
import { TransactionReceiverCallback } from "./types";
import { calculateCalldataCost, compressZeros } from "loopringV3.js";

contract("Exchange", (accounts: string[]) => {
  let ctx: ExchangeTestUtil;

  before(async () => {
    ctx = new ExchangeTestUtil();
    await ctx.initialize(accounts);
  });

  after(async () => {
    await ctx.stop();
  });

  describe("Debug Tools", function() {
    this.timeout(0);

    it.skip("submitBlocks tx data compressor", async () => {
      const data = "";

      //console.log("original gas cost: " + calculateCalldataCost(data));

      const decodedInput = web3.eth.abi.decodeParameters(
        [
          "bool",
          "bytes",
          {
            "struct CallbackConfig": {
              "struct BlockCallback[]": {
                blockIdx: "uint16",
                "struct TxCallback[]": {
                  txIdx: "uint16",
                  numTxs: "uint16",
                  receiverIdx: "uint16",
                  data: "bytes"
                }
              },
              receivers: "address[]"
            }
          }
        ],
        "0x" + data.slice(2 + 4 * 2)
      );

      const ctx = new ExchangeTestUtil();
      await ctx.initialize(accounts);

      const encodedData = await ctx.getSubmitBlocksWithCallbacks({
        isDataCompressed: true,
        data: compressZeros(decodedInput[1]),
        callbackConfig: decodedInput[2]
      });

      //console.log("new gas cost: " + calculateCalldataCost(encodedData));
      console.log(encodedData);
    });

    it.skip("submitBlocks tx data", async () => {
      const blockDirectory = "./blocks/";

      const blockNames = ["block_2_1", "block_2_2", "block_2_3", "block_2_4"];
      const outputFilename = "./blocks/result.json";

      const onlyUseInfoFile = true;
      const useCompression = false;

      const onchainBlocks: OnchainBlock[] = [];
      const transactionReceiverCallback: TransactionReceiverCallback[][] = [];
      for (const blockName of blockNames) {
        const baseFilename = blockDirectory + blockName;
        //const auxDataFilename = baseFilename + "_auxiliaryData.json";
        //const callbacksFilename = baseFilename + "_callbacks.json";
        const proofFilename = baseFilename + "_proof.json";
        const blockInfoFilename = baseFilename + "_info.json";
        const blockFilename = baseFilename + ".json";

        /*const auxiliaryDataReference = JSON.parse(
          fs.readFileSync(auxDataFilename, "ascii")
        );*/
        /*const callbacksReference = JSON.parse(
          fs.readFileSync(callbacksFilename, "ascii")
        );*/
        const blockInfo = JSON.parse(
          fs.readFileSync(blockInfoFilename, "ascii")
        );
        //console.log(callbacksReference);
        const dummyProof: string[] = [];
        for (let i = 0; i < 8; i++) {
          dummyProof.push("0x" + "0".repeat(64));
        }
        const proof = onlyUseInfoFile
          ? dummyProof
          : ctx.readProof(proofFilename);
        //console.log(proof);

        // Create the block data
        const auxiliaryData = ctx.getBlockAuxiliaryData(blockInfo);

        let blockData: string;
        if (onlyUseInfoFile) {
          blockData = ctx.getBlockData(blockInfo, auxiliaryData.length);
        } else {
          // Read in the block
          const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));
          blockData = ctx.getBlockData(block, auxiliaryData.length);
        }

        //console.log(auxiliaryDataReference);
        //console.log(auxiliaryData);

        const onchainBlock = ctx.getOnchainBlock(
          0,
          blockInfo.transactions.length,
          blockData,
          auxiliaryData,
          proof
        );
        console.log(onchainBlock);

        // Read the AMM transactions
        const callbacks: TransactionReceiverCallback[] = [];
        for (const ammTx of blockInfo.ammTransactions) {
          callbacks.push(AmmPool.getTransactionReceiverCallback(ammTx));
        }
        //console.log(callbacks);

        onchainBlocks.push(onchainBlock);
        transactionReceiverCallback.push(callbacks);
      }

      const submitBlocksTxData = ctx.getSubmitCallbackData(onchainBlocks);
      console.log(submitBlocksTxData);

      // LoopringIOExchangeOwner.submitBlocksWithCallbacks
      const withCallbacksParameters = ctx.getSubmitBlocksWithCallbacksData(
        useCompression,
        submitBlocksTxData,
        transactionReceiverCallback,
        [],
        []
      );
      console.log(withCallbacksParameters);

      const submitBlocksWithCallbacksBlocksTxData = ctx.getSubmitBlocksWithCallbacks(
        withCallbacksParameters
      );
      console.log(submitBlocksWithCallbacksBlocksTxData);

      // Write the  output to a file as well
      fs.writeFileSync(
        outputFilename,
        JSON.stringify(
          {
            blocks: onchainBlocks,
            txData: submitBlocksTxData,
            withCallbacksParameters,
            txDataWithCallbacks: submitBlocksWithCallbacksBlocksTxData
          },
          undefined,
          4
        ),
        "utf8"
      );
    });
  });
});
