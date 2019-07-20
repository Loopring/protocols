import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

const BlockVerifier = artifacts.require("BlockVerifier");

contract("BlockVerifier", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let blockVerifier: any;

  const owner = accounts[0];
  const anyone = accounts[1];

  const registerCircuitChecked = async (blockType: number, onchainDataAvailability: boolean,
                                        blockSize: number, blockVersion: number,
                                        verificationKey: string[], owner: string) => {
    const isRegisteredBefore = await blockVerifier.isCircuitRegistered(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    const isEnabledBefore = await blockVerifier.isCircuitEnabled(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    assert.equal(isRegisteredBefore, false, "circuit shouldn't be registered already");
    assert.equal(isEnabledBefore, false, "circuit shouldn't be enabled already");

    await blockVerifier.registerCircuit(
      blockType, onchainDataAvailability, blockSize, blockVersion, verificationKey,
      {from: owner},
    );

    const isRegisteredAfter = await blockVerifier.isCircuitRegistered(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    const isEnabledAfter = await blockVerifier.isCircuitEnabled(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    assert.equal(isRegisteredAfter, true, "circuit should be registered");
    assert.equal(isEnabledAfter, true, "circuit should be enabled");

    // Get the CircuitRegistered event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      blockVerifier, "CircuitRegistered", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return {
        blockType: eventObj.args.blockType,
        onchainDataAvailability: eventObj.args.onchainDataAvailability,
        blockSize: eventObj.args.blockSize,
        blockVersion: eventObj.args.blockVersion,
      };
    });
    assert.equal(items.length, 1, "A single CircuitRegistered event should have been emitted");
    assert.equal(items[0].blockType, blockType, "blockType should match");
    assert.equal(items[0].onchainDataAvailability, onchainDataAvailability, "onchainDataAvailability should match");
    assert.equal(items[0].blockSize, blockSize, "blockSize should match");
    assert.equal(items[0].blockVersion, blockVersion, "blockVersion should match");
  };

  const disableCircuitChecked = async (blockType: number, onchainDataAvailability: boolean,
                                       blockSize: number, blockVersion: number,
                                       owner: string) => {
    const isRegisteredBefore = await blockVerifier.isCircuitRegistered(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    const isEnabledBefore = await blockVerifier.isCircuitEnabled(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    assert.equal(isRegisteredBefore, true, "circuit should be registered already");
    assert.equal(isEnabledBefore, true, "circuit should still be enabled");

    await blockVerifier.disableCircuit(
      blockType, onchainDataAvailability, blockSize, blockVersion,
      {from: owner},
    );

    const isRegisteredAfter = await blockVerifier.isCircuitRegistered(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    const isEnabledAfter = await blockVerifier.isCircuitEnabled(
      blockType, onchainDataAvailability, blockSize, blockVersion,
    );
    assert.equal(isRegisteredAfter, true, "circuit should be registered");
    assert.equal(isEnabledAfter, false, "circuit should be disabled");

    // Get the CircuitDisabled event
    const eventArr: any = await exchangeTestUtil.getEventsFromContract(
      blockVerifier, "CircuitDisabled", web3.eth.blockNumber,
    );
    const items = eventArr.map((eventObj: any) => {
      return {
        blockType: eventObj.args.blockType,
        onchainDataAvailability: eventObj.args.onchainDataAvailability,
        blockSize: eventObj.args.blockSize,
        blockVersion: eventObj.args.blockVersion,
      };
    });
    assert.equal(items.length, 1, "A single CircuitDisabled event should have been emitted");
    assert.equal(items[0].blockType, blockType, "blockType should match");
    assert.equal(items[0].onchainDataAvailability, onchainDataAvailability, "onchainDataAvailability should match");
    assert.equal(items[0].blockSize, blockSize, "blockSize should match");
    assert.equal(items[0].blockVersion, blockVersion, "blockVersion should match");
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
  });

  beforeEach(async () => {
    blockVerifier = await BlockVerifier.new({from: owner});
  });

  describe("owner", () => {
    it("should be able to register a new circuit", async () => {
      const blockType = 0;
      const onchainDataAvailability = false;
      const blockSize = 512;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType, onchainDataAvailability, blockSize, blockVersion,
        new Array(18).fill("0x123"),
        owner,
      );
    });

    it("should be able to disable a circuit", async () => {
      const blockType = 1;
      const onchainDataAvailability = false;
      const blockSize = 128;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType, onchainDataAvailability, blockSize, blockVersion, new Array(18).fill("0x123"),
        owner,
      );
      await disableCircuitChecked(
        blockType, onchainDataAvailability, blockSize, blockVersion,
        owner,
      );
    });

    it("should not be able to disable a circuit that wasn't registered", async () => {
      const blockType = 1;
      const onchainDataAvailability = false;
      const blockSize = 128;
      const blockVersion = 3;
      await expectThrow(
        blockVerifier.disableCircuit(
          blockType, onchainDataAvailability, blockSize, blockVersion,
          {from: owner},
        ),
        "NOT_REGISTERED",
      );
    });
  });

  describe("anyone", () => {
    it("should not be able to register a new circuit", async () => {
      const blockType = 0;
      const onchainDataAvailability = false;
      const blockSize = 512;
      const blockVersion = 3;
      await expectThrow(
        blockVerifier.registerCircuit(
          blockType, onchainDataAvailability, blockSize, blockVersion,
          new Array(18).fill("0x123"),
          {from: anyone},
        ),
        "UNAUTHORIZED",
      );
    });

    it("should not be able to disable a circuit", async () => {
      const blockType = 1;
      const onchainDataAvailability = false;
      const blockSize = 128;
      const blockVersion = 3;
      await registerCircuitChecked(
        blockType, onchainDataAvailability, blockSize, blockVersion, new Array(18).fill("0x123"),
        owner,
      );
      await expectThrow(
        blockVerifier.disableCircuit(
          blockType, onchainDataAvailability, blockSize, blockVersion,
          {from: anyone},
        ),
        "UNAUTHORIZED",
      );
    });
  });

});
