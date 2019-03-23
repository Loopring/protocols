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
pragma solidity 0.5.2;


/// @title IExchange
/// @author Daniel Wang - <daniel@loopring.org>
contract IDEX
{
    uint    public id = 0;
    address public loopring             = address(0);
    address public ownerContractAddress = address(0);
    address public creator              = address(0);
    address public lrcAddress           = address(0);

    uint    public stakedLRCPerFailure  = 0;
    uint32  public numOfFailuresAllowed = 0;
    uint32  public numOfFailuresOccured = 0;

    event LRCStaked(
      uint exchangeId,
      uint amount
    );
}
