const poseidon = require("./src/poseidon");
export class Poseidon {
  public static createHash(t: number, nRoundsF: number, nRoundsP: number) {
    return poseidon.createHash(t, nRoundsF, nRoundsP);
  }
}

export * from "./src/types";
export * from "./src/bitstream";
export * from "./src/compression";
export * from "./src/constants";
export * from "./src/eddsa";
export * from "./src/float";
export * from "./src/protocol_v3";
export * from "./src/exchange_v3";
export * from "./src/explorer";
export * from "./src/request_processors/spot_trade_processor";
