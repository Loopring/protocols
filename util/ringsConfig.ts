import { RingInfo, RingsInfo } from "../util/types";

export const ringsInfoList: RingsInfo[] = [
  {
    description: "simple 2 size rings.",
    ringInfoList:
    [
      {
        amountSList: [1e17, 300e18],
        amountBList: [300e18, 1e17],
        buyNoMoreThanAmountBList: [false, false],
        feeSelections: [0, 0],
        salt: 10,
      },

      {
        amountSList: [1e17, 300e18],
        amountBList: [300e18, 1e17],
        buyNoMoreThanAmountBList: [false, false],
        feeSelections: [0, 0],
        orderFilledOrCancelledAmountList: [5e16, 0],
        salt: 11,
        verbose: false,
      },
    ],
  },
];
