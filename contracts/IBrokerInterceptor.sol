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
pragma solidity 0.4.23;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";


/// @title IBrokerInterceptor
contract IBrokerInterceptor {
    /// @dev Returns the max amount the broker can buy or sell.
    function getAllowance(
        address owner,
        address broker,
        address token
        )
        public
        view
        returns (uint allowance);

    /// @dev This method will be called from TradeDelegateImpl, so
    ///      it must check `msg.sender` is the address of LoopringProtocol.
    ///      Check https://github.com/Loopring/token-listing/blob/master/ethereum/deployment.md
    ///      for the current address of TradeDelegateImpl deployment.
    function onTokenSpent(
        address owner,
        address broker,
        address token,
        uint    amount
        )
        public
        returns (bool ok);
}