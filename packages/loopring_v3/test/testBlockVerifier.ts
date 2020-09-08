import BN = require("bn.js");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";
import { Block, SpotTrade } from "./types";

const BlockVerifier = artifacts.require("BlockVerifier");

contract("BlockVerifier", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchangeId = 0;
  let exchange: any;

  let blockVerifier: any;

  const owner = accounts[0];
  const anyone = accounts[1];

  const createExchange = async (setupTestState: boolean = true) => {
    exchangeId = await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      {setupTestState}
    );
    exchange = exchangeTestUtil.exchange;
  };

  const setupRandomRing = async () => {
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
    return ring;
  };

  const registerCircuitChecked = async (
    blockType: number,
    blockSize: number,
    blockVersion: number,
    verificationKey: string[],
    owner: string
  ) => {
    const isRegisteredBefore = await blockVerifier.isCircuitRegistered(
      blockType,
      blockSize,
      blockVersion
    );
    const isEnabledBefore = await blockVerifier.isCircuitEnabled(
      blockType,
      blockSize,
      blockVersion
    );
    assert.equal(
      isRegisteredBefore,
      false,
      "circuit shouldn't be registered already"
    );
    assert.equal(
      isEnabledBefore,
      false,
      "circuit shouldn't be enabled already"
    );

    await blockVerifier.registerCircuit(
      blockType,
      blockSize,
      blockVersion,
      verificationKey,
      { from: owner }
    );

    const isRegisteredAfter = await blockVerifier.isCircuitRegistered(
      blockType,
      blockSize,
      blockVersion
    );
    const isEnabledAfter = await blockVerifier.isCircuitEnabled(
      blockType,
      blockSize,
      blockVersion
    );
    assert.equal(isRegisteredAfter, true, "circuit should be registered");
    assert.equal(isEnabledAfter, true, "circuit should be enabled");

    // Get the CircuitRegistered event
    const event = await exchangeTestUtil.assertEventEmitted(
      blockVerifier,
      "CircuitRegistered"
    );
    assert.equal(event.blockType, blockType, "blockType should match");
    assert.equal(event.blockSize, blockSize, "blockSize should match");
    assert.equal(event.blockVersion, blockVersion, "blockVersion should match");
  };

  const disableCircuitChecked = async (
    blockType: number,
    blockSize: number,
    blockVersion: number,
    owner: string
  ) => {
    const isRegisteredBefore = await blockVerifier.isCircuitRegistered(
      blockType,
      blockSize,
      blockVersion
    );
    const isEnabledBefore = await blockVerifier.isCircuitEnabled(
      blockType,
      blockSize,
      blockVersion
    );
    assert.equal(
      isRegisteredBefore,
      true,
      "circuit should be registered already"
    );
    assert.equal(isEnabledBefore, true, "circuit should still be enabled");

    await blockVerifier.disableCircuit(blockType, blockSize, blockVersion, {
      from: owner
    });

    const isRegisteredAfter = await blockVerifier.isCircuitRegistered(
      blockType,
      blockSize,
      blockVersion
    );
    const isEnabledAfter = await blockVerifier.isCircuitEnabled(
      blockType,
      blockSize,
      blockVersion
    );
    assert.equal(isRegisteredAfter, true, "circuit should be registered");
    assert.equal(isEnabledAfter, false, "circuit should be disabled");

    // Get the CircuitDisabled event
    const event = await exchangeTestUtil.assertEventEmitted(
      blockVerifier,
      "CircuitDisabled"
    );
    assert.equal(event.blockType, blockType, "blockType should match");
    assert.equal(event.blockSize, blockSize, "blockSize should match");
    assert.equal(event.blockVersion, blockVersion, "blockVersion should match");
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("owner", () => {
    beforeEach(async () => {
      blockVerifier = await BlockVerifier.new({ from: owner });
    });

    it("should be able to register a new circuit", async () => {
      const blockType = 0;
      const blockSize = 512;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType,
        blockSize,
        blockVersion,
        new Array(18).fill("0x123"),
        owner
      );
    });

    it("should not be able to register a circuit twice", async () => {
      const blockType = 0;
      const blockSize = 512;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType,
        blockSize,
        blockVersion,
        new Array(18).fill("0x123"),
        owner
      );

      await expectThrow(
        blockVerifier.registerCircuit(
          blockType,
          blockSize,
          blockVersion,
          new Array(18).fill("0x123"),
          { from: anyone }
        ),
        "UNAUTHORIZED"
      );
    });

    it("should be able to disable a circuit", async () => {
      const blockType = 1;
      const blockSize = 128;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType,
        blockSize,
        blockVersion,
        new Array(18).fill("0x123"),
        owner
      );
      await disableCircuitChecked(blockType, blockSize, blockVersion, owner);
    });

    it("should not be able to disable a circuit that wasn't registered", async () => {
      const blockType = 1;
      const blockSize = 128;
      const blockVersion = 3;
      await expectThrow(
        blockVerifier.disableCircuit(blockType, blockSize, blockVersion, {
          from: owner
        }),
        "NOT_REGISTERED"
      );
    });
  });

  describe("anyone", () => {
    beforeEach(async () => {
      blockVerifier = await BlockVerifier.new({ from: owner });
    });

    it("should not be able to register a new circuit", async () => {
      const blockType = 0;
      const blockSize = 512;
      const blockVersion = 3;
      await expectThrow(
        blockVerifier.registerCircuit(
          blockType,
          blockSize,
          blockVersion,
          new Array(18).fill("0x123"),
          { from: anyone }
        ),
        "UNAUTHORIZED"
      );
    });

    it("should not be able to disable a circuit", async () => {
      const blockType = 1;
      const blockSize = 128;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType,
        blockSize,
        blockVersion,
        new Array(18).fill("0x123"),
        owner
      );
      await expectThrow(
        blockVerifier.disableCircuit(blockType, blockSize, blockVersion, {
          from: anyone
        }),
        "UNAUTHORIZED"
      );
    });
  });

  describe("Block verification", function() {
    this.timeout(0);

    const commitBlocksSize1: Block[] = [];
    const commitBlocksSize2: Block[] = [];
    const settlementBlocksSize1: Block[] = [];
    const settlementBlocksSize2: Block[] = [];

    before(async () => {
      await createExchange();
      blockVerifier = exchangeTestUtil.blockVerifier;

      // Create some blocks
      for (let i = 0; i < 2; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(ring);
      }
      commitBlocksSize1.push(...(await exchangeTestUtil.submitTransactions(2)));
      for (let i = 0; i < 2; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(ring);
      }
      settlementBlocksSize1.push(
        ...(await exchangeTestUtil.submitTransactions(2))
      );

      for (let i = 0; i < 2; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(ring);
      }
      commitBlocksSize2.push(...(await exchangeTestUtil.submitTransactions(4)));
      for (let i = 0; i < 2; i++) {
        const ring = await setupRandomRing();
        await exchangeTestUtil.sendRing(ring);
      }
      settlementBlocksSize2.push(
        ...(await exchangeTestUtil.submitTransactions(4))
      );

      // Generate the proofs
      await exchangeTestUtil.submitPendingBlocks();
    });

    it("should be able to verify a single block with a valid proof", async () => {
      const block = commitBlocksSize1[0];
      const success = await blockVerifier.verifyProofs(
        block.blockType,
        block.blockSize,
        block.blockVersion,
        [block.publicInput],
        block.proof,
        { from: anyone }
      );
      assert(success, "verification should be succesful");
    });

    it("should not be able to verify a single block with an invalid proof", async () => {
      const success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        [commitBlocksSize1[0].publicInput],
        commitBlocksSize1[1].proof,
        { from: anyone }
      );
      assert(!success, "verification should not be succesful");
    });

    it("should not be able to verify a single block with invalid publicData", async () => {
      const success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        [commitBlocksSize1[1].publicInput],
        commitBlocksSize1[0].proof,
        { from: anyone }
      );
      assert(!success, "verification should not be succesful");
    });

    it("should not be able to verify a single block with publicData >= scalar field", async () => {
      await expectThrow(
        blockVerifier.verifyProofs(
          commitBlocksSize1[0].blockType,
          commitBlocksSize1[0].blockSize,
          commitBlocksSize1[0].blockVersion,
          [Constants.scalarField],
          commitBlocksSize1[0].proof,
          { from: anyone }
        ),
        "INVALID_INPUT"
      );
    });

    it("should not be able to verify a block with an unknown circuit", async () => {
      const block = commitBlocksSize1[0];
      await expectThrow(
        blockVerifier.verifyProofs(
          8,
          block.blockSize,
          block.blockVersion,
          [block.publicInput],
          block.proof,
          { from: anyone }
        ),
        "NOT_REGISTERED"
      );
      await expectThrow(
        blockVerifier.verifyProofs(
          block.blockType,
          7,
          block.blockVersion,
          [block.publicInput],
          block.proof,
          { from: anyone }
        ),
        "NOT_REGISTERED"
      );
      await expectThrow(
        blockVerifier.verifyProofs(
          block.blockType,
          block.blockSize,
          1,
          [block.publicInput],
          block.proof,
          { from: anyone }
        ),
        "NOT_REGISTERED"
      );
    });

    it("should be able to verify multiple blocks of the same circuit with valid proofs", async () => {
      let success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        commitBlocksSize1.map(x => x.publicInput),
        exchangeTestUtil.flattenList(commitBlocksSize1.map(x => x.proof)),
        { from: anyone }
      );
      assert(success, "verification should be succesful");

      success = await blockVerifier.verifyProofs(
        settlementBlocksSize2[0].blockType,
        settlementBlocksSize2[0].blockSize,
        settlementBlocksSize2[0].blockVersion,
        settlementBlocksSize2.map(x => x.publicInput),
        exchangeTestUtil.flattenList(settlementBlocksSize2.map(x => x.proof)),
        { from: anyone }
      );
      assert(success, "verification should be succesful");
    });

    it("should not be able to verify multiple blocks of different circuits with valid proofs", async () => {
      // Add a proof for a different circuit to a random location
      const mixedBlocks = [...commitBlocksSize1, commitBlocksSize2[0]];
      exchangeTestUtil.shuffle(mixedBlocks);

      const success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        mixedBlocks.map(x => x.publicInput),
        exchangeTestUtil.flattenList(mixedBlocks.map(x => x.proof)),
        { from: anyone }
      );
      assert(!success, "verification should not be succesful");
    });

    it("should not be able to verify multiple blocks of the same circuits with invalid proofs", async () => {
      // Change a single proof element
      const proofs = exchangeTestUtil.flattenList(
        commitBlocksSize1.map(x => x.proof)
      );
      const proofIdxToModify = exchangeTestUtil.getRandomInt(proofs.length);
      proofs[proofIdxToModify] =
        "0x" +
        new BN(proofs[proofIdxToModify].slice(2), 16)
          .add(new BN(1))
          .toString(16);

      const success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        commitBlocksSize1.map(x => x.publicInput),
        proofs,
        { from: anyone }
      );
      assert(!success, "verification should not be succesful");
    });

    it("should not be able to verify multiple blocks of the same circuits with invalid public inputs", async () => {
      // Change a single public input
      const publicInputs = commitBlocksSize1.map(x => x.publicInput);
      const publicDataIdxToModify = exchangeTestUtil.getRandomInt(
        publicInputs.length
      );
      publicInputs[publicDataIdxToModify] =
        "0x" +
        new BN(publicInputs[publicDataIdxToModify].slice(2), 10)
          .add(new BN(1))
          .toString(16);

      const success = await blockVerifier.verifyProofs(
        commitBlocksSize1[0].blockType,
        commitBlocksSize1[0].blockSize,
        commitBlocksSize1[0].blockVersion,
        publicInputs,
        exchangeTestUtil.flattenList(commitBlocksSize1.map(x => x.proof)),
        { from: anyone }
      );
      assert(!success, "verification should not be succesful");
    });

    it("should not be able to verify multiple blocks of the same circuits with public input >= scalar field", async () => {
      // Change a single public input
      const publicInputs = commitBlocksSize1.map(x => x.publicInput);
      const publicDataIdxToModify = exchangeTestUtil.getRandomInt(
        publicInputs.length
      );
      publicInputs[publicDataIdxToModify] =
        "0x" + Constants.scalarField.toString(16);

      await expectThrow(
        blockVerifier.verifyProofs(
          commitBlocksSize1[0].blockType,
          commitBlocksSize1[0].blockSize,
          commitBlocksSize1[0].blockVersion,
          publicInputs,
          exchangeTestUtil.flattenList(commitBlocksSize1.map(x => x.proof)),
          { from: anyone }
        ),
        "INVALID_INPUT"
      );
    });
  });
});
