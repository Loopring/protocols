import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

contract("ProtocolFeeVault", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  const MockContract = contracts.MockContract;
  const UniversalRegistry = contracts.UniversalRegistry;

  var mockLRC: any;
  var mockProtocol: any;
  var mockProtocol2: any;
  var mockImplementation: any;
  var universalRegistry: any;

  const owner = accounts[0];

  const protocolVersionStr = "1";
  const protocol2VersionStr = "2";
  const implVersionStr = "123";

  describe("UniversalRegistry related test", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocol = await MockContract.new();
      mockProtocol2 = await MockContract.new();
      mockImplementation = await MockContract.new();

      universalRegistry = await UniversalRegistry.new(mockLRC.address, {
        from: owner
      });

      // mock mockProtocol universalRegistry(), owner(), lrcAddress(), version()
      const registry = web3.utils.sha3("universalRegistry()").slice(0, 10);
      await mockProtocol.givenMethodReturn(
        registry,
        abi.rawEncode(["address"], [universalRegistry.address])
      );

      const mockOwner = web3.utils.sha3("owner()").slice(0, 10);
      await mockProtocol.givenMethodReturn(
        mockOwner,
        abi.rawEncode(["address"], [owner])
      );

      const lrcAddress = web3.utils.sha3("lrcAddress()").slice(0, 10);
      await mockProtocol.givenMethodReturn(
        lrcAddress,
        abi.rawEncode(["address"], [mockLRC.address])
      );

      const version = web3.utils.sha3("version()").slice(0, 10);
      await mockProtocol.givenMethodReturn(
        version,
        abi.rawEncode(["string"], [protocolVersionStr])
      );

      // mock implementation version
      const implVersion = web3.utils.sha3("version()").slice(0, 10);
      await mockImplementation.givenMethodReturn(
        implVersion,
        abi.rawEncode(["string"], [implVersionStr])
      );

      // mock mockProtocol2 universalRegistry(), owner(), lrcAddress(), version()
      // to test change protocol
      await mockProtocol2.givenMethodReturn(
        registry,
        abi.rawEncode(["address"], [universalRegistry.address])
      );

      await mockProtocol2.givenMethodReturn(
        mockOwner,
        abi.rawEncode(["address"], [owner])
      );

      await mockProtocol2.givenMethodReturn(
        lrcAddress,
        abi.rawEncode(["address"], [mockLRC.address])
      );

      await mockProtocol2.givenMethodReturn(
        version,
        abi.rawEncode(["string"], [protocol2VersionStr])
      );
    });

    describe("registerProtocol", () => {
      it("registerProtocol and can not register same protocol", async () => {
        // registry mockProtocol and mockImplementation
        await universalRegistry.registerProtocol(
          mockProtocol.address,
          mockImplementation.address
        );

        // can not register the same protocol
        await expectThrow(
          universalRegistry.registerProtocol(
            mockProtocol.address,
            mockImplementation.address
          ),
          "PROTOCOL_REGISTERED"
        );
      });
    });

    describe("enable/disable protocol and setDefaultProtocol", () => {
      it("can not set not registed protocol as DefaultProtocol", async () => {
        await expectThrow(
          universalRegistry.setDefaultProtocol(mockProtocol2.address),
          "NOT_REREGISTERED"
        );
      });
      it("can not set same protocol as DefaultProtocol", async () => {
        await expectThrow(
          universalRegistry.setDefaultProtocol(mockProtocol.address),
          "SAME_PROTOCOL"
        );
      });

      it("can not enable not registed protocol", async () => {
        await expectThrow(
          universalRegistry.enableProtocol(mockProtocol2.address),
          "NOT_REREGISTERED"
        );
      });

      it("can not enable already enabled protocol", async () => {
        await expectThrow(
          universalRegistry.enableProtocol(mockProtocol.address),
          "ALREADY_ENABLED"
        );
      });

      it("disable protocol", async () => {
        universalRegistry.disableProtocol(mockProtocol.address);
      });

      it("can not disable already disabled protocol", async () => {
        await expectThrow(
          universalRegistry.disableProtocol(mockProtocol.address),
          "ALREADY_DISABLED"
        );
      });

      it("registry mockProtocol2 and mockImplementation", async () => {
        await universalRegistry.registerProtocol(
          mockProtocol2.address,
          mockImplementation.address
        );
      });

      it("setDefaultProtocol to protocol2", async () => {
        universalRegistry.setDefaultProtocol(mockProtocol2.address);
      });

      it("can not set disabled protocol as DefaultProtocol", async () => {
        await expectThrow(
          universalRegistry.setDefaultProtocol(mockProtocol.address),
          "PROTOCOL_DISABLED"
        );
      });
    });

    describe("defaultProtocol", () => {
      it("check defaultProtocol", async () => {
        const {
          0: protocol,
          1: manager,
          2: defaultImpl,
          3: protocolVersion,
          4: defaultImplVersion
        } = await universalRegistry.defaultProtocol();

        assert(
          protocol == mockProtocol2.address &&
            protocolVersion == protocol2VersionStr &&
            defaultImplVersion == implVersionStr,
          "defaultProtocol error"
        );
      });
    });
  });
});
