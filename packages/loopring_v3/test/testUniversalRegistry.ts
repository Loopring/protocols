import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";
import BN = require("bn.js");
import { ForgeMode } from "loopringV3.js";
const truffleAssert = require("truffle-assertions");
const abi = require("ethereumjs-abi");

contract("UniversalRegistry", (accounts: string[]) => {
  let contracts: Artifacts;
  let MockContract: any;
  let UniversalRegistry: any;

  var mockLRC: any;
  var mockProtocol: any;
  var mockProtocol2: any;
  var mockProtocol3: any;
  var mockImplementation: any;
  var universalRegistry: any;
  var exchangeAddress: any;

  const costLRC = new BN(web3.utils.toWei("100", "ether"));

  const owner = accounts[0];
  const exchangeCloneAddress = accounts[1];
  const testExchangeAddress = accounts[2];

  const protocolVersionStr = "1";
  const protocol2VersionStr = "2";
  const implVersionStr = "123";

  const genesisMerkleRoot = "0x0123456789abcdef000000000000000000000000000000000000000000000000";

  before(async () => {
    contracts = new Artifacts(artifacts);
    MockContract = contracts.MockContract;
    UniversalRegistry = contracts.UniversalRegistry;
  });

  describe("UniversalRegistry related test", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocol = await MockContract.new();
      mockProtocol2 = await MockContract.new();
      mockProtocol3 = await MockContract.new();
      mockImplementation = await MockContract.new();

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
      // mock mockProtocol2 protocolFeeVault return some address
      const protocolFeeVault = web3.utils
        .sha3("protocolFeeVault()")
        .slice(0, 10);
      await mockProtocol2.givenMethodReturn(
        protocolFeeVault,
        abi.rawEncode(["address"], [mockLRC.address])
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

      // mock implementation version
      const implVersion = web3.utils.sha3("version()").slice(0, 10);
      await mockImplementation.givenMethodReturn(
        implVersion,
        abi.rawEncode(["string"], [implVersionStr])
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
          "NOT_REGISTERED"
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
          "NOT_REGISTERED"
        );
      });

      it("can not enable already enabled protocol", async () => {
        await expectThrow(
          universalRegistry.enableProtocol(mockProtocol.address),
          "ALREADY_ENABLED"
        );
      });

      it("disable mockProtocol", async () => {
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

      it("setDefaultProtocol to mockProtocol2", async () => {
        universalRegistry.setDefaultProtocol(mockProtocol2.address);
      });

      it("can not set disabled protocol as DefaultProtocol", async () => {
        await expectThrow(
          universalRegistry.setDefaultProtocol(mockProtocol.address),
          "PROTOCOL_DISABLED"
        );
      });
    });

    describe("forgeExchange", () => {
      it("forgeExchange in AUTO_UPGRADABLE mode", async () => {
        const auto_mode = ForgeMode.AUTO_UPGRADABLE;
        const tx = await universalRegistry.forgeExchange(
          auto_mode,
          mockProtocol2.address,
          mockImplementation.address,
          genesisMerkleRoot
        );
        truffleAssert.eventEmitted(tx, "ExchangeForged", (evt: any) => {
          exchangeAddress = evt.exchangeAddress;
          return evt.forgeMode == auto_mode &&
            evt.genesisMerkleRoot == genesisMerkleRoot;
        });
      });

      it("forgeExchange in MANUAL_UPGRADABLE mode", async () => {
        const manual_mode = ForgeMode.MANUAL_UPGRADABLE;
        const tx = await universalRegistry.forgeExchange(
          manual_mode,
          mockProtocol2.address,
          mockImplementation.address,
          genesisMerkleRoot
        );
        truffleAssert.eventEmitted(tx, "ExchangeForged", (evt: any) => {
          exchangeAddress = evt.exchangeAddress;
          return evt.forgeMode == manual_mode &&
            evt.genesisMerkleRoot == genesisMerkleRoot;
        });
      });

      it("forgeExchange in PROXIED mode", async () => {
        const proxied_mode = ForgeMode.PROXIED;
        const tx = await universalRegistry.forgeExchange(
          proxied_mode,
          mockProtocol2.address,
          mockImplementation.address,
          genesisMerkleRoot
        );
        truffleAssert.eventEmitted(tx, "ExchangeForged", (evt: any) => {
          exchangeAddress = evt.exchangeAddress;
          return evt.forgeMode == proxied_mode &&
            evt.genesisMerkleRoot == genesisMerkleRoot;
        });
      });

      it("forgeExchange in NATIVE mode", async () => {
        const native_mode = ForgeMode.NATIVE;
        // mock clone()
        const clone = web3.utils.sha3("clone()").slice(0, 10);
        await mockImplementation.givenMethodReturn(
          clone,
          abi.rawEncode(["address"], [exchangeCloneAddress])
        );
        const tx = await universalRegistry.forgeExchange(
          native_mode,
          mockProtocol2.address,
          mockImplementation.address,
          genesisMerkleRoot
        );
        truffleAssert.eventEmitted(tx, "ExchangeForged", (evt: any) => {
          exchangeAddress = evt.exchangeAddress;
          return evt.forgeMode == native_mode &&
            evt.genesisMerkleRoot == genesisMerkleRoot;
        });
      });

      it("forgeExchange can not in other mode", async () => {
        const mode = 10;
        await expectThrow(
          universalRegistry.forgeExchange(
            mode,
            mockProtocol2.address,
            mockImplementation.address,
            genesisMerkleRoot
          ),
          "VM Exception while processing transaction"
        );
      });
    });

    describe("check UniversalRegistry status", () => {
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

      it("check mockProtocol registered true", async () => {
        const enabled = await universalRegistry.isProtocolRegistered(
          mockProtocol.address
        );
        assert(enabled == true, "isProtocolRegistered error");
      });

      it("check mockProtocol3 registered false", async () => {
        const enabled = await universalRegistry.isProtocolRegistered(
          mockProtocol3.address
        );
        assert(enabled == false, "isProtocolRegistered error");
      });

      it("check mockProtocol not enabled", async () => {
        const enabled = await universalRegistry.isProtocolEnabled(
          mockProtocol.address
        );
        assert(enabled == false, "isProtocolEnabled error");
      });

      it("check mockProtocol2 is enabled", async () => {
        const enabled = await universalRegistry.isProtocolEnabled(
          mockProtocol2.address
        );
        assert(enabled == true, "isProtocolEnabled error");
      });

      it("check mockProtocol3 not enabled", async () => {
        const enabled = await universalRegistry.isProtocolEnabled(
          mockProtocol3.address
        );
        assert(enabled == false, "isProtocolEnabled error");
      });

      it("check exchangeAddress registered", async () => {
        const registered = await universalRegistry.isExchangeRegistered(
          exchangeAddress
        );
        assert(registered == true, "isExchangeRegistered error");
      });

      it("check testExchangeAddress not registered", async () => {
        const registered = await universalRegistry.isExchangeRegistered(
          testExchangeAddress
        );
        assert(registered == false, "isExchangeRegistered error");
      });

      it("check mockProtocol2 and mockImplementation enabled", async () => {
        const enabled = await universalRegistry.isProtocolAndImplementationEnabled(
          mockProtocol2.address,
          mockImplementation.address
        );
        assert(enabled == true, "isProtocolAndImplementationEnabled error");
      });

      it("check mockProtocol3 and mockImplementation not enabled", async () => {
        const enabled = await universalRegistry.isProtocolAndImplementationEnabled(
          mockProtocol3.address,
          mockImplementation.address
        );
        assert(enabled == false, "isProtocolAndImplementationEnabled error");
      });

      it("check getExchangeProtocol", async () => {
        const {
          0: protocol,
          1: manager
        } = await universalRegistry.getExchangeProtocol(exchangeAddress);
        assert(protocol == mockProtocol2.address, "getExchangeProtocol error");
      });
    });

    describe("enableProtocol", () => {
      it("enable mockProtocol at end", async () => {
        universalRegistry.enableProtocol(mockProtocol.address);
      });
    });
  });
});
