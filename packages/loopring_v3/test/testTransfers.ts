import BN = require("bn.js");
import { Artifacts } from "../util/Artifacts";
import { expectThrow } from "./expectThrow";

contract("Transfers", (accounts: string[]) => {
  let contracts: Artifacts;

  let transferContract: any;
  let testToken: any;
  let noDefaultFunctionContract: any;

  const deployer = accounts[0];
  const accountA = accounts[1];

  const maxGas = new BN(8000000);
  const maxAmount = new BN(web3.utils.toWei("1000000", "ether"));

  before(async () => {
    contracts = new Artifacts(artifacts);
    transferContract = await contracts.TransferContract.new({ from: deployer });
    testToken = await contracts.TESTToken.new({ from: deployer });
    noDefaultFunctionContract = await contracts.PoseidonContract.new({
      from: deployer
    });
    // Approve the transferContract for the 'transferFrom' tests
    await testToken.approve(transferContract.address, maxAmount);
    // Send some tokens to the transferContract for the 'transfer' tests
    await testToken.transfer(transferContract.address, maxAmount, {
      from: deployer
    });
    // Send tome ETH to the contract for the 'ETH' tests
    await web3.eth.sendTransaction({
      from: deployer,
      to: transferContract.address,
      value: new BN(web3.utils.toWei("1", "ether"))
    });
  });

  describe("ERC20.transferFrom", () => {
    it("should succeed when a token transfer behaves normally", async () => {
      await testToken.setTestCase(await testToken.TEST_NOTHING());
      await transferContract.safeTransferFromWithGasLimit(
        testToken.address,
        deployer,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should succeed when a token transfer does not throw and returns nothing", async () => {
      await testToken.setTestCase(await testToken.TEST_NO_RETURN_VALUE());
      await transferContract.safeTransferFromWithGasLimit(
        testToken.address,
        deployer,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should succeed when a token transfer returns nothing and the call succeeds", async () => {
      await testToken.setTestCase(await testToken.TEST_NO_RETURN_VALUE());
      transferContract.safeTransferFromWithGasLimit(
        testToken.address,
        deployer,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should fail when a token transfer 'require' fails", async () => {
      await testToken.setTestCase(await testToken.TEST_REQUIRE_FAIL());
      await expectThrow(
        transferContract.safeTransferFromWithGasLimit(
          testToken.address,
          deployer,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer returns false", async () => {
      await testToken.setTestCase(await testToken.TEST_RETURN_FALSE());
      await expectThrow(
        transferContract.safeTransferFromWithGasLimit(
          testToken.address,
          deployer,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer returns more than 32 bytes", async () => {
      await testToken.setTestCase(await testToken.TEST_INVALID_RETURN_SIZE());
      await expectThrow(
        transferContract.safeTransferFromWithGasLimit(
          testToken.address,
          deployer,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer consumes more gas than allowed", async () => {
      await testToken.setTestCase(await testToken.TEST_EXPENSIVE_TRANSFER());
      // Low gas limit
      await expectThrow(
        transferContract.safeTransferFromWithGasLimit(
          testToken.address,
          deployer,
          accountA,
          new BN(1),
          5000
        ),
        "TRANSFER_FAILURE"
      );
      // High gas limit
      transferContract.safeTransferFromWithGasLimit(
        testToken.address,
        deployer,
        accountA,
        new BN(1),
        maxGas
      );
    });
  });

  describe("ERC20.transfer", () => {
    it("should succeed when a token transfer behaves normally", async () => {
      await testToken.setTestCase(await testToken.TEST_NOTHING());
      await transferContract.safeTransferWithGasLimit(
        testToken.address,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should succeed when a token transfer does not throw and returns nothing", async () => {
      await testToken.setTestCase(await testToken.TEST_NO_RETURN_VALUE());
      await transferContract.safeTransferWithGasLimit(
        testToken.address,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should succeed when a token transfer returns nothing and the call succeeds", async () => {
      await testToken.setTestCase(await testToken.TEST_NO_RETURN_VALUE());
      transferContract.safeTransferWithGasLimit(
        testToken.address,
        accountA,
        new BN(1),
        maxGas
      );
    });

    it("should fail when a token transfer 'require' fails", async () => {
      await testToken.setTestCase(await testToken.TEST_REQUIRE_FAIL());
      await expectThrow(
        transferContract.safeTransferWithGasLimit(
          testToken.address,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer returns false", async () => {
      await testToken.setTestCase(await testToken.TEST_RETURN_FALSE());
      await expectThrow(
        transferContract.safeTransferWithGasLimit(
          testToken.address,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer returns more than 32 bytes", async () => {
      await testToken.setTestCase(await testToken.TEST_INVALID_RETURN_SIZE());
      await expectThrow(
        transferContract.safeTransferWithGasLimit(
          testToken.address,
          accountA,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a token transfer consumes more gas than allowed", async () => {
      await testToken.setTestCase(await testToken.TEST_EXPENSIVE_TRANSFER());
      // Low gas limit
      await expectThrow(
        transferContract.safeTransferWithGasLimit(
          testToken.address,
          accountA,
          new BN(1),
          5000
        ),
        "TRANSFER_FAILURE"
      );
      // High gas limit
      transferContract.safeTransferWithGasLimit(
        testToken.address,
        accountA,
        new BN(1),
        maxGas
      );
    });
  });

  describe("ETH", () => {
    it("should succeed when the recipient behaves normally", async () => {
      await transferContract.sendETH(
        transferContract.address,
        new BN(1),
        maxGas
      );
    });

    it("should fail when a transfer is done to a contract without fallback function", async () => {
      await transferContract.setTestCase(
        await transferContract.TEST_REQUIRE_FAIL()
      );
      await expectThrow(
        transferContract.sendETH(
          noDefaultFunctionContract.address,
          new BN(1),
          maxGas
        ),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a transfer 'require' fails", async () => {
      await transferContract.setTestCase(
        await transferContract.TEST_REQUIRE_FAIL()
      );
      await expectThrow(
        transferContract.sendETH(transferContract.address, new BN(1), maxGas),
        "TRANSFER_FAILURE"
      );
    });

    it("should fail when a transfer consumes more gas than allowed", async () => {
      await transferContract.setTestCase(
        await transferContract.TEST_EXPENSIVE_TRANSFER()
      );
      // Low gas limit
      await expectThrow(
        transferContract.sendETH(transferContract.address, new BN(1), 5000),
        "TRANSFER_FAILURE"
      );
      // High gas limit
      transferContract.sendETH(transferContract.address, new BN(1), maxGas);
    });
  });
});
