import { RingsInfo, SignAlgorithm } from "protocol2-js";

export const ringsInfoList: RingsInfo[] = [
  {
    description: "single 2-size ring, prices match exactly",
    signAlgorithm: SignAlgorithm.Ethereum,
    rings: [[0, 1]],
    orders: [
      {
        index: 0,
        tokenS: "GTO",  // use symbol for address, while replace with actual address later.
        tokenB: "WETH",
        amountS: 3e18,
        amountB: 1e18,
        signAlgorithm: SignAlgorithm.Ethereum,
      },
      {
        index: 1,
        tokenS: "WETH",
        tokenB: "GTO",
        amountS: 1e18,
        amountB: 3e18,
        dualAuthSignAlgorithm: SignAlgorithm.Ethereum,
      },
    ],
  },
];
