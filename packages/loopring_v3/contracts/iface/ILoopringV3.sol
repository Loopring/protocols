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

import "./ILoopring.sol";


/// @title ILoopringV3
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ILoopringV3 is ILoopring
{
    // == Events ==

    event ExchangeStakeDeposited(
        uint    indexed exchangeId,
        uint            amount
    );

    event ExchangeStakeWithdrawn(
        uint    indexed exchangeId,
        uint            amount
    );

    event ExchangeStakeBurned(
        uint    indexed exchangeId,
        uint            amount
    );

    event ProtocolFeeStakeDeposited(
        uint    indexed exchangeId,
        uint            amount
    );

    event ProtocolFeeStakeWithdrawn(
        uint    indexed exchangeId,
        uint            amount
    );

    event SettingsUpdated(
        uint            time
    );

    // == Public Variables ==
    struct Exchange
    {
        address exchangeAddress;
        uint    exchangeStake;
        uint    protocolFeeStake;
    }

    mapping (uint => Exchange) internal exchanges;

    string  constant public version = "3.0";

    address public wethAddress;
    uint    public totalStake;
    address public blockVerifierAddress;
    address public downtimeCostCalculator;
    uint    public maxWithdrawalFee;
    uint    public withdrawalFineLRC;
    uint    public tokenRegistrationFeeLRCBase;
    uint    public tokenRegistrationFeeLRCDelta;
    uint    public minExchangeStakeWithDataAvailability;
    uint    public minExchangeStakeWithoutDataAvailability;
    uint    public revertFineLRC;
    uint8   public minProtocolTakerFeeBips;
    uint8   public maxProtocolTakerFeeBips;
    uint8   public minProtocolMakerFeeBips;
    uint8   public maxProtocolMakerFeeBips;
    uint    public targetProtocolTakerFeeStake;
    uint    public targetProtocolMakerFeeStake;

    address payable public protocolFeeVault;

    // == Public Functions ==
    /// @dev Updates the global exchange settings.
    ///      This function can only be called by the owner of this contract.
    ///
    ///      Warning: these new values will be used by existing and
    ///      new Loopring exchanges.
    function updateSettings(
        address payable _protocolFeeVault,   // address(0) not allowed
        address _blockVerifierAddress,       // address(0) not allowed
        address _downtimeCostCalculator,     // address(0) allowed
        uint    _exchangeCreationCostLRC,
        uint    _maxWithdrawalFee,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDelta,
        uint    _minExchangeStakeWithDataAvailability,
        uint    _minExchangeStakeWithoutDataAvailability,
        uint    _revertFineLRC,
        uint    _withdrawalFineLRC
        )
        external;

    /// @dev Updates the global protocol fee settings.
    ///      This function can only be called by the owner of this contract.
    ///
    ///      Warning: these new values will be used by existing and
    ///      new Loopring exchanges.
    function updateProtocolFeeSettings(
        uint8 _minProtocolTakerFeeBips,
        uint8 _maxProtocolTakerFeeBips,
        uint8 _minProtocolMakerFeeBips,
        uint8 _maxProtocolMakerFeeBips,
        uint  _targetProtocolTakerFeeStake,
        uint  _targetProtocolMakerFeeStake
        )
        external;

    /// @dev Returns whether the Exchange has staked enough to commit blocks
    ///      Exchanges with on-chain data-availaiblity need to stake at least
    ///      minExchangeStakeWithDataAvailability, exchanges without
    ///      data-availability need to stake at least
    ///      minExchangeStakeWithoutDataAvailability.
    /// @param exchangeId The id of the exchange
    /// @param onchainDataAvailability True if the exchange has on-chain
    ///        data-availability, else false
    /// @return True if the exchange has staked enough, else false
    function canExchangeCommitBlocks(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        view
        returns (bool);

    /// @dev Gets the amount of staked LRC for an exchange.
    /// @param exchangeId The id of the exchange
    /// @return stakedLRC The amount of LRC
    function getExchangeStake(
        uint exchangeId
        )
        public
        view
        returns (uint stakedLRC);

    /// @dev Burns a certain amount of staked LRC for a specific exchange.
    ///      This function is meant to be called only from exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @return burnedLRC The amount of LRC burned. If the amount is greater than
    ///         the staked amount, all staked LRC will be burned.
    function burnExchangeStake(
        uint exchangeId,
        uint amount
        )
        external
        returns (uint burnedLRC);

    /// @dev Stakes more LRC for an exchange.
    /// @param  exchangeId The id of the exchange
    /// @param  amountLRC The amount of LRC to stake
    /// @return stakedLRC The total amount of LRC staked for the exchange
    function depositExchangeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC);

    /// @dev Withdraws a certain amount of staked LRC for an exchange to the given address.
    ///      This function is meant to be called only from within exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @param  recipient The address to receive LRC
    /// @param  requestedAmount The amount of LRC to withdraw
    /// @return stakedLRC The amount of LRC withdrawn
    function withdrawExchangeStake(
        uint    exchangeId,
        address recipient,
        uint    requestedAmount
        )
        external
        returns (uint amount);

    /// @dev Stakes more LRC for an exchange.
    /// @param  exchangeId The id of the exchange
    /// @param  amountLRC The amount of LRC to stake
    /// @return stakedLRC The total amount of LRC staked for the exchange
    function depositProtocolFeeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC);

    /// @dev Withdraws a certain amount of staked LRC for an exchange to the given address.
    ///      This function is meant to be called only from within exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @param  recipient The address to receive LRC
    /// @param  amount The amount of LRC to withdraw
    function withdrawProtocolFeeStake(
        uint    exchangeId,
        address recipient,
        uint    amount
        )
        external;

    /// @dev Gets the protocol fee values for an exchange.
    /// @param exchangeId The id of the exchange
    /// @param onchainDataAvailability True if the exchange has on-chain
    ///        data-availability, else false
    /// @return takerFeeBips The protocol taker fee
    /// @return makerFeeBips The protocol maker fee
    function getProtocolFeeValues(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        view
        returns (
            uint8 takerFeeBips,
            uint8 makerFeeBips
        );

    /// @dev Returns the exchange's protocol fee stake.
    /// @param  exchangeId The exchange's id.
    /// @return protocolFeeStake The exchange's protocol fee stake.
    function getProtocolFeeStake(
        uint exchangeId
        )
        external
        view
        returns (uint protocolFeeStake);
}
