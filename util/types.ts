/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/
var BigNumber = require('bignumber.js');

export interface OrderParams {
  loopringProtocol: string;
  tokenS: string;
  tokenB: string;
  amountS: BigNumber.BigNumber;
  amountB: BigNumber.BigNumber;
  timestamp: number;
  expiration: number;
  rand: number;
  lrcFee: BigNumber.BigNumber;
  buyNoMoreThanAmountB: boolean;
  marginSplitPercentage: number;
  orderHashHex?: string;
  v?: number;
  r?: string;
  s?: string;
}
