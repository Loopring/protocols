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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "./IVerificationKeyProvider.sol";


/// @title IExchangeModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IExchangeModule is IVerificationKeyProvider
{
    /// @dev Gets called by the exchange when the module is being removed.
    ///      This function can be used by the module to check if the module
    ///      can indeed be removed or not (e.g. there may still be requests
    ///      that need to be handled). If the module can be removed it can
    ///      also be used to disable certain functionality of the module so
    ///      the functions can't accidentaly be used after the module was
    ///      removed from the exchange.
    ///
    ///      The return value of this function can be used to stop the removal
    ///      of the module, either temporarily of permanently. For example, this
    ///      function can return false until all user requests are handled. Only
    ///      when all requests are handled can the function return true so that
    ///      the module can be removed.
    ///
    ///      Should only be callable by the exchange where the module is used.
    ///
    /// @return True if the module can be removed, else false
    function onRemove()
        external
        returns (bool);

    /// @dev Gets called by the exchange when a block gets reverted.
    ///      This function can be used by the module to revert any work that
    ///      was processed in the module for the reverted block or any blocks
    ///      after that block. For example, this is important for modules that
    ///      keep additional state onchain.
    ///      Onchain user requests can be flagged as processed when they were included
    ///      in a block that was committed, but that block can be reverted
    ///      on the exchange. In the given example, the module needs to take the necessary
    ///      actions to make sure those user requests in reverted blocks can be
    ///      included again in new blocks.
    ///
    ///      Should only be callable by the exchange where the module is used.
    function onRevert(
        uint blockIdx
        )
        external;

    /// @dev Returns data about the state of the module.
    /// @return needsWithdrawalMode True if the module requires the exchange to
    ///                             go into withdrawal mode (e.g. because an
    ///                             onchain request isn't handled by the operator).
    /// @return hasOpenRequests True if the module has unprocessed requests that
    ///                         should be handled by the operator for its users.
    /// @return priority The priority of the open requests on a [0, 100] scale.
    ///                  (with 100 the highest priority). This is so we can
    ///                  enforce certain block types to be committed over other
    ///                  block types (e.g. onchain withdrawal blocks can be
    ///                  forced over deposit blocks).
    function getStatus()
        external
        view
        returns (bool needsWithdrawalMode, bool hasOpenRequests, uint priority);
}
