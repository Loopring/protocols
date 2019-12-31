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

import "../ILoopringV3.sol";


/// @title IExchangeV3Base
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract IExchangeV3Base
{
    // -- Events --
    // We need to make sure all events defined in ExchangeBase.sol
    // are aggregrated here.
    event Shutdown(
        uint            timestamp
    );

    event OperatorChanged(
        uint    indexed exchangeId,
        address         oldOperator,
        address         newOperator
    );

    /// @dev Initializes this exchange. This method can only be called once.
    /// @param  owner The owner of this exchange.
    /// @param  exchangeId The id of this exchange.
    /// @param  operator The operator address of the exchange who will be responsible for
    ///         submitting blocks and proofs.
    /// @param  loopringAddress The corresponding ILoopring contract address.
    /// @param  onchainDataAvailability True if "Data Availability" is turned on for this
    ///         exchange. Note that this value can not be changed once the exchange is initialized.
    function initialize(
        address loopringAddress,
        address owner,
        uint    exchangeId,
        address payable operator,
        bool    onchainDataAvailability
        )
        external;

    /// @dev Shuts down the exchange.
    ///      Once the exchange is shutdown all onchain requests are permanently disabled.
    ///      When all requirements are fulfilled the exchange owner can withdraw
    ///      the exchange stake with withdrawStake.
    ///
    ///      Note that the exchange can still enter the withdrawal mode after this function
    ///      has been invoked successfully. To prevent entering the withdrawal mode, exchange
    ///      operators need to reset the Merkle tree to its initial state by doing withdrawals
    ///      within MAX_TIME_IN_SHUTDOWN_BASE + (accounts.length * MAX_TIME_IN_SHUTDOWN_DELTA)
    ///      seconds.
    ///
    ///      Can only be called by the exchange owner.
    ///
    /// @return success True if the exchange is shutdown, else False
    function shutdown()
        external
        returns (bool success);

    /// @dev Sets the operator address.
    /// @param _operator The new operator's address
    /// @return oldOperator The old operator's address
    function setOperator(
        address payable _operator
        )
        external
        returns (address payable oldOperator);

    /// @dev Gets the operator address.
    /// @return The operator address.
    function getOperator()
        external
        view
        returns (address);

    /// @dev Returns if the exchange accepts user request.
    /// @return Returns true if the exchange accepts user requests, else false.
    function areUserRequestsEnabled()
        external
        returns (bool);

    /// @dev Returns if the exchange is in withdrawal mode.
    /// @return Returns true if the exchange is in withdrawal mode, else false.
    function isInWithdrawalMode()
        external
        returns (bool);

    /// @dev Returns if the exchange is shutdown.
    /// @return Returns true if the exchange is shutdown, else false.
    function isShutdown()
        external
        view
        returns (bool);

    /// @dev Returns if the exchange is in maintenance.
    /// @return Returns true if the exchange is in maintenance, else false.
    function isInMaintenance()
        external
        view
        returns (bool);

    /// @dev Returns the protocol address of this exchange
    /// @return Returns the protocol address
    function getProtocol()
        external
        view
        returns (ILoopringV3);

    /// @dev Returns the exchange ID
    /// @return The exchange ID
    function getId()
        external
        view
        returns (uint);

    /// @dev Returns if the exchange requires on-chain data-availability
    /// @return True if on-chain data-availability is required, else false
    function hasOnchainDataAvailability()
        external
        view
        returns (bool);

    /// @dev Gets the time the exchange was created.
    /// @return timestamp The time the exchange was created.
    function getExchangeCreationTimestamp()
        external
        view
        returns (uint timestamp);
}
