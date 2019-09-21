import BN = require("bn.js");
import { Bitstream, expectThrow } from "protocol2-js";
import { Artifacts } from "../util/Artifacts";

const {
  TradeDelegate,
  DummyToken,
  DummyExchange,
  LRCToken,
  GTOToken,
  RDNToken,
  WETHToken,
  TESTToken,
} = new Artifacts(artifacts);

interface TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: BN;
}

contract("TradeDelegate", (accounts: string[]) => {
  const owner = accounts[0];
  const user1 = accounts[5];
  const user2 = accounts[6];
  const user3 = accounts[7];
  const user4 = accounts[8];
  const zeroAddress = "0x" + "00".repeat(20);

  let tradeDelegate: any;
  let dummyExchange1: any;
  let dummyExchange2: any;
  let dummyExchange3: any;
  let token1: string;
  let token2: string;
  let token3: string;
  let token4: string;

  let TestToken: any;
  let testToken: string;

  const addTokenTransfer = (transfers: TokenTransfer[], token: string, from: string, to: string, amount: BN) => {
    const transfer: TokenTransfer = {
      token,
      from,
      to,
      amount,
    };
    transfers.push(transfer);
  };

  const toTransferBatch = (transfers: TokenTransfer[]) => {
    const bitstream = new Bitstream();
    for (const transfer of transfers) {
      bitstream.addAddress(transfer.token, 32);
      bitstream.addAddress(transfer.from, 32);
      bitstream.addAddress(transfer.to, 32);
      bitstream.addBN(transfer.amount, 32);
    }
    return bitstream.getBytes32Array();
  };

  const setUserBalance = async (token: string, user: string, balance: BN, approved?: BN) => {
    const dummyToken = await DummyToken.at(token);
    await dummyToken.setBalance(user, balance);
    const approvedAmount = approved ? approved : balance;
    await dummyToken.approve(tradeDelegate.address, approvedAmount, {from: user});
  };

  const authorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeDelegate.authorizeAddress(address, {from: transactionOrigin});
    await assertAuthorized(address);
  };

  const deauthorizeAddressChecked = async (address: string, transactionOrigin: string) => {
    await tradeDelegate.deauthorizeAddress(address, {from: transactionOrigin});
    await assertDeauthorized(address);
  };

  const assertAuthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, true, "should be able to authorize an address");
  };

  const assertDeauthorized = async (address: string) => {
    const isAuthorizedInDelegate = await tradeDelegate.isAddressAuthorized(address);
    assert.equal(isAuthorizedInDelegate, false, "should be able to deauthorize an address");
  };

  const batchTransferChecked = async (transfers: TokenTransfer[]) => {
    // Calculate expected balances
    const balances: { [id: string]: any; } = {};
    for (const transfer of transfers) {
      const dummyToken = await DummyToken.at(transfer.token);
      if (!balances[transfer.token]) {
        balances[transfer.token] = {};
      }
      if (!balances[transfer.token][transfer.from]) {
        balances[transfer.token][transfer.from] = await dummyToken.balanceOf(transfer.from);
      }
      if (!balances[transfer.token][transfer.to]) {
        balances[transfer.token][transfer.to] = await dummyToken.balanceOf(transfer.to);
      }
      balances[transfer.token][transfer.from] = balances[transfer.token][transfer.from].sub(transfer.amount);
      balances[transfer.token][transfer.to] = balances[transfer.token][transfer.to].add(transfer.amount);
    }
    // Update fee balances
    const batch = toTransferBatch(transfers);
    await dummyExchange1.batchTransfer(batch);
    // Check if we get the expected results
    for (const transfer of transfers) {
      const dummyToken = await DummyToken.at(transfer.token);
      const balanceFrom = await dummyToken.balanceOf(transfer.from);
      const balanceTo = await dummyToken.balanceOf(transfer.to);
      const expectedBalanceFrom = balances[transfer.token][transfer.from];
      const expectedBalanceTo = balances[transfer.token][transfer.to];
      assert(balanceFrom.eq(expectedBalanceFrom), "Token balance does not match expected value");
      assert(balanceTo.eq(expectedBalanceTo), "Token balance does not match expected value");
    }
  };

  before(async () => {
    token1 = LRCToken.address;
    token2 = WETHToken.address;
    token3 = RDNToken.address;
    token4 = GTOToken.address;
  });

  beforeEach(async () => {
    tradeDelegate = await TradeDelegate.new();
    dummyExchange1 = await DummyExchange.new(tradeDelegate.address, zeroAddress, zeroAddress, zeroAddress);
    dummyExchange2 = await DummyExchange.new(tradeDelegate.address, zeroAddress, zeroAddress, zeroAddress);
    dummyExchange3 = await DummyExchange.new(tradeDelegate.address, zeroAddress, zeroAddress, zeroAddress);
    TestToken = await TESTToken.new();
    testToken = TestToken.address;
  });

  // describe("contract owner", () => {
  //   it("should be able to authorize an address", async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     await authorizeAddressChecked(dummyExchange2.address, owner);
  //     await authorizeAddressChecked(dummyExchange3.address, owner);
  //   });

  //   it("should be able to deauthorize an address", async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     await authorizeAddressChecked(dummyExchange2.address, owner);
  //     await authorizeAddressChecked(dummyExchange3.address, owner);
  //     await deauthorizeAddressChecked(dummyExchange2.address, owner);
  //     await assertAuthorized(dummyExchange1.address);
  //     await assertAuthorized(dummyExchange3.address);
  //     await deauthorizeAddressChecked(dummyExchange1.address, owner);
  //     await assertAuthorized(dummyExchange3.address);
  //     await deauthorizeAddressChecked(dummyExchange3.address, owner);
  //   });

  //   it("should not be able to authorize a non-contract address", async () => {
  //     await expectThrow(authorizeAddressChecked(zeroAddress, owner), "ZERO_ADDRESS");
  //     await expectThrow(authorizeAddressChecked(user2, owner), "INVALID_ADDRESS");
  //   });

  //   it("should not be able to authorize an address twice", async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     await expectThrow(authorizeAddressChecked(dummyExchange1.address, owner), "ALREADY_EXIST");
  //   });

  //   it("should not be able to deauthorize an unathorized address", async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     await expectThrow(deauthorizeAddressChecked(zeroAddress, owner), "ZERO_ADDRESS");
  //     await expectThrow(deauthorizeAddressChecked(dummyExchange2.address, owner), "NOT_FOUND");
  //   });

  //   it("should be able to suspend and resume the contract", async () => {
  //     await tradeDelegate.suspend({from: owner});
  //     // Try to do a transfer
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     await setUserBalance(token1, user1, web3.utils.toBN(10e18));
  //     const transfers: TokenTransfer[] = [];
  //     addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1e18));
  //     await expectThrow(batchTransferChecked(transfers), "INVALID_STATE");
  //     // Resume again
  //     await tradeDelegate.resume({from: owner});
  //     // Try the trade again
  //     await batchTransferChecked(transfers);
  //   });

  //   it("should be able to kill the contract", async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //     // Suspend is needed before kill
  //     await expectThrow(tradeDelegate.kill({from: owner}), "INVALID_STATE");
  //     await tradeDelegate.suspend({from: owner});
  //     await tradeDelegate.kill({from: owner});
  //     // Try to resume again
  //     await expectThrow(tradeDelegate.resume({from: owner}), "NOT_OWNER");
  //     // Try to do a transfer
  //     await setUserBalance(token1, user1, web3.utils.toBN(10e18));
  //     const transfers: TokenTransfer[] = [];
  //     addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1e18));
  //     await expectThrow(batchTransferChecked(transfers), "INVALID_STATE");
  //   });
  // });

  // describe("authorized address", () => {
  //   beforeEach(async () => {
  //     await authorizeAddressChecked(dummyExchange1.address, owner);
  //   });

  //   it("should be able to batch transfer tokens", async () => {
  //     // Make sure everyone has enough funds
  //     await setUserBalance(token1, user1, web3.utils.toBN(10e18));
  //     await setUserBalance(token2, user1, web3.utils.toBN(10e18));
  //     await setUserBalance(token2, user2, web3.utils.toBN(10e18));
  //     await setUserBalance(token3, user3, web3.utils.toBN(10e18));
  //     {
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1.5e18));
  //       addTokenTransfer(transfers, token1, user1, user3, web3.utils.toBN(2.5e18));
  //       addTokenTransfer(transfers, token2, user2, user3, web3.utils.toBN(2.2e18));
  //       addTokenTransfer(transfers, token2, user2, user1, web3.utils.toBN(0.3e18));
  //       addTokenTransfer(transfers, token2, user1, user3, web3.utils.toBN(2.5e18));
  //       await batchTransferChecked(transfers);
  //     }
  //     {
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, token1, user1, user3, web3.utils.toBN(1.5e18));
  //       addTokenTransfer(transfers, token3, user3, user2, web3.utils.toBN(2.5e18));
  //       addTokenTransfer(transfers, token3, user3, user1, web3.utils.toBN(1.5e18));
  //       await batchTransferChecked(transfers);
  //     }
  //     {
  //       const transfers: TokenTransfer[] = [];
  //       // No tokens to be transfered
  //       addTokenTransfer(transfers, token1, user1, user3, web3.utils.toBN(0));
  //       // From == To
  //       addTokenTransfer(transfers, token3, user3, user3, web3.utils.toBN(2.5e18));
  //       await batchTransferChecked(transfers);
  //     }
  //   });

  //   it("should not be able to batch transfer tokens with malformed data", async () => {
  //     await setUserBalance(token1, user1, web3.utils.toBN(10e18));
  //     const transfers: TokenTransfer[] = [];
  //     addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1e18));
  //     addTokenTransfer(transfers, token1, user1, user3, web3.utils.toBN(2e18));
  //     const batch = toTransferBatch(transfers);
  //     batch.pop();
  //     await expectThrow(dummyExchange1.batchTransfer(batch), "INVALID_SIZE");
  //   });

  //   it("should not be able to batch transfer tokens with non-ERC20 token address", async () => {
  //     const transfers: TokenTransfer[] = [];
  //     addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1e18));
  //     const batch = toTransferBatch(transfers);
  //     await expectThrow(dummyExchange1.batchTransfer(batch), "TRANSFER_FAILURE");
  //   });

  //   it("should not be able to authorize an address", async () => {
  //     await expectThrow(dummyExchange1.authorizeAddress(dummyExchange2.address), "NOT_OWNER");
  //   });

  //   it("should not be able to deauthorize an address", async () => {
  //     await expectThrow(dummyExchange1.authorizeAddress(dummyExchange1.address), "NOT_OWNER");
  //   });

  //   it("should not be able to suspend and resume the contract", async () => {
  //     await expectThrow(dummyExchange1.suspend(), "NOT_OWNER");
  //     await tradeDelegate.suspend({from: owner});
  //     // Try to resume again
  //     await expectThrow(dummyExchange1.resume(), "NOT_OWNER");
  //     await tradeDelegate.resume({from: owner});
  //   });

  //   describe("Bad ERC20 tokens", () => {
  //     it("batchTransfer should succeed when a token transfer does not throw and returns nothing", async () => {
  //       await TestToken.setTestCase(await TestToken.TEST_NO_RETURN_VALUE());
  //       await setUserBalance(testToken, user1, web3.utils.toBN(10e18));
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, testToken, user1, user2, web3.utils.toBN(1e18));
  //       await batchTransferChecked(transfers);
  //     });

  //     it("batchTransfer should fail when a token transfer 'require' fails", async () => {
  //       await TestToken.setTestCase(await TestToken.TEST_REQUIRE_FAIL());
  //       await setUserBalance(testToken, user1, web3.utils.toBN(10e18));
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, testToken, user1, user2, web3.utils.toBN(1e18));
  //       const batch = toTransferBatch(transfers);
  //       await expectThrow(dummyExchange1.batchTransfer(batch), "TRANSFER_FAILURE");
  //     });

  //     it("batchTransfer should fail when a token transfer returns false", async () => {
  //       await TestToken.setTestCase(await TestToken.TEST_RETURN_FALSE());
  //       await setUserBalance(testToken, user1, web3.utils.toBN(10e18));
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, testToken, user1, user2, web3.utils.toBN(1e18));
  //       const batch = toTransferBatch(transfers);
  //       await expectThrow(dummyExchange1.batchTransfer(batch), "TRANSFER_FAILURE");
  //     });

  //     it("batchTransfer should fail when a token transfer returns more than 32 bytes", async () => {
  //       await TestToken.setTestCase(await TestToken.TEST_INVALID_RETURN_SIZE());
  //       await setUserBalance(testToken, user1, web3.utils.toBN(10e18));
  //       const transfers: TokenTransfer[] = [];
  //       addTokenTransfer(transfers, testToken, user1, user2, web3.utils.toBN(1e18));
  //       const batch = toTransferBatch(transfers);
  //       await expectThrow(dummyExchange1.batchTransfer(batch), "TRANSFER_FAILURE");
  //     });
  //   });

  // });

  // describe("anyone", () => {
  //   it("should not be able to transfer tokens", async () => {
  //     // Make sure everyone has enough funds
  //     await setUserBalance(token1, user1, web3.utils.toBN(10e18));
  //     const transfers: TokenTransfer[] = [];
  //     addTokenTransfer(transfers, token1, user1, user2, web3.utils.toBN(1e18));
  //     await expectThrow(batchTransferChecked(transfers), "UNAUTHORIZED");
  //   });
  // });
});
