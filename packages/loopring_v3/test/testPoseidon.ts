import BN = require("bn.js");
import crypto = require("crypto");
import { Artifacts } from "../util/Artifacts";
import poseidon = require("./poseidon");

contract("Poseidon", (accounts: string[]) => {
  const contracts = new Artifacts(artifacts);
  let poseidonContract: any;

  const getRand = () => {
    const entropy = crypto.randomBytes(32);
    return new BN(entropy.toString("hex"), 16);
  };

  before(async () => {
    poseidonContract = await contracts.PoseidonContract.new();
  });

  it("Poseidon t5/f6/p52", async () => {
    const hasher = poseidon.createHash(5, 6, 52);
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
  });
});
