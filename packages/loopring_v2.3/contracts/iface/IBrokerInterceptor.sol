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
pragma solidity 0.5.7;


/// @title IBrokerInterceptor
contract IBrokerInterceptor {
    /// @dev   Returns the maximum amount of tokens the broker can sell for the owner
    /// @param owner The owner for which the broker can spend funds
    /// @param broker The broker of the owner
    /// @param token The token to spend
    /// @return The allowance
    function getAllowance(
        address owner,
        address broker,
        address token
        )
        public
        view
        returns (uint allowance);

    /// @dev Lets the interceptor know how much the broker has spent for an owner.
    ///      This method will be called from RingSubmitter, so
    ///      it must check `msg.sender` is the address of the Loopring Protocol.
    ///      Check https://github.com/Loopring/token-listing/blob/master/ethereum/deployment.md
    ///      for the current address of RingSubmitter deployment.
    /// @param owner The owner for which the broker has spent funds
    /// @param broker The broker of the owner
    /// @param token The token spent
    /// @param amount The amount spent
    /// @return True if successful, false otherwise.
    function onTokenSpent(
        address owner,
        address broker,
        address token,
        uint    amount
        )
        public
        returns (bool ok);
}
