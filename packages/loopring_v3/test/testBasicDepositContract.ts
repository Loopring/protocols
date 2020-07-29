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

  let depositContract: any;

  let token: any;

  before(async () => {
    contracts = new Artifacts(artifacts);
  });

  beforeEach(async () => {
    depositContract = await contracts.BasicDepositContract.new();
    token = await contracts.LRCToken.new({ from: owner1 });
  });

  describe("exchange", () => {
    it("should be to call the interface functions", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1);

      await depositContract.deposit(owner1, token.address, new BN(0), "0x", {
        from: exchange
      });
      await depositContract.withdraw(owner1, owner1, token.address, new BN(0), "0x", {
        from: exchange
      });
      await depositContract.transfer(owner1, owner2, token.address, new BN(0), {
        from: exchange
      });
    });

    it("should not be able to send a wrong amount of ETH in a deposit", async () => {
      const exchange = exchange1;
      await depositContract.initialize(exchange1);

      await expectThrow(
        depositContract.deposit(owner1, Constants.zeroAddress, new BN(2), "0x", {
          from: exchange,
          value: new BN(1)
        }),
        "INVALID_ETH_DEPOSIT"
      );
      await expectThrow(
        depositContract.deposit(owner1, token.address, new BN(1), "0x", {
          from: exchange,
          value: new BN(1)
        }),
        "INVALID_TOKEN_DEPOSIT"
      );
    });
  });

  describe("anyone", () => {
    it("should be able to check if an address is used for ETH", async () => {
      assert(await depositContract.isETH(Constants.zeroAddress), "0x0 is ETH");
      assert(
        !(await depositContract.isETH(token.address)),
        "should not be ETH"
      );
    });

    it("should not be able to initialize again", async () => {
      await depositContract.initialize(exchange1);
      await expectThrow(
        depositContract.initialize(exchange2),
        "INVALID_EXCHANGE"
      );
    });

    it("should not be able to call the interface functions", async () => {
      await depositContract.initialize(exchange1);
      await expectThrow(
        depositContract.deposit(owner1, token.address, new BN(0), "0x", {
          from: exchange2
        }),
        "UNAUTHORIZED"
      );
      await expectThrow(
        depositContract.withdraw(owner1, owner1, token.address, new BN(0), "0x", {
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
