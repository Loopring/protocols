import { RingsInfo, SignAlgorithm } from "protocol2-js";
import tokenInfos = require("../migrations/config/tokens.js");

const tokenSymbols = tokenInfos.development.map((t) => t.symbol);

export const ringsInfoList: RingsInfo[] = [
  {
    description: "single 2-size ring, prices match exactly",
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
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, with price gap",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 5e18,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, pay fee in WETH",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "LRC",
        tokenB: "GTO",
        amountS: 100e18,
        amountB: 10e18,
        feeToken: "WETH",
        feeAmount: 1.0e18,
        balanceFee: 1.5e18,
      },
      {
        index: 1,
        tokenS: "GTO",
        tokenB: "LRC",
        amountS: 10e18,
        amountB: 100e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, pay fee in non LRC/WETH token",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 100e18,
        amountB: 10e18,
        feeToken: "GTO",
        feeAmount: 1.0e18,
        balanceFee: 2.0e18,
      },
      {
        index: 1,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 10e18,
        amountB: 100e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, no funds available",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 8e18,
        amountB: 1e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 8e18,
        balanceS: 0,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, no fee funds available ",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 8e18,
        amountB: 1e18,
      },
      {
        index: 1,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 1e18,
        amountB: 8e18,
        feeToken: "LRC",
        feeAmount: 0.5e18,
        balanceFee: 0,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, insufficient fee funds available",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 8e18,
        amountB: 1e18,
      },
      {
        index: 1,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 1e18,
        amountB: 8e18,
        feeToken: "LRC",
        feeAmount: 1.0e18,
        balanceFee: 0.8e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.8,
            },
            {
              filledFraction: 0.8,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, feeToken == tokenS (sufficient funds)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 10e18,
        amountB: 100e18,
        feeToken: "LRC",
        feeAmount: 1.0e18,
        balanceS: 10.0e18,
        balanceFee: 1.01e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, feeToken == tokenS (insufficient funds)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 10e18,
        amountB: 100e18,
        feeToken: "LRC",
        feeAmount: 1.0e18,
        balanceS: 7.0e18,
        balanceFee: 0.5e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: (7.5 * 10.0 / (10.0 + 1.0)) / 10.0,
            },
            {
              filledFraction: (7.5 * 10.0 / (10.0 + 1.0)) / 10.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, feeToken == tokenB (feeAmount <= amountB)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 100e18,
        amountB: 10e18,
        feeToken: "LRC",
        feeAmount: 1e18,
        balanceFee: 0,
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 10e18,
        amountB: 100e18,
        feeToken: "GTO",
        feeAmount: 1e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, feeToken == tokenB (feeAmount > amountB)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 100e18,
        amountB: 10e18,
        feeToken: "LRC",
        feeAmount: 20e18,
        balanceFee: 0,
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 10e18,
        amountB: 100e18,
        feeToken: "GTO",
        feeAmount: 1e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, feeToken == tokenB and tokenRecipient != owner (feeAmount <= amountB)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        amountS: 100e18,
        amountB: 10e18,
        feeToken: "LRC",
        feeAmount: 1e18,
        balanceFee: 0,
        tokenRecipient: "2",
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 10e18,
        amountB: 100e18,
        feeToken: "GTO",
        feeAmount: 1e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, owner specifies token receiver address",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
        owner: "0",
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
        owner: "1",
        tokenRecipient: "2",
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
              payMatchingFeeUsingAmountB: false,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, wallet split percentage > 0 but no wallet specified",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 10e18,
        walletAddr: null,
        walletSplitPercentage: 20,
      },
      {
        index: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 20e18,
        amountB: 200e18,
        walletAddr: null,
        walletSplitPercentage: 20,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 0.5,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, order is allOrNone (successful)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 20e18,
        amountB: 200e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 0.5,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, order is allOrNone (unsuccessful)",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 20e18,
        amountB: 200e18,
        balanceS: 5e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, order is allOrNone, filled in multiple rings (successful)",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 6e18,
        amountB: 60e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 5e18,
        amountB: 50e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.6,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.4,
            },
            {
              filledFraction: 4 / 5,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, order is allOrNone, filled in multiple rings (unsuccessful)",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 6e18,
        amountB: 60e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 5e18,
        amountB: 50e18,
        balanceS: 2e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, order is allOrNone, filled in multiple rings (Audit case A)",
    rings: [[0, 2], [0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 10e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 5e18,
        amountB: 5e18,
        allOrNone: false,
      },
      {
        index: 2,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 6e18,
        amountB: 6e18,
        allOrNone: true,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.6,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.4,
            },
            {
              filledFraction: 4 / 5,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, order is allOrNone, filled in multiple rings (Audit case B)",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 10e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 5e18,
        amountB: 5e18,
        allOrNone: false,
      },
      {
        index: 2,
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 6e18,
        amountB: 6e18,
        allOrNone: true,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "self-trading in 2-size ring",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
        feeAmount: 1e18,
        balanceFee: 2.0e18,
      },
      {
        index: 1,
        owner: "0",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 1e18,
        amountB: 3e18,
        feeAmount: 1e18,
        balanceFee: 2.0e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "self-trading in 3-size ring, same token used as feeToken and tokenS (feeToken earlier)",
    rings: [[0, 1, 2]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 10e18,
        amountB: 100e18,
        feeToken: tokenSymbols[3],
        feeAmount: 5e18,
        balanceFee: 5e18,
      },
      {
        index: 1,
        owner: "0",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 100e18,
        amountB: 5e18,
      },
      {
        index: 2,
        owner: "0",
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 5e18,
        amountB: 10e18,
        balanceS: 5e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, prices match exactly",
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
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, with price gap",
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
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: (3.0 * (5.0 / 45.0) / 10.0),
              margin: (4 / 3) * 1e18,
            },
            {
              filledFraction: (3.0 / 45.0),
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, miner waives fees for order",
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
        amountS: 10e18,
        amountB: 45e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 45e18,
        amountB: 100e18,
        feeAmount: 1e18,
        waiveFeePercentage: 660, // = 66%
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, miner splits fees with order",
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
        amountS: 10e18,
        amountB: 45e18,
        feeAmount: 1e18,
        waiveFeePercentage: -330, // = -33%
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 45e18,
        amountB: 100e18,
        feeAmount: 1e18,
        waiveFeePercentage: 250, // = 25%
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, miner splits more than 100% of fees with orders",
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
        amountS: 10e18,
        amountB: 45e18,
        feeAmount: 1e18,
        waiveFeePercentage: -650, // = -65%
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 45e18,
        amountB: 100e18,
        feeAmount: 1e18,
        waiveFeePercentage: -450, // = -45%
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "simple single 3-size ring, cannot be settled",
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
        amountS: 2e18,
        amountB: 3e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "multiple 2-size ring, prices match exactly",
    rings: [[0, 1], [2, 3]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
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
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 3,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple 2-size ring, same owner in different orders",
    rings: [[0, 1], [2, 3]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 1e18,
        amountB: 3e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
      {
        index: 2,
        owner: "1",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 100e18,
        amountB: 10e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
      {
        index: 3,
        owner: "2",
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[2],
        amountS: 10e18,
        amountB: 100e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.1,
            },
            {
              filledFraction: 0.1,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, share the same order",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 5e18,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, share the same order, tokenS/tokenB mismatch",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[1],
        amountS: 5e18,
        amountB: 45e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "multiple 2-size rings, the same ring is settled twice",
    rings: [[0, 1], [0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "P2P: Daniel's example",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 100e18,
        amountB: 380e18,
        tokenSFeePercentage: 60,  // == 6.0%
        tokenBFeePercentage: 100,  // == 10.0%
        walletAddr: "0",
      },
      {
        index: 1,
        owner: "1",
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 400e18,
        amountB: 94e18,
        tokenSFeePercentage: 50,  // == 5.0%
        tokenBFeePercentage: 25,  // == 2.5%
        walletAddr: "1",
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: single 2-size ring, prices match exactly",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 0.01e18,
        amountB: 0.985e18,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.01,
              P2P: true,
              margin: 0,
            },
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: single 2-size ring, with price gap",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
        tokenBFeePercentage: 25,  // == 2.5%
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 0.02e18,
        amountB: 1e18,
        tokenSFeePercentage: 35,  // == 3.5%
        tokenBFeePercentage: 45,  // == 4.5%
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.02 * (1 - 0.035),
              P2P: true,
              margin: ((0.02 * (1 - 0.035) * 100) * (1 - 0.015) - 1) * 1e18,
            },
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: single 2-size ring, partial fill caused by balance",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
        tokenBFeePercentage: 25,  // == 2.5%
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 0.02e18,
        amountB: 1e18,
        tokenSFeePercentage: 35,  // == 3.5%
        tokenBFeePercentage: 45,  // == 4.5%
        balanceS: 0.012e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.012 * (1 - 0.035),
              P2P: true,
              margin: ((0.012 * (1 - 0.035) * 100) * (1 - 0.015) - 1 * 0.6) * 1e18,
            },
            {
              filledFraction: 0.6,
              P2P: true,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: fee percentages non-zero but no wallet specified",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: "GTO",
        tokenB: "WETH",
        amountS: 100e18,
        amountB: 380e18,
        tokenSFeePercentage: 60,  // == 6.0%
        tokenBFeePercentage: 100,  // == 10.0%
        walletAddr: null,
      },
      {
        index: 1,
        owner: "1",
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 400e18,
        amountB: 94e18,
        tokenSFeePercentage: 50,  // == 5.0%
        tokenBFeePercentage: 25,  // == 2.5%
        walletAddr: null,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              P2P: true,
            },
            {
              filledFraction: 1.0,
              P2P: true,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: multiple 2-size rings, order is allOrNone, filled in multiple rings (successful)",
    rings: [[0, 1], [0, 2]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 9e18,
        tokenSFeePercentage: 100,   // == 10.0%
        tokenBFeePercentage: 50,    // == 5.0%
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 6e18,
        amountB: 60e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 5e18,
        amountB: 50e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 2 / 3,
              P2P: true,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 1 / 3,
              P2P: true,
            },
            {
              filledFraction: 3 / 5,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: invalid tokenSFeePercentage",
    transactionOrigin: "0",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 2000,  // == 200%
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 0.01e18,
        amountB: 1e18,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "P2P order + normal order",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
        tokenBFeePercentage: 30,  // == 3.0%
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 0.02e18,
        amountB: 1e18,
        feeAmount: 1.5e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.02,
              P2P: true,
              margin: ((0.02 * 100) * (1 - 0.015) - 1) * 1e18,
            },
            {
              filledFraction: 1.0,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "multiple rings, one ring fails, another succeeds",
    rings: [[0, 1], [2, 3]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
        allOrNone: true,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 20e18,
        amountB: 200e18,
        balanceS: 5e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 3,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 5e18,
        amountB: 50e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
        {
          orders: [
            {
              filledFraction: 0.5,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "ring with invalid order",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 0,
        amountB: 3e18,
        feeAmount: 0,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 0,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "ring with an order with validSince > now",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 1e18,
        amountB: 3e18,
        validSince: 0xFFFFFFFF,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "ring with an order with validUntil < now",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 1e18,
        amountB: 3e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
        validUntil: 1,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single order ring",
    rings: [[0]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[0],
        amountS: 2e18,
        amountB: 2e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "ring with sub-ring",
    rings: [[0, 1, 2, 3, 4, 5]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 10e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[3],
        amountS: 10e18,
        amountB: 50e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[4],
        amountS: 50e18,
        amountB: 25e18,
      },
      {
        index: 3,
        tokenS: tokenSymbols[4],
        tokenB: tokenSymbols[1],
        amountS: 25e18,
        amountB: 20e18,
      },
      {
        index: 4,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[3],
        amountS: 20e18,
        amountB: 30e18,
      },
      {
        index: 5,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[2],
        amountS: 30e18,
        amountB: 100e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "invalid order signature",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
        signAlgorithm: SignAlgorithm.Ethereum,
        sig: "0x00411c8ddc1f9062d1968d1333fa5488b7af57fb17250c18918de6ed31349a39834f787805224fdb56500" +
             "e0331e79746060f7effb569df13c1aaf42e15efc3ef4dea04",
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 3e18,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "invalid dual-author order signature",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
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
        dualAuthSignAlgorithm: SignAlgorithm.Ethereum,
        dualAuthSig: "0x00411c8ddc1f9062d1968d1333fa5488b7af57fb17250c18918de6ed31349a39834f787805224fdb56500" +
                     "e0331e79746060f7effb569df13c1aaf42e15efc3ef4dea04",
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "missing dual-author order signature",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
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
        dualAuthSignAlgorithm: SignAlgorithm.Ethereum,
        dualAuthSig: null,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "invalid miner signature",
    signAlgorithm: SignAlgorithm.Ethereum,
    sig: "0x00411c8ddc1f9062d1968d1333fa5488b7af57fb17250c18918de6ed31349a39834f787805224fdb56500" +
         "e0331e79746060f7effb569df13c1aaf42e15efc3ef4dea04",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
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
    ],
    expected: {
      revert: true,
      revertMessage: "INVALID_SIG",
    },
  },

  {
    description: "one to many match: big order filled by 5 small orders",
    rings: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 10000e18,
        amountB: 1000e18,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
      {
        index: 3,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
      {
        index: 4,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
      {
        index: 5,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "one to many match: one big order filled by many small orders",
    rings: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11, 12]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 10000e18,
        amountB: 1000e18,
        walletAddr: "0",
        dualAuthAddr: "2",
      },
      {
        index: 1,
        owner: "1",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
        walletAddr: "0",
        dualAuthAddr: "0",
      },
      {
        index: 2,
        owner: "2",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
        balanceS: 7.5e18,
        walletAddr: "0",
        dualAuthAddr: "0",
      },
      {
        index: 3,
        owner: "2",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
        balanceS: 7.5e18,
        walletAddr: "1",
        dualAuthAddr: "1",
      },
      {
        index: 4,
        owner: "3",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 48e18,
        balanceS: 100e18,
        walletAddr: "2",
        dualAuthAddr: "2",
      },
      {
        index: 5,
        owner: "3",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 0,
        amountB: 45e18,
        balanceS: 100e18,
        walletAddr: "2",
        dualAuthAddr: "2",
      },
      {
        index: 6,
        owner: "4",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 50e18,
        balanceS: 100e18,
        walletAddr: "3",
        dualAuthAddr: "3",
      },
      {
        index: 7,
        owner: "4",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 4e18,
        amountB: 50e18,
        balanceS: 100e18,
        walletAddr: "0",
        dualAuthAddr: "4",
      },
      {
        index: 8,
        owner: "5",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 49e18,
        walletAddr: "0",
        dualAuthSignAlgorithm: SignAlgorithm.None,
      },
      {
        index: 9,
        owner: "6",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 10e18,
        amountB: 90e18,
        walletAddr: "1",
        dualAuthSignAlgorithm: SignAlgorithm.None,
      },
      {
        index: 10,
        owner: "7",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 20e18,
        amountB: 100e18,
        walletAddr: "2",
        dualAuthAddr: "1",
      },
      {
        index: 11,
        owner: "8",
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[3],
        amountS: 5e18,
        amountB: 45e18,
        walletAddr: "2",
        dualAuthAddr: "1",
      },
      {
        index: 12,
        owner: "9",
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[2],
        amountS: 3e18,
        amountB: 2e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          fail: true,
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          fail: true,
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          fail: true,
        },
        {
          orders: [
            {
              filledFraction: 0.005,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.01,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: 0.02,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
        {
          orders: [
            {
              filledFraction: (3.0 * (5.0 / 45.0) / 1000.0),
            },
            {
              filledFraction: (3.0 / 45.0),
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, order signed with EIP712",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 10e18,
        amountB: 1e18,
        signAlgorithm: SignAlgorithm.EIP712,
      },
      {
        index: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 1e18,
        amountB: 10e18,
      },
    ],
    expected: {
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, selling token with decimals == 0",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "INDA",
        tokenB: "WETH",
        amountS: 60,
        amountB: 5e18,
      },
      {
        index: 1,
        tokenS: "WETH",
        tokenB: "INDA",
        amountS: 2.5e18,
        amountB: 25,
      },
    ],
    expected: {
      decimalsPrecision: 0,
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, buying/selling tokens with decimals == 0",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "INDA",
        tokenB: "INDB",
        amountS: 110,
        amountB: 40,
      },
      {
        index: 1,
        tokenS: "INDB",
        tokenB: "INDA",
        amountS: 20,
        amountB: 50,
      },
    ],
    expected: {
      decimalsPrecision: 0,
      rings: [
        {
          orders: [
            {
              filledFraction: 0.5,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "single 2-size ring, using token with decimals == 0 as feeToken",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "WETH",
        tokenB: "LRC",
        feeToken: "INDA",
        amountS: 1e18,
        amountB: 100e18,
        feeAmount: 10,
      },
      {
        index: 1,
        tokenS: "LRC",
        tokenB: "WETH",
        amountS: 70e18,
        amountB: 0.6e18,
      },
    ],
    expected: {
      decimalsPrecision: 0,
      rings: [
        {
          orders: [
            {
              filledFraction: 0.7,
            },
            {
              filledFraction: 1.0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: single 2-size ring, buying/selling tokens with decimals == 0",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: "INDA",
        tokenB: "INDB",
        amountS: 100,
        amountB: 1,
        tokenSFeePercentage: 15,  // == 1.5%
      },
      {
        index: 1,
        owner: "1",
        tokenS: "INDB",
        tokenB: "INDA",
        amountS: 1,
        amountB: 98,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
    expected: {
      decimalsPrecision: 0,
      rings: [
        {
          orders: [
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 1,
            },
            {
              filledFraction: 1.0,
              P2P: true,
              margin: 0,
            },
          ],
        },
      ],
    },
  },

  {
    description: "P2P: single 2-size ring, fillAmountB rounding error > 1%",
    transactionOrigin: "1",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        owner: "0",
        tokenS: "INDA",
        tokenB: "INDB",
        amountS: 20,
        amountB: 200,
        tokenSFeePercentage: 20,  // == 2.0%
      },
      {
        index: 1,
        owner: "1",
        tokenS: "INDB",
        tokenB: "INDA",
        amountS: 200,
        amountB: 20,
        balanceS: 195,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, fillAmountB is 0 because of rounding error",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "INDA",
        tokenB: "INDB",
        amountS: 1,
        amountB: 10,
      },
      {
        index: 1,
        tokenS: "INDB",
        tokenB: "INDA",
        amountS: 10,
        amountB: 1,
        balanceS: 5,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },

  {
    description: "single 2-size ring, fillAmountB rounding error > 1%",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "INDA",
        tokenB: "INDB",
        amountS: 20,
        amountB: 200,
      },
      {
        index: 1,
        tokenS: "INDB",
        tokenB: "INDA",
        amountS: 200,
        amountB: 20,
        balanceS: 199,
      },
    ],
    expected: {
      rings: [
        {
          fail: true,
        },
      ],
    },
  },
];
