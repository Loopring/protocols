import BN = require("bn.js");
import fs = require("fs");
import * as constants from "./constants";
import { expectThrow } from "./expectThrow";
import { ExchangeTestUtil } from "./testExchangeUtil";

contract("Exchange", (accounts: string[]) => {

  let exchangeTestUtil: ExchangeTestUtil;
  let exchange: any;

  const createExchange = async (bSetupTestState: boolean = true) => {
    await exchangeTestUtil.createExchange(exchangeTestUtil.testContext.stateOwners[0], bSetupTestState);
    exchange = exchangeTestUtil.exchange;
  };

  before( async () => {
    exchangeTestUtil = new ExchangeTestUtil();
    await exchangeTestUtil.initialize(accounts);
    exchange = exchangeTestUtil.exchange;
  });

  describe("Reentrancy", function() {
    this.timeout(0);

    // Load IExchange ABI
    const ABIPath = "ABI/version30/";
    const exchangeABI = JSON.parse(fs.readFileSync(ABIPath + "IExchange.abi", "ascii"));
    // console.log(exchangeABI);

    // Get all exeternal functions
    const externalFunctions: any[] = [];
    for (const entry of exchangeABI) {
      if (entry.type === "function" && entry.constant === false) {
        externalFunctions.push(entry);
      }
    }
    // console.log(externalFunctions);

    for (const externalFunction of externalFunctions) {
      it(externalFunction.name, async () => {
        await createExchange();

        // Enable expensive token transfer testing on the TEST token
        const testTokenAddress = await exchangeTestUtil.getTokenAddress("TEST");
        const TestToken = await exchangeTestUtil.contracts.TESTToken.at(testTokenAddress);
        const owner = exchangeTestUtil.testContext.orderOwners[0];
        const amount = new BN(web3.utils.toWei("7", "ether"));

        // The correct deposit fee expected by the contract
        const fees = await exchange.getFees();
        const accountCreationFee = fees._accountCreationFeeETH;
        const depositFee = fees._depositFeeETH;

        // Set the correct balance/approval
        await exchangeTestUtil.setBalanceAndApprove(owner, testTokenAddress, amount);

        // Enable the test
        await TestToken.setExchangeAddress(exchange.address);
        await TestToken.setTestCase(await TestToken.TEST_REENTRANCY());

        const values: any[] = [];
        for (const input of externalFunction.inputs) {
          if (input.type === "address") {
            values.push(constants.zeroAddress);
          } else if (input.type === "bytes") {
            values.push(web3.utils.hexToBytes("0x"));
          } else if (input.type.startsWith("uint256[8]")) {
            values.push(new Array(8).fill("0"));
          } else if (input.type.startsWith("uint256[20]")) {
            values.push(new Array(20).fill("0"));
          } else {
            values.push("0");
          }
        }
        const calldata = web3.eth.abi.encodeFunctionCall(
          externalFunction,
          values,
        );
        await TestToken.setCalldata(web3.utils.hexToBytes(calldata));

        // TESTToken will check if the revert message is REENTRANCY.
        const ethToSend = accountCreationFee.add(depositFee);
        await expectThrow(
          exchange.updateAccountAndDeposit(
            new BN(0),
            new BN(0),
            testTokenAddress,
            web3.utils.toBN(amount),
            {from: owner, value: ethToSend},
          ),
          "INSUFFICIENT_FUND",
        );

        // Disable the test and deposit again
        await TestToken.setTestCase(await TestToken.TEST_NOTHING());
        exchange.updateAccountAndDeposit(
          new BN(0),
          new BN(0),
          testTokenAddress,
          web3.utils.toBN(amount),
          {from: owner, value: ethToSend},
        );
      });
    }
  });
});
