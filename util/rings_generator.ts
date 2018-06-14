import { BigNumber } from "bignumber.js";
import { RingsSubmitParams } from "../util/types";
import { Ring } from "./ring";

export class RingsGenerator {

  public generateRings() {
    const rings: Ring[] = [];

    return rings;
  }

  public toSubmitableParam(rings: Ring[]) {
    const params: RingsSubmitParams = {
      miningSpec: 0,
      orderSpecs: [0],
      ringSpecs: [[0]],
      addressList: [""],
      uintList: [new BigNumber(0)],
      bytesList: [""],
    };
    return params;
  }
}
