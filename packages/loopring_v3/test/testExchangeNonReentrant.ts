import BN = require("bn.js");
import fs = require("fs");
import { Constants } from "loopringV3.js";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil, OnchainBlock } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {
  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const createExchange = async (bSetupTestState: boolean = true) => {
    await exchangeTestUtil.createExchange(
      exchangeTestUtil.testContext.stateOwners[0],
      bSetupTestState
    );
    exchange = exchangeTestUtil.exchange;
  };

  before(async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  after(async () => {
    await exchangeTestUtil.stop();
  });

  describe("Reentrancy", function() {
    this.timeout(0);

    // Load IExchange ABI
    const ABIPath = "ABI/version30/";
    const exchangeABI = JSON.parse(
      fs.readFileSync(ABIPath + "IExchangeV3.abi", "ascii")
    );
    // console.log(exchangeABI);

    // Get all exeternal functions
    const externalFunctions: any[] = [];
    for (const entry of exchangeABI) {
      if (entry.type === "function" && entry.stateMutability !== "view" && entry.stateMutability !== "pure") {
        externalFunctions.push(entry);
      }
    }
    // console.log(externalFunctions);
    assert(externalFunctions.length > 0, "Solidity ABI was updated!");

    for (const externalFunction of externalFunctions) {
      // Do not test the following methods inherited from Claimable.
      if (
        externalFunction.name == "transferOwnership" ||
        externalFunction.name == "renounceOwnership" ||
        externalFunction.name == "claimOwnership"
      ) {
        continue;
      }

      it(externalFunction.name, async () => {
        await createExchange();

        // Enable expensive token transfer testing on the TEST token
        const testTokenAddress = await exchangeTestUtil.getTokenAddress("TEST");
        const TestToken = await exchangeTestUtil.contracts.TESTToken.at(
          testTokenAddress
        );
        const owner = exchangeTestUtil.testContext.orderOwners[0];
        const amount = new BN(web3.utils.toWei("7", "ether"));

        // The correct deposit fee expected by the contract
        const fees = await exchange.getFees();
        const accountCreationFee = fees._accountCreationFeeETH;
        const depositFee = fees._depositFeeETH;

        // Set the correct balance/approval
        await exchangeTestUtil.setBalanceAndApprove(
          owner,
          testTokenAddress,
          amount
        );

        // Enable the test
        await TestToken.setExchangeAddress(exchange.address);
        await TestToken.setTestCase(await TestToken.TEST_REENTRANCY());

        const values: any[] = [];
        for (const input of externalFunction.inputs) {
          if (input.type === "address") {
            values.push(Constants.zeroAddress);
          } else if (input.type.startsWith("address[]")) {
            values.push([Constants.zeroAddress]);
          } else if (input.type.startsWith("bool[]")) {
            values.push([false]);
          } else if (input.type === "bytes") {
            values.push(web3.utils.hexToBytes("0x"));
          } else if (
            input.internalType.startsWith("struct ExchangeData.Block[]")
          ) {
            const block: OnchainBlock = {
              blockType: 0,
              blockSize: 1,
              blockVersion: 0,
              data: Constants.emptyBytes,
              proof: [0, 0, 0, 0, 0, 0, 0, 0],
              offchainData: Constants.emptyBytes,
              auxiliaryData: Constants.emptyBytes
            };
            values.push([block]);
          } else if (input.type.startsWith("uint256[][]")) {
            values.push([new Array(1).fill("0")]);
          } else if (input.type.startsWith("uint256[]")) {
            values.push(new Array(1).fill("0"));
          } else if (input.type.startsWith("uint256[8]")) {
            values.push(new Array(8).fill("0"));
          } else if (input.type.startsWith("uint256[15]")) {
            values.push(new Array(15).fill("0"));
          } else if (input.type.startsWith("uint256[36]")) {
            values.push(new Array(36).fill("0"));
          } else {
            values.push("0");
          }
        }
        const calldata = web3.eth.abi.encodeFunctionCall(
          externalFunction,
          values
        );
        await TestToken.setCalldata(web3.utils.hexToBytes(calldata));

        // TESTToken will check if the revert message is REENTRANCY.
        const ethToSend = accountCreationFee.add(depositFee);
        await expectThrow(
          exchange.updateAccountAndDeposit(
            owner,
            new BN(1),
            new BN(0),
            testTokenAddress,
            web3.utils.toBN(amount),
            Constants.emptyBytes,
            { from: owner, value: ethToSend }
          ),
          "TRANSFER_FAILURE"
        );

        // Disable the test and deposit again
        await TestToken.setTestCase(await TestToken.TEST_NOTHING());
        exchange.updateAccountAndDeposit(
          owner,
          new BN(1),
          new BN(0),
          testTokenAddress,
          web3.utils.toBN(amount),
          Constants.emptyBytes,
          { from: owner, value: ethToSend }
        );
      });
    }
  });
});
