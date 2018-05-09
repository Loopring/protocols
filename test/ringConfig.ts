import { RingInfo } from "../util/types";

export const ringInfoList: RingInfo[] = [
  {
    description: "should be able to fill ring with 2 orders",
    miner: "",
    orderOwners: [],
    tokenAddressList: [],
    amountSList: [1e17, 300e18],
    amountBList: [300e18, 1e17],
    lrcFeeAmountList: [],
    buyNoMoreThanAmountBList: [false, false],
    feeSelections: [0, 0],
  },
  // {
  //   description: "should be able to ",
  //   miner: "",
  //   orderOwners: [],
  //   tokenAddressList: [],
  //   amountSList: [1e17, 300e18],
  //   amountBList: [300e18, 1e17],
  //   lrcFeeAmountList: [],
  //   buyNoMoreThanAmountBList: [false, false],
  //   feeSelections: [0, 0],
  // },
];
