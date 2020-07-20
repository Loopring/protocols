import { expectThrow } from "./expectThrow";
import { Artifacts } from "../util/Artifacts";
import { Constants } from "loopringV3.js";
import BN = require("bn.js");

contract("BasicDepositContract", (accounts: string[]) => {
  let contracts: Artifacts;

  const exchange1 = accounts[0];
  const exchange2 = accounts[1];

  const owner1 = accounts[10];
  const owner2 = accounts[11];

  const vaultAddress = accounts[3];

  let depositContract: any;
  let loopringContract: any;

  let token: any;

  before(async () => {
    contracts = new Artifacts(artifacts);
  });

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

      await depositContract.transferDeposit(
        owner1,
        token.address,
        new BN(0),
        "0x",
        {
          from: exchange
        }
      );
      await depositContract.transferWithdrawal(
        owner1,
        token.address,
        new BN(0),
        "0x",
        {
          from: exchange
        }
      );
      await depositContract.transfer(owner1, owner2, token.address, new BN(0), {
        from: exchange
      });
    });

    it("should not be able to send a wrong amount of ETH in a deposit", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1, loopringContract.address);

      await expectThrow(
        depositContract.transferDeposit(
          owner1,
          Constants.zeroAddress,
          new BN(2),
          "0x",
          {
            from: exchange,
            value: new BN(1)
          }
        ),
        "INVALID_ETH_DEPOSIT"
      );
      await expectThrow(
        depositContract.transferDeposit(
          owner1,
          token.address,
          new BN(1),
          "0x",
          {
            from: exchange,
            value: new BN(1)
          }
        ),
        "INVALID_TOKEN_DEPOSIT"
      );
    });
  });

  describe("anyone", () => {
    it("should be able to withdraw tokens not owned by users on the exchange", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1, loopringContract.address);

      // ETH
      {
        await depositContract.transferDeposit(
          owner1,
          Constants.zeroAddress,
          new BN(123),
          "0x",
          { from: exchange, value: new BN(123) }
        );
        // The only way to send ETH to the contract is with deposit

        const vaultBalanceBefore = new BN(
          await web3.eth.getBalance(vaultAddress)
        );
        await depositContract.transferWithdrawalTokenNotOwnedByUsers(
          token.address
        );
        const vaultBalanceAfter = new BN(
          await web3.eth.getBalance(vaultAddress)
        );
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
        await depositContract.transferDeposit(
          owner1,
          token.address,
          new BN(123),
          "0x",
          {
            from: exchange
          }
        );
        await token.transfer(depositContract.address, new BN(456), {
          from: owner1
        });

        const vaultBalanceBefore = await token.balanceOf(vaultAddress);
        await depositContract.transferWithdrawalTokenNotOwnedByUsers(
          token.address
        );
        const vaultBalanceAfter = await token.balanceOf(vaultAddress);
        assert(
          vaultBalanceAfter.eq(vaultBalanceBefore.add(new BN(456))),
          "unexpected vault balance"
        );
      }
    });

    it("should be able to check if an address is used for ETH", async () => {
      assert(await depositContract.isETH(Constants.zeroAddress), "0x0 is ETH");
      assert(
        !(await depositContract.isETH(token.address)),
        "should not be ETH"
      );
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
        depositContract.transferDeposit(
          owner1,
          token.address,
          new BN(0),
          "0x",
          {
            from: exchange2
          }
        ),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.transferWithdrawal(
          owner1,
          token.address,
          new BN(0),
          "0x",
          {
            from: exchange2
          }
        ),
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
