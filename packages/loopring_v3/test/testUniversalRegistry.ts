import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
import { ForgeMode } from "loopringV3.js";
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
  var mockImplementation2: any;
  var mockExchange: any;
  var universalRegistry: any;

  const costLRC = new BN(web3.utils.toWei("100", "ether"));

  const owner = accounts[0];
  const exchangeCloneAddress = accounts[1];

  const protocolVersionStr = "1";
  const protocol2VersionStr = "2";
  const implVersionStr = "123";
  const impl2VersionStr = "456";

  describe("UniversalRegistry related test", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocol = await MockContract.new();
      mockProtocol2 = await MockContract.new();
      mockImplementation = await MockContract.new();
      mockImplementation2 = await MockContract.new();
      mockExchange = await MockContract.new();

      universalRegistry = await UniversalRegistry.new(mockLRC.address, {
        from: owner
      });

      // mock mockLRC burnFrom return true
      const burnFrom = web3.utils
        .sha3("burnFrom(address,uint256)")
        .slice(0, 10);
      await mockLRC.givenMethodReturnBool(burnFrom, true);

      // mock mockProtocol2 exchangeCreationCostLRC return costLRC
      const exchangeCreationCostLRC = web3.utils
        .sha3("exchangeCreationCostLRC()")
        .slice(0, 10);
      await mockProtocol2.givenMethodReturn(
        exchangeCreationCostLRC,
        abi.rawEncode(["uint"], [costLRC])
      );

      // mock mockProtocol initializeExchange return true
      const initializeExchange = web3.utils
        .sha3("initializeExchange(address,uint256,address,address,bool)")
        .slice(0, 10);
      await mockProtocol.givenMethodReturnBool(initializeExchange, true);

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

      await mockImplementation2.givenMethodReturn(
        implVersion,
        abi.rawEncode(["string"], [impl2VersionStr])
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
            defaultImpl == mockImplementation.address &&
            defaultImplVersion == implVersionStr,
          "defaultProtocol error"
        );
      });
    });

    describe("forgeExchange", () => {
      const mode = ForgeMode.NATIVE;
      it("mock mockImplementation clone", async () => {
        const clone = web3.utils.sha3("clone()").slice(0, 10);
        await mockImplementation.givenMethodReturn(
          clone,
          abi.rawEncode(["address"], [exchangeCloneAddress])
        );

        await universalRegistry.forgeExchange(
          mode,
          true,
          mockProtocol2.address,
          mockImplementation.address
        );
      });
    });
  });
});
