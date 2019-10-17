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
  var mockImplementation: any;
  var universalRegistry: any;

  const owner = accounts[0];

  describe("UniversalRegistry related test", () => {
    before(async () => {
      mockLRC = await MockContract.new();
      mockProtocol = await MockContract.new();
      mockImplementation = await MockContract.new();

      universalRegistry = await UniversalRegistry.new(mockLRC.address, {
        from: owner
      });
    });

    describe("registerProtocol", () => {
      it("registerProtocol related", async () => {
        // mock protocol universalRegistry(), owner(), lrcAddress(), version()
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
          abi.rawEncode(["string"], ["1"])
        );

        // mock implementation version
        const implVersion = web3.utils.sha3("version()").slice(0, 10);
        await mockImplementation.givenMethodReturn(
          implVersion,
          abi.rawEncode(["string"], ["123"])
        );

        await universalRegistry.registerProtocol(
          mockProtocol.address,
          mockImplementation.address
        );
      });
    });
  });
});
