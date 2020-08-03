import { Bitstream } from "./bitstream";

export enum CompressionType {
  NONE = 0,
  LZ
}

export enum CompressionSpeed {
  FAST = 0,
  MEDIUM,
  SLOW
}

const GAS_COST_ZERO_BYTE = 4;
const GAS_COST_NONZERO_BYTE = 16;

export const calculateCalldataCost = (data: string) => {
  assert(data.length % 2 === 0, "data needs to be an integer number of bytes");
  let cost = 0;
  let i = data.startsWith("0x") ? 2 : 0;
  for (; i < data.length; i += 2) {
    if (data.slice(i, i + 2) === "00") {
      cost += GAS_COST_ZERO_BYTE;
    } else {
      cost += GAS_COST_NONZERO_BYTE;
    }
  }
  return cost;
};

const isAllZeros = (data: string) => {
  assert(data.length % 2 === 0, "data needs to be an integer number of bytes");
  let i = data.startsWith("0x") ? 2 : 0;
  let bAllZeros = true;
  for (; i < data.length; i += 2) {
    if (data.slice(i, i + 2) !== "00") {
      bAllZeros = false;
      break;
    }
  }
  return bAllZeros;
};

export function compress(
  data: string,
  mode: CompressionType,
  externalContractAddress?: string
) {
  if (mode === CompressionType.NONE) {
    const bitstream = new Bitstream();
    bitstream.addNumber(CompressionType.NONE, 1);
    bitstream.addHex(data);
    return bitstream.getData();
  } else if (mode === CompressionType.LZ) {
    const compressedData = compressLZ(data);
    const bitstream = new Bitstream();
    bitstream.addNumber(CompressionType.LZ, 1);
    bitstream.addAddress(externalContractAddress);
    bitstream.addHex(compressedData);
    return bitstream.getData();
  } else {
    assert(false, "unsupported compression mode");
  }
}

export function decompress(data: string) {
  const bitstream = new Bitstream(data);
  const mode = bitstream.extractUint8(0);
  if (mode === CompressionType.NONE) {
    // Cutoff '0x' and the mode byte of data
    return "0x" + data.slice(2 + 2 * 1);
  } else if (mode === CompressionType.LZ) {
    const compressedData = "0x" + data.slice(2 + 2 * (1 + 20));
    return decompressLZ(compressedData);
  } else {
    assert(false, "unsupported compression mode");
  }
}

export function compressLZ(
  input: string,
  speed: CompressionSpeed = CompressionSpeed.MEDIUM
) {
  const minGasSavedForReplacement = GAS_COST_NONZERO_BYTE * 10;
  const minLengthReplacement = Math.floor(
    minGasSavedForReplacement / GAS_COST_NONZERO_BYTE
  );

  // Limit the maximum offset for now because the compressor uses brute force
  // to find repeated patterns for now
  const maxOffset =
    speed === CompressionSpeed.FAST
      ? 1024
      : speed === CompressionSpeed.MEDIUM
      ? 2048
      : speed === CompressionSpeed.SLOW
      ? 4096
      : assert(false, "unknown compression speed");
  const maxLength = 2 ** 16 - 1;

  assert(maxOffset < 2 ** 16, "max offset too large");
  assert(maxLength < 2 ** 16, "max length too large");

  const writeLiterals = () => {
    if (literals.length() > 0) {
      // console.log("mode: " + 0);
      // console.log("length: " + literals.length());
      // If necessary, split up writing the literals so that length < maxLength
      const numParts = Math.ceil(literals.length() / maxLength);
      for (let p = 0; p < literals.length(); p += maxLength) {
        const partLength = Math.min(literals.length() - p, maxLength);
        compressed.addNumber(0, 1);
        compressed.addNumber(partLength, 2);
        compressed.addHex(literals.extractData(p, partLength));
      }
      // All literals consumed, reset
      literals = new Bitstream();
    }
  };

  const startTime = new Date().getTime();

  const stream = new Bitstream(input);
  assert(stream.length() > 0, "cannot compress empty input");

  // Cache the data in an array for performance
  const data: number[] = [];
  for (let i = 0; i < stream.length(); i++) {
    data.push(stream.extractUint8(i));
  }

  const compressed = new Bitstream();
  let pos = 0;
  let literals = new Bitstream();
  const dataLength = stream.length();
  while (pos < dataLength) {
    // Find the longest match
    // TODO: better way to find long sequences of zeros
    let bestStartIndex = 0;
    let bestLength = 0;
    let bestGasSaved = 0;
    for (let s = Math.max(0, pos - maxOffset); s < pos; s++) {
      let length = 0;
      while (
        length < maxLength &&
        pos + length < dataLength &&
        data[s + length] === data[pos + length]
      ) {
        length++;
      }
      if (length >= minLengthReplacement) {
        const gasSaved = calculateCalldataCost(
          stream.extractData(bestStartIndex, length)
        );
        if (
          gasSaved > bestGasSaved ||
          (gasSaved === bestGasSaved && s > bestStartIndex)
        ) {
          bestGasSaved = gasSaved;
          bestStartIndex = s;
          bestLength = length;
        }
      }
    }

    // Only take the overhead of the extra (offset, length) when
    // enough gas can be saved
    // TODO: better gas cost prediction
    const replacedData = stream.extractData(bestStartIndex, bestLength);
    // console.log("replacedData: " + replacedData + " (" + gasSaved + ")");
    if (bestGasSaved >= minGasSavedForReplacement) {
      // First check if we have literals we have to write out
      writeLiterals();

      const bAllZeros = isAllZeros(replacedData);
      if (bAllZeros) {
        // Zeros
        compressed.addNumber(1, 1);
        compressed.addNumber(bestLength, 2);
        // console.log("zeros: " + bestLength);
      } else {
        // Write (offset, length) pair
        const offset = pos - bestStartIndex;
        // console.log("mode: " + 2);
        // console.log("offset: " + offset);
        // console.log("length: " + bestLength);
        compressed.addNumber(2, 1);
        compressed.addNumber(offset, 2);
        compressed.addNumber(bestLength, 2);
      }
      pos += bestLength;
    } else {
      literals.addNumber(data[pos], 1);
      pos += 1;
    }
  }
  // Write out remaining literals
  writeLiterals();

  const endTime = new Date().getTime();
  // console.log("Compression time: " + (endTime - startTime) + "ms.");

  // console.log("o: " + data.getData());
  // console.log("compressed: " + compressed.getData());
  const decompressed = decompressLZ(compressed.getData());
  assert.equal(
    input,
    decompressed,
    "decompressed data does not match original data"
  );
  // console.log("r: " + decompressed);

  return compressed.getData();
}

export function decompressLZ(input: string) {
  const data = new Bitstream(input);
  assert(data.length() > 0, "cannot decompress empty input");

  const uncompressed = new Bitstream();
  let pos = 0;
  while (pos < data.length()) {
    const mode = data.extractUint8(pos);
    pos += 1;
    // console.log("mode: " + mode);

    if (mode === 0) {
      const length = data.extractUint16(pos);
      pos += 2;
      // console.log("length: " + length);
      // Literals, just copy directly from the compressed stream
      uncompressed.addHex(data.extractData(pos, length));
      pos += length;
      // console.log("calldatacopy");
    } else if (mode === 1) {
      // Write out zeros
      const length = data.extractUint16(pos);
      pos += 2;
      for (let i = 0; i < length; i++) {
        uncompressed.addNumber(0, 1);
      }
      // console.log("memclear");
    } else if (mode === 2) {
      // Copy from previously decompressed data
      const offset = data.extractUint16(pos);
      const length = data.extractUint16(pos + 2);
      pos += 4;
      // console.log("offset: " + offset);
      // console.log("length: " + length);
      // Do a byte-wise copy
      const startIdx = uncompressed.length() - offset;
      for (let i = 0; i < length; i++) {
        uncompressed.addNumber(uncompressed.extractUint8(startIdx + i), 1);
      }
      // console.log("memmove");
    } else {
      assert(false);
    }
  }
  return uncompressed.getData();
}
