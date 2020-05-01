import { expectThrow } from "./expectThrow";
import { Artifacts } from "../util/Artifacts";
import { Constants } from "loopringV3.js";
import BN = require("bn.js");

contract("BasicDepositContract", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);

  const exchange1 = accounts[0];
  const exchange2 = accounts[1];
  const exchange3 = accounts[2];

  const owner1 = accounts[10];
  const owner2 = accounts[11];

  const vaultAddress = accounts[3];

  let depositContract: any;
  let loopringContract: any;

  let token: any;

  beforeEach(async () => {
    depositContract = await contracts.BasicDepositContract.new();
    loopringContract = await contracts.MockContract.new();
    await loopringContract.givenAnyReturnAddress(vaultAddress);

    token = await contracts.LRCToken.new({ from: owner1 });
  });

  describe("exchange", () => {
    it("should be to call the interface functions", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1, loopringContract.address);

      await depositContract.deposit(owner1, token.address, new BN(0), {
        from: exchange
      });
      await depositContract.withdraw(owner1, token.address, new BN(0), {
        from: exchange
      });
      await depositContract.transfer(owner1, owner2, token.address, new BN(0), {
        from: exchange
      });
    });
  });

  describe("anyone", () => {
    it("should be able to withdraw tokens not owned by users on the exchange", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1, loopringContract.address);

      // ETH
      {
        await depositContract.deposit(
          owner1,
          Constants.zeroAddress,
          new BN(123),
          { from: exchange, value: new BN(123) }
        );
        // The only way to send ETH to the contract is with deposit

        const vaultBalanceBefore = new BN(
          await web3.eth.getBalance(vaultAddress)
        );
        await depositContract.withdrawTokenNotOwnedByUsers(token.address);
        const vaultBalanceAfter = new BN(
          await web3.eth.getBalance(vaultAddress)
        );
        console.log("vaultBalanceBefore: " + vaultBalanceBefore.toString(10));
        console.log("vaultBalanceAfter: " + vaultBalanceAfter.toString(10));
        assert(
          vaultBalanceAfter.eq(vaultBalanceBefore),
          "unexpected vault balance"
        );
      }

      // ERC20
      {
        await token.approve(depositContract.address, new BN(123), {
          from: owner1
        });
        await depositContract.deposit(owner1, token.address, new BN(123), {
          from: exchange
        });
        await token.transfer(depositContract.address, new BN(456), {
          from: owner1
        });

        const vaultBalanceBefore = await token.balanceOf(vaultAddress);
        await depositContract.withdrawTokenNotOwnedByUsers(token.address);
        const vaultBalanceAfter = await token.balanceOf(vaultAddress);
        console.log("vaultBalanceBefore: " + vaultBalanceBefore.toString(10));
        console.log("vaultBalanceAfter: " + vaultBalanceAfter.toString(10));
        assert(
          vaultBalanceAfter.eq(vaultBalanceBefore.add(new BN(456))),
          "unexpected vault balance"
        );
      }
    });

    it("should not be able to initialize again", async () => {
      await depositContract.initialize(exchange1, loopringContract.address);
      await expectThrow(
        depositContract.initialize(exchange2, loopringContract.address),
        "INITIALIZED"
      );
    });

    it("should not be to call the interface functions", async () => {
      await depositContract.initialize(exchange1, loopringContract.address);
      await expectThrow(
        depositContract.deposit(owner1, token.address, new BN(0), {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.withdraw(owner1, token.address, new BN(0), {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.transfer(owner1, owner2, token.address, new BN(0), {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
    });
  });
});
