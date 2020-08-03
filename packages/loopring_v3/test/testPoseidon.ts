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

  it("Poseidon t6/f6/p52", async () => {
    const hasher = Poseidon.createHash(6, 6, 52);
    // Test some random hashes
    const numIterations = 128;
    for (let i = 0; i < numIterations; i++) {
      const t = [getRand(), getRand(), getRand(), getRand(), getRand()];
      const hash = await poseidonContract.hash_t6f6p52(
        t[0],
        t[1],
        t[2],
        t[3],
        t[4],
        new BN(0)
      );
      const expectedHash = hasher(t);
      assert.equal(hash, expectedHash, "posseidon hash incorrect");
    }

    // Should not be possible to use an input that is larger than the field
    for (let i = 0; i < 6; i++) {
      const inputs: BN[] = [];
      for (let j = 0; j < 6; j++) {
        inputs.push(i === j ? Constants.scalarField : new BN(0));
      }
      await expectThrow(
        poseidonContract.hash_t6f6p52(...inputs),
        "INVALID_INPUT"
      );
    }
  });
});
