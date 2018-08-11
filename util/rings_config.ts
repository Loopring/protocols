import tokenInfos = require("../migrations/config/tokens.js");
import { RingsInfo, SignAlgorithm } from "../util/types";

const tokenSymbols = tokenInfos.development.map((t) => t.symbol);

export const ringsInfoList: RingsInfo[] = [
  {
    description: "single 2-size ring, prices exactly match.",
    signAlgorithm: SignAlgorithm.Ethereum,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],  // use symbol for address, while replace with actual address later.
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
        signAlgorithm: SignAlgorithm.Ethereum,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
        dualAuthSignAlgorithm: SignAlgorithm.Ethereum,
      },
    ],
  },

  {
    description: "simple single 2-size ring, with price gap.",
    signAlgorithm: SignAlgorithm.Ethereum,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],  // use symbol for address, while replace with actual address later.
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        signAlgorithm: SignAlgorithm.Ethereum,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
        dualAuthSignAlgorithm: SignAlgorithm.Ethereum,
      },
    ],
  },

  {
    description: "simple single 3-size ring, prices exactly match.",
    signAlgorithm: SignAlgorithm.Ethereum,
    rings: [[0, 1, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 10e18,
        amountB: 100e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 100e18,
        amountB: 5e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 5e18,
        amountB: 10e18,
      },
    ],
  },

  {
    description: "simple single 3-size ring, with price gap.",
    signAlgorithm: SignAlgorithm.Ethereum,
    rings: [[0, 1, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 5e18,
        amountB: 45e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 2e18,
      },
    ],
  },

  // {
  //   description: "simple single 3-size ring that cannot be settled",
  //   signAlgorithm: SignAlgorithm.Ethereum,
  //   rings: [[0, 1, 2]],
  //   orders: [
  //     {
  //       index: 0,
  //       tokenS: tokenSymbols[1],
  //       tokenB: tokenSymbols[2],
  //       amountS: 100e18,
  //       amountB: 10e18,
  //     },
  //     {
  //       index: 1,
  //       tokenS: tokenSymbols[2],
  //       tokenB: tokenSymbols[3],
  //       amountS: 5e18,
  //       amountB: 45e18,
  //     },
  //     {
  //       index: 2,
  //       tokenS: tokenSymbols[3],
  //       tokenB: tokenSymbols[1],
  //       amountS: 2e18,
  //       amountB: 3e18,
  //     },
  //   ],
  // },
];
