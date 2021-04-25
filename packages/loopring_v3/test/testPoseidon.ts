import BN = require("bn.js");
import crypto = require("crypto");
import { Artifacts } from "../util/Artifacts";
import { Constants, Poseidon } from "loopringV3.js";
import { expectThrow } from "./expectThrow";

contract("Poseidon", (accounts: string[]) => {
  let poseidonContract: any;

  const getRand = () => {
    const entropy = crypto.randomBytes(32);
    return new BN(entropy.toString("hex"), 16).mod(Constants.scalarField);
  };

  before(async () => {
    const contracts = new Artifacts(artifacts);
    poseidonContract = await contracts.PoseidonContract.new();
  });

  describe("Poseidon", function() {
    this.timeout(0);

    it("Poseidon t5/f6/p52", async () => {
      const hasher = Poseidon.createHash(5, 6, 52);
      // Test some random hashes
      const numIterations = 128;
      for (let i = 0; i < numIterations; i++) {
        const t = [getRand(), getRand(), getRand(), getRand()];
        const hash = await poseidonContract.hash_t5f6p52(
          t[0],
          t[1],
          t[2],
          t[3],
          new BN(0)
        );
        const expectedHash = hasher(t);
        assert.equal(hash, expectedHash, "posseidon hash incorrect");
      }

      // Should not be possible to use an input that is larger than the field
      for (let i = 0; i < 5; i++) {
        const inputs: BN[] = [];
        for (let j = 0; j < 5; j++) {
          inputs.push(i === j ? Constants.scalarField : new BN(0));
        }
        await expectThrow(
          poseidonContract.hash_t5f6p52(...inputs),
          "INVALID_INPUT"
        );
      }
    });

    it("Poseidon t7/f6/p52", async () => {
      const hasher = Poseidon.createHash(7, 6, 52);
      // Test some random hashes
      const numIterations = 128;
      for (let i = 0; i < numIterations; i++) {
        const t = [
          getRand(),
          getRand(),
          getRand(),
          getRand(),
          getRand(),
          getRand()
        ];
        const hash = await poseidonContract.hash_t7f6p52(
          t[0],
          t[1],
          t[2],
          t[3],
          t[4],
          t[5],
          new BN(0)
        );
        const expectedHash = hasher(t);
        assert.equal(hash, expectedHash, "posseidon hash incorrect");
      }

      // Should not be possible to use an input that is larger than the field
      for (let i = 0; i < 7; i++) {
        const inputs: BN[] = [];
        for (let j = 0; j < 7; j++) {
          inputs.push(i === j ? Constants.scalarField : new BN(0));
        }
        await expectThrow(
          poseidonContract.hash_t7f6p52(...inputs),
          "INVALID_INPUT"
        );
      }
    });
  });
});
