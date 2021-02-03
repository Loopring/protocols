import {
  calculateCalldataCost,
  compressLZ,
  decompressLZ,
  compressZeros,
  decompressZeros,
  Bitstream
} from "loopringV3.js";
import { CompressionSpeed } from "loopringV3.js";

contract("Compression", (accounts: string[]) => {
  describe("LZ compression", function() {
    this.timeout(0);

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
      assert.equal(
        decompressedEVM,
        decompressedCPU,
        "decompressed data from EVM differs from CPU"
      );

      const gasUsed = await lzDecompressor.decompress.estimateGas(data);
      // console.log("\x1b[46m%s\x1b[0m", "[Decompress] Gas used: " + gasUsed);

      return decompressedEVM;
    };

    const compressAndDecompressLZChecked = async (data: string) => {
      const compressed = compressLZChecked(data);
      await decompressLZChecked(compressed);

      const gasCostOriginal = calculateCalldataCost(data);
      const gasCostCompressed = calculateCalldataCost(compressed);

      // console.log("compressed: " + compressed);
      // console.log("Calldata gas cost reduction: " +
      //              (100 - Math.floor((gasCostCompressed * 100) / gasCostOriginal)) + "%");

      return compressed;
    };

    before(async () => {
      const LzDecompressorContract = artifacts.require(
        "LzDecompressorContract"
      );
      lzDecompressor = await LzDecompressorContract.new();
    });

    it.skip("Optimizer", async () => {
      const data =
        "0x0123456789987654301111111111111111111111111115548914444444444444121288412354425140000000000000" +
        "151156455787878787878787878787878454000000000000000000000000000000000000456487844878984567000000" +
        "151515151515151515151515151515151515151515151500000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";

      let bestGas = 10000000;
      let bestN = 0;
      for (let i = 20; i < 60; i++) {
        const compressed = compressLZ(data, i, CompressionSpeed.SLOW);
        console.log(compressed);
        const tx = await lzDecompressor.benchmark(compressed);
        const gasUsed = tx.receipt.gasUsed;
        if (gasUsed < bestGas) {
          bestGas = gasUsed;
          bestN = i;
        }
        console.log("" + i + ": " + gasUsed);
      }
      console.log("Best - " + bestN + ": " + bestGas);
    });

    it("Test data", async () => {
      const data =
        "0x0123456789987654301111111111111111111111111115548914444444444444121288412354425140000000000000" +
        "151156455787878787878787878787878454000000000000000000000000000000000000456487844878984567000000" +
        "151515151515151515151515151515151515151515151500000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
      await compressAndDecompressLZChecked(data);
    });

    it("Random data", async () => {
      const numRounds = 8;
      const maxLength = 25 * 1000;
      for (let r = 0; r < numRounds; r++) {
        const bitstream = new Bitstream();
        const length = 1 + Math.floor(Math.random() * maxLength);
        for (let i = 0; i < length; i++) {
          const byte = Math.floor(Math.random() * 256);
          bitstream.addNumber(byte, 1);
        }
        await compressAndDecompressLZChecked(bitstream.getData());
      }
    });

    it("n-byte sequences", async () => {
      const testString =
        "f00102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
      const numTimesRepeated = 79 + Math.floor(Math.random() * 79);
      for (let length = 1; length <= 32; length++) {
        const testSlice = testString.slice(0, 2 * length);
        // console.log(testSlice);
        const data =
          "0x456448498646548949856465" +
          testSlice.repeat(numTimesRepeated) +
          "87441877454578454698744779";
        await compressAndDecompressLZChecked(data);
      }
    });

    it("Zeros", async () => {
      const data =
        "0x4564484000098646" +
        "00".repeat(247) +
        "15200441" +
        "00".repeat(784) +
        "121986420000";
      await compressAndDecompressLZChecked(data);
    });

    it("Single byte data", async () => {
      await compressAndDecompressLZChecked("0x5f");
    });

    it("Large data size", async () => {
      const length = 70 * 1000;
      const bitstream = new Bitstream();
      for (let i = 0; i < length; i++) {
        const byte = Math.floor(Math.random() * 256);
        bitstream.addNumber(byte, 1);
      }
      await compressAndDecompressLZChecked(bitstream.getData());
    });
  });

  describe("Zero compression", () => {
    let zeroDecompressor: any;

    const compressZerosChecked = (data: string) => {
      const compressed = compressZeros(data);
      const decompressed = decompressZeros(compressed);
      assert.equal(data, decompressed, "decompressed data differs from input");
      return compressed;
    };

    const decompressZerosChecked = async (data: string) => {
      const decompressedEVM = await zeroDecompressor.decompress(data);
      const decompressedCPU = decompressZeros(data);
      assert.equal(
        decompressedEVM,
        decompressedCPU,
        "decompressed data from EVM differs from CPU"
      );

      const gasUsed = await zeroDecompressor.decompress.estimateGas(data);
      // console.log("\x1b[46m%s\x1b[0m", "[Decompress] Gas used: " + gasUsed);

      return decompressedEVM;
    };

    const compressAndDecompressZerosChecked = async (data: string) => {
      const compressed = compressZerosChecked(data);
      await decompressZerosChecked(compressed);

      const gasCostOriginal = calculateCalldataCost(data);
      const gasCostCompressed = calculateCalldataCost(compressed);

      // console.log("compressed: " + compressed);
      // console.log("Calldata gas cost reduction: " +
      //              (100 - Math.floor((gasCostCompressed * 100) / gasCostOriginal)) + "%");

      return compressed;
    };

    before(async () => {
      const ZeroDecompressorContract = artifacts.require(
        "ZeroDecompressorContract"
      );
      zeroDecompressor = await ZeroDecompressorContract.new();
    });

    it("Test data", async () => {
      const data =
        "0x0123456789987654301111111111111111111111111115548914444444444444121288412354425140000000000000" +
        "151156455787878787878787878787878454000000000000000000000000000000000000456487844878984567000000" +
        "151515151515151515151515151515151515151515151500000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";
      await compressAndDecompressZerosChecked(data);
    });

    it.skip("Optimizer", async () => {
      const data =
        "0x0123456789987654301111111111111111111111111115548914444444444444121288412354425140000000000000" +
        "151156455787878787878787878787878454000000000000000000000000000000000000456487844878984567000000" +
        "151515151515151515151515151515151515151515151500000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" +
        "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001";

      let bestGas = 10000000;
      let bestN = 0;
      for (let i = 8; i < 100; i++) {
        const compressed = compressZeros(data, i);
        const tx = await zeroDecompressor.benchmark(compressed);
        const gasUsed = tx.receipt.gasUsed;
        if (gasUsed < bestGas) {
          bestGas = gasUsed;
          bestN = i;
        }
        console.log("" + i + ": " + gasUsed);
      }
      console.log("Best - " + bestN + ": " + bestGas);
    });

    it("Random data", async () => {
      const numRounds = 8;
      const maxLength = 25 * 1000;
      for (let r = 0; r < numRounds; r++) {
        const bitstream = new Bitstream();
        const length = 1 + Math.floor(Math.random() * maxLength);
        for (let i = 0; i < length; i++) {
          const byte = Math.floor(Math.random() * 256);
          bitstream.addNumber(byte, 1);
        }
        await compressAndDecompressZerosChecked(bitstream.getData());
      }
    });

    it("n-byte sequences", async () => {
      const testString =
        "f00102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
      const numTimesRepeated = 79 + Math.floor(Math.random() * 79);
      for (let length = 1; length <= 32; length++) {
        const testSlice = testString.slice(0, 2 * length);
        // console.log(testSlice);
        const data =
          "0x456448498646548949856465" +
          testSlice.repeat(numTimesRepeated) +
          "87441877454578454698744779";
        await compressAndDecompressZerosChecked(data);
      }
    });

    it("Zeros", async () => {
      const data =
        "0x4564484000098646" +
        "00".repeat(247) +
        "15200441" +
        "00".repeat(784) +
        "121986420000";
      await compressAndDecompressZerosChecked(data);
    });

    it("Single byte data", async () => {
      await compressAndDecompressZerosChecked("0x5f");
    });

    it("Large data size", async () => {
      const length = 70 * 1000;
      const bitstream = new Bitstream();
      for (let i = 0; i < length; i++) {
        const byte = Math.floor(Math.random() * 256);
        bitstream.addNumber(byte, 1);
      }
      await compressAndDecompressZerosChecked(bitstream.getData());
    });
  });
});
