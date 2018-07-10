import tokenInfos = require("../migrations/config/tokens.js");
import { RingsInfo } from "../util/types";

const tokenSymbols = tokenInfos.development.map((t) => t.symbol);

export const ringsInfoList: RingsInfo[] = [
  {
    description: "simple size 2 2-size rings.",
    rings: [[0, 1], [2, 3]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],  // use symbol for address, while replace with actual address later.
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 2e17,
        amountB: 1e18,
      },
      {
        index: 3,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 1e18,
        amountB: 2e17,
      },
    ],
  },
];
