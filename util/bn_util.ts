import BN = require('bn.js');
import * as BigNumber from 'bignumber.js';
import { bigNumberConfigs } from './bignumber_config';

bigNumberConfigs.configure();

type BNValue = number|string|BigNumber.BigNumber;

export const BNUtil = {
  add(numA: BNValue, numB: BNValue): string {
    const a = new BigNumber(numA);
    const b = new BigNumber(numB);
    const result = a.plus(b);
    return result.toString();
  },
  sub(numA: BNValue, numB: BNValue): string {
    const a = new BigNumber(numA);
    const b = new BigNumber(numB);
    const result = a.minus(b);
    return result.toString();
  },
  mul(numA: BNValue, numB: BNValue): string {
    const a = new BigNumber(numA);
    const b = new BigNumber(numB);
    const result = a.times(b);
    return result.toString();
  },
  div(numA: BNValue, numB: BNValue, decimalPlaces: number = 18): string {
    BigNumber.config({
      DECIMAL_PLACES: decimalPlaces,
    });
    const a = new BigNumber(numA);
    const b = new BigNumber(numB);
    const result = a.div(b);
    return result.toString();
  },
  cmp(numA: BNValue, numB: BNValue): number {
    const a = new BigNumber(numA);
    const b = new BigNumber(numB);
    return a.comparedTo(b);
  },
  toSmallestUnits(num: number, decimals: number = 18) {
    const a = new BigNumber(num);
    const unit = new BigNumber(10).pow(decimals);
    const result = a.times(unit);
    return result;
  },
};
