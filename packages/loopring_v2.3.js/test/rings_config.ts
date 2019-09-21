import { RingsInfo, SignAlgorithm } from "../src/types";

const tokenInfos = {
  development: [
    {
      decimals: 18,
      name: "Loopring Coin",
      symbol: "LRC",
    },
    {
      decimals: 18,
      name: "EOS",
      symbol: "EOS",
    },
    {
      decimals: 18,
      name: "Augur Reputation Token",
      symbol: "REP",
    },
    {
      decimals: 18,
      name: "Raiden network",
      symbol: "RDN",
    },
    {
      decimals: 18,
      name: "gifto",
      symbol: "GTO",
    },
    {
      decimals: 18,
      name: "Wrapper Ether",
      symbol: "WETH",
    },
  ],
};


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
  },

  {
    description: "single 2-size ring, insufficient fee funds available (tokenB fallback)",
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
  },

  {
    description: "single 2-size ring, token sold also used for paying fees (sufficient funds)",
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
  },

  {
    description: "single 2-size ring, token sold also used for paying fees (insufficient funds)",
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
  },

  {
    description: "self-trading in 2-size ring",
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
      {
        index: 1,
        ownerIndex: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 1e18,
        amountB: 3e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
    ],
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
  },

  {
    description: "multiple 2-size ring, same owner in different orders",
    rings: [[0, 1], [2, 3]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 3e18,
        amountB: 1e18,
      },
      {
        index: 1,
        ownerIndex: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 1e18,
        amountB: 3e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
      {
        index: 2,
        ownerIndex: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[3],
        amountS: 100e18,
        amountB: 10e18,
        feeAmount: 1e18,
        balanceFee: 1.1e18,
      },
      {
        index: 3,
        ownerIndex: 2,
        tokenS: tokenSymbols[3],
        tokenB: tokenSymbols[2],
        amountS: 10e18,
        amountB: 100e18,
      },
    ],
  },

  {
    description: "multiple 2-size rings, share the same order, prices match exactly",
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
        amountB: 45e18,
      },
      {
        index: 2,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 5e18,
        amountB: 45e18,
      },
    ],
  },

  {
    description: "P2P: single 2-size ring, prices match exactly",
    transactionOriginOwnerIndex: 1,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
      },
      {
        index: 1,
        ownerIndex: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 0.01e18,
        amountB: 1e18,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
  },

  {
    description: "P2P: single 2-size ring, with price gap",
    transactionOriginOwnerIndex: 1,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 15,  // == 1.5%
      },
      {
        index: 1,
        ownerIndex: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 0.02e18,
        amountB: 1e18,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
  },

  {
    description: "P2P: single 2-size ring, insufficient funds",
    transactionOriginOwnerIndex: 1,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[2],
        amountS: 100e18,
        amountB: 1e18,
        tokenBFeePercentage: 15,  // == 1.5%
      },
      {
        index: 1,
        ownerIndex: 1,
        tokenS: tokenSymbols[2],
        tokenB: tokenSymbols[1],
        amountS: 0.02e18,
        amountB: 1e18,
        tokenSFeePercentage: 25,  // == 2.5%
        balanceS: 0.012e18,
      },
    ],
  },

  {
    description: "P2P: invalid tokenSFeePercentage",
    transactionOriginOwnerIndex: 0,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        ownerIndex: 0,
        tokenS: tokenSymbols[0],
        tokenB: tokenSymbols[1],
        amountS: 100e18,
        amountB: 1e18,
        tokenSFeePercentage: 2000,  // == 200%
      },
      {
        index: 1,
        ownerIndex: 1,
        tokenS: tokenSymbols[1],
        tokenB: tokenSymbols[0],
        amountS: 0.01e18,
        amountB: 1e18,
        tokenBFeePercentage: 25,  // == 2.5%
      },
    ],
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
  },
];
