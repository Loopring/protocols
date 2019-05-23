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


/// @title ILoopringV3
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ILoopringV3
{
    // == Events ==
    event ExchangeCreated(
        uint    indexed exchangeId,
        address indexed exchangeAddress,
        address indexed owner,
        address         operator,
        uint            burnedLRC
    );

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
        uint exchangeStake;
        uint protocolFeeStake;
    }
    Exchange[] public exchanges;

    uint    public totalStake                                       = 0;

    address public lrcAddress                                       = address(0);
    address public wethAddress                                      = address(0);
    address public exchangeDeployerAddress                          = address(0);
    address public blockVerifierAddress                             = address(0);
    uint    public exchangeCreationCostLRC                          = 0;
    uint    public maxWithdrawalFee                                 = 0;
    uint    public downtimePriceLRCPerDay                           = 0;
    uint    public withdrawalFineLRC                                = 0;
    uint    public tokenRegistrationFeeLRCBase                      = 0;
    uint    public tokenRegistrationFeeLRCDelta                     = 0;
    uint    public minExchangeStakeWithDataAvailability             = 0;
    uint    public minExchangeStakeWithoutDataAvailability          = 0;
    uint    public revertFineLRC                                    = 50000 ether;
    uint8   public minProtocolTakerFeeBips                          = 25;
    uint8   public maxProtocolTakerFeeBips                          = 50;
    uint8   public minProtocolMakerFeeBips                          = 10;
    uint8   public maxProtocolMakerFeeBips                          = 25;
    uint    public targetProtocolTakerFeeStake                      = 25000000 ether;
    uint    public targetProtocolMakerFeeStake                      = 10000000 ether;

    // == Public Functions ==
    /// @dev Update the global exchange settings.
    ///      This function can onlhy be called by the owner the this contract.
    ///
    ///      Warning: theese new values will be used by existing and
    ///      new Loopring exchanges.
    function updateSettings(
        address _blockVerifierAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips,
        uint    _maxWithdrawalFee,
        uint    _downtimePriceLRCPerDay,
        uint    _withdrawalFineLRC,
        uint    _tokenRegistrationFeeLRCBase,
        uint    _tokenRegistrationFeeLRCDalta
        )
        external;

    /// @dev Create a new exchange. msg.sender will become the owner of the new exchange.
    /// @param  operator The operator address of the exchange who will be responsible for
    ///         submitting blocks and proofs.
    /// @param  onchainDataAvailability True if "Data Availability" is turned on for this
    ///         exchange. Note that this value can not be changed once the exchange is created.
    /// @return exchangeId The id of the exchange.
    /// @return exchangeAddress The address of the newly depolyed exchange contract.
    function createExchange(
        address payable operator,
        bool onchainDataAvailability
        )
        external
        returns (
            uint exchangeId,
            address exchangeAddress
        );

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

    /// @dev Get the amount of staked LRC for an exchange.
    /// @param exchangeId The id of the exchange
    /// @return stakedLRC The amount of LRC
    function getExchangeStake(
        uint exchangeId
        )
        public
        view
        returns (uint stakedLRC);

    /// @dev Burn a certain amount of staked LRC for a specific exchange.
    ///      This function is meant to be called only from exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @return burnedLRC The amount of LRC burned. If the amount is greater than
    ///         the staked amount, all staked LRC will be burned.
    function burnExchangeStake(
        uint exchangeId,
        uint amount
        )
        public
        returns (uint burnedLRC);

    /// @dev Stake more LRC for an exchange.
    /// @param  exchangeId The id of the exchange
    /// @param  amountLRC The amount of LRC to stake
    /// @return stakedLRC The total amount of LRC staked for the exchange
    function depositExchangeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC);

    /// @dev Withdraw a certain amount of staked LRC for an exchange to the given address.
    ///      This function is meant to be called only from within exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @param  recipient The address to receive LRC
    /// @param  requestedAmount The amount of LRC to withdraw
    /// @return stakedLRC The amount of LRC withdrawn
    function withdrawExchangeStake(
        uint exchangeId,
        address recipient,
        uint requestedAmount
        )
        public
        returns (uint amount);

    /// @dev Stake more LRC for an exchange.
    /// @param  exchangeId The id of the exchange
    /// @param  amountLRC The amount of LRC to stake
    /// @return stakedLRC The total amount of LRC staked for the exchange
    function depositProtocolFeeStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC);

    /// @dev Withdraw a certain amount of staked LRC for an exchange to the given address.
    ///      This function is meant to be called only from within exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @param  recipient The address to receive LRC
    /// @param  amount The amount of LRC to withdraw
    function withdrawProtocolFeeStake(
        uint exchangeId,
        address recipient,
        uint amount
        )
        external;

    /// @dev Withdraw
    /// @param exchangeId The id of the exchange to withdraw the fees from
    /// @param tokenAddress The token to withdraw the fees for
    function withdrawProtocolFees(
        uint exchangeId,
        address tokenAddress
        )
        external
        payable;

    /// @dev Get the protocol fees for an exchange.
    /// @param exchangeId The id of the exchange
    /// @param onchainDataAvailability True if the exchange has on-chain
    ///        data-availability, else false
    /// @return takerFeeBips The protocol taker fee
    /// @return makerFeeBips The protocol maker fee
    function getProtocolFees(
        uint exchangeId,
        bool onchainDataAvailability
        )
        external
        view
        returns (uint8 takerFeeBips, uint8 makerFeeBips);

    /// @dev Withdraw all non-LRC fees (called the Burn) to the designated address.
    ///      LRC fees have been burned already thanks to the new LRC contract's burn function;
    ///      All non-LRC fees will be auctioned off for LRC by the Looprong Foundation, the
    ///      purchased LRC will also be publicly burned.
    ///
    ///      In the future, all non-LRC fees will be auctioned off in a fully decentralized
    ///      fashion using Loopring's Oedax (Open-Ended Dutch Auction eXchange) protocol.
    ///      For more details, please see:
    ///      https://medium.com/loopring-protocol/oedax-looprings-open-ended-dutch-auction-exchange-model-d92cebbd3667
    ///
    /// @param  token The address of the token. Use 0x0 for Ether.
    /// @param  recipient The address to receive the tokens.
    function withdrawTheBurn(
        address token,
        address payable recipient
        )
        external;

    /// @dev Allow ETH to be sent directly to this contract (for burning)
    function()
        external
        payable;
}
