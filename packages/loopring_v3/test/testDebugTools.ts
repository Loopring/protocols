import BN = require("bn.js");
import fs = require("fs");
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";
import { BlockCallback } from "./types";

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

    it.skip("submitBlocks tx data", async () => {
      const blockDirectory = "./blocks/";

      const blockNames = ["block_2_3", "block_2_4", "block_2_5"];
      const outputFilename = "./blocks/result.json";

      const onchainBlocks: OnchainBlock[] = [];
      const blockCallbacks: BlockCallback[][] = [];
      for (const blockName of blockNames) {
        const baseFilename = blockDirectory + blockName;
        const auxDataFilename = baseFilename + "_auxiliaryData.json";
        const callbacksFilename = baseFilename + "_callbacks.json";
        const proofFilename = baseFilename + "_proof.json";
        const blockFilename = baseFilename + ".json";

        const auxiliaryData = JSON.parse(
          fs.readFileSync(auxDataFilename, "ascii")
        );
        const callbacks = JSON.parse(
          fs.readFileSync(callbacksFilename, "ascii")
        );
        const proof = ctx.readProof(proofFilename);

        // Read in the block
        const block = JSON.parse(fs.readFileSync(blockFilename, "ascii"));

        // Create the block data
        const blockData = ctx.getBlockData(block, auxiliaryData.length);

        const onchainBlock = ctx.getOnchainBlock(
          block,
          blockData,
          auxiliaryData,
          proof
        );
        console.log(onchainBlock);

        onchainBlocks.push(onchainBlock);
        blockCallbacks.push(callbacks);
      }

      const submitBlocksTxData = ctx.getSubmitCallbackData(onchainBlocks);
      console.log(submitBlocksTxData);

      // LoopringIOExchangeOwner.submitBlocksWithCallbacks
      const withCallbacksParameters = ctx.getSubmitBlocksWithCallbacksData(
        true,
        submitBlocksTxData,
        blockCallbacks
      );
      console.log(withCallbacksParameters);

      // Write the  output to a file as well
      fs.writeFileSync(
        outputFilename,
        JSON.stringify(
          {
            blocks: onchainBlocks,
            txData: submitBlocksTxData,
            withCallbacksParameters
          },
          undefined,
          4
        ),
        "utf8"
      );
    });
  });
});
