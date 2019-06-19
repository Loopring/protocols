import { Bitstream } from "./bitstream";

export enum CompressionType {
  NONE = 0,
  LZ,
}

const calculateCalldataCost = (data: string)  => {
  assert(data.length % 2 === 0, "data needs to be an integer number of bytes");
  let cost = 0;
  let i = data.startsWith("0x") ? 2 : 0;
  for (; i < data.length; i += 2) {
    if (data.slice(i, i + 2) === "00") {
      cost += 4;
    } else {
      cost += 68;
    }
  }
  return cost;
};

const isAllZeros = (data: string)  => {
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

export function compress(data: string, mode: CompressionType, externalContractAddress?: string) {
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

export function compressLZ(input: string) {
  const data = new Bitstream(input);
  assert(data.length() > 0, "cannot compress empty input");

  const compressed = new Bitstream();
  let pos = 0;
  // Limit the maximum offset for now because the compressor uses brute force
  // to find repeated patterns for now
  const maxOffset = /*2 ** 16 - 1*/128;
  const maxLength = 2 ** 16 - 1;
  let literals = new Bitstream();
  while (pos < data.length()) {
    // Find the longest match
    // TODO: better way to find long sequences of zeros
    let bestStartIndex = 0;
    let bestLength = 0;
    for (let s = Math.max(0, pos - maxOffset); s < pos; s++) {
      let length = 0;
      for (let n = 0; n < maxLength && (pos + n) < data.length(); n++) {
        if (data.extractUint8(s + n) === data.extractUint8(pos + n)) {
          length++;
        } else {
          break;
        }
      }
      if (length > bestLength || (length === bestLength && s > bestStartIndex)) {
        bestLength = length;
        bestStartIndex = s;
      }
    }

    // Only take the overhead of the extra (offset, length) when
    // enough gas can be saved
    // TODO: better gas cost prediction
    const replacedData = data.extractData(bestStartIndex, bestLength);
    const gasSaved = calculateCalldataCost(replacedData);
    // console.log("replacedData: " + replacedData + " (" + gasSaved + ")");
    if (gasSaved >= 600) {
      // First check if we have literals we have to write out
      if (literals.length() > 0) {
        // console.log("mode: " + 0);
        // console.log("length: " + literals.length());
        compressed.addNumber(0, 1);
        compressed.addNumber(literals.length(), 2);
        compressed.addHex(literals.getData().slice(2));
        // All literals consumed, reset
        literals = new Bitstream();
      }

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
      literals.addNumber(data.extractUint8(pos), 1);
      pos += 1;
    }
  }

  // Check if we have literals we have to write out
  if (literals.length() > 0) {
    // console.log("mode: " + 0);
    // console.log("length: " + literals.length());
    compressed.addNumber(0, 1);
    compressed.addNumber(literals.length(), 2);
    compressed.addHex(literals.getData().slice(2));
  }

  // console.log("o: " + data.getData());
  // console.log("compressed: " + compressed.getData());
  const decompressed = decompressLZ(compressed.getData());
  assert.equal(input, decompressed, "decompressed data does not match original data");
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
