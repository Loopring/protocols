import { expectThrow } from "protocol2-js";
import * as pjs from "protocol2-js";
import { compressLZ, decompressLZ } from "./compression";

const LzDecompressor = artifacts.require("LzDecompressor");

contract("Compression", (accounts: string[]) => {

  let lzDecompressor: any;

  const compressLZChecked = (data: string) => {
    const compressed = compressLZ(data);
    const decompressed = decompressLZ(compressed);
    assert.equal(data, decompressed, "decompressed data differs from input");
    return compressed;
  };

  const decompressLZChecked = async (data: string) => {
    const decompressedEVM = await lzDecompressor.decompress(data);
    const decompressedCPU = decompressLZ(data);
    assert.equal(decompressedEVM, decompressedCPU, "decompressed data from EVM differs from CPU");

    const gasUsed = await lzDecompressor.decompress.estimateGas(data);
    // console.log("\x1b[46m%s\x1b[0m", "[Decompress] Gas used: " + gasUsed);

    return decompressedEVM;
  };

  const compressAndDecompressLZChecked = async (data: string) => {
    const compressed = compressLZChecked(data);
    await decompressLZChecked(compressed);
    // console.log("compressed: " + compressed);
    return compressed;
  };

  before(async () => {
    lzDecompressor = await LzDecompressor.new();
  });

  describe("LZ compression", () => {
    it("Test data", async () => {
      const data = "0x0123456789987654301111111111111111111111111115548914444444444444121288412354425140000000000000" +
                   "151156455787878787878787878787878454000000000000000000000000000000000000456487844878984567000000";
      await compressAndDecompressLZChecked(data);
    });

    it("Random data", async () => {
      const numRounds = 8;
      const maxLength = 25 * 1000;
      for (let r = 0; r < numRounds; r++) {
        const bitstream = new pjs.Bitstream();
        const length = 1 + Math.floor(Math.random() * maxLength);
        for (let i = 0; i < length; i++) {
          const byte = Math.floor(Math.random() * 256);
          bitstream.addNumber(byte, 1, true);
        }
        await compressAndDecompressLZChecked(bitstream.getData());
      }
    });

    it("n-byte sequences", async () => {
      const testString = "f00102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
      const numTimesRepeated = 79 + Math.floor(Math.random() * 79);
      for (let length = 1; length <= 32; length++) {
        const testSlice = testString.slice(0, 2 * length);
        // console.log(testSlice);
        const data = "0x456448498646548949856465" +
                      testSlice.repeat(numTimesRepeated) +
                     "87441877454578454698744779";
        await compressAndDecompressLZChecked(data);
      }
    });

    it("Zeros", async () => {
      const data = "0x4564484000098646" + "00".repeat(247) + "15200441" + "00".repeat(784) + "121986420000";
      await compressAndDecompressLZChecked(data);
    });

    it("Single byte data", async () => {
      await compressAndDecompressLZChecked("0x5f");
    });
  });

});
