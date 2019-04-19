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
    // == Structs ==
    struct Token
    {
        address tokenAddress;
        uint8   tier;
        uint    tierValidUntil;
    }

    // == Events ==
    event ExchangeCreated(
        uint    indexed exchangeId,
        address indexed exchangeAddress,
        address indexed owner,
        address         operator,
        uint            burnedLRC
    );

    event StakeDeposited(
        uint    indexed exchangeId,
        uint            amount
    );

    event StakeBurned(
        uint    indexed exchangeId,
        uint            amount
    );

    event StakeWithdrawn(
        uint    indexed exchangeId,
        uint            amount
    );

    event SettingsUpdated(
        uint            time
    );

    event TokenBurnRateDown(
        address indexed token,
        uint    indexed tier,
        uint            time
    );

    // == Constants ==
    // Burn rates (in bips -- 100bips == 1%)
    uint16 public constant BURNRATE_TIER1 =  250; // 2.5%
    uint16 public constant BURNRATE_TIER2 = 1500; //  15%
    uint16 public constant BURNRATE_TIER3 = 3000; //  30%
    uint16 public constant BURNRATE_TIER4 = 5000; //  50%

    uint   public constant TIER_UPGRADE_DURATION  = 365 days;

    // == Public Variables ==
    address[] public exchanges;

    mapping (uint => uint) exchangeStakes; // exchangeId => amountOfLRC

    uint    public totalStake                   = 0;
    address public lrcAddress                   = address(0);
    address public wethAddress                  = address(0);
    address public exchangeDeployerAddress      = address(0);
    address public blockVerifierAddress         = address(0);
    uint    public exchangeCreationCostLRC      = 0;
    uint    public maxWithdrawalFee             = 0;
    uint    public downtimePriceLRCPerDay       = 0;
    uint    public withdrawalFineLRC            = 0;
    uint    public tokenRegistrationFeeLRCBase  = 0;
    uint    public tokenRegistrationFeeLRCDelta = 0;

    // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16  public  tierUpgradeCostBips  =  1; // 0.01% or 130K LRC

    mapping (address => Token) public tokens;

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

    /// @dev Get the amount of stacked LRC for an exchange.
    /// @param exchangeId The id of the exchange
    /// @return stakedLRC The amount of LRC
    function getStake(
        uint exchangeId
        )
        public
        view
        returns (uint stakedLRC);

    /// @dev Burn all staked LRC for a specific exchange.
    ///      This function is meant to be called only from within exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @return burnedLRC The amount of LRC burned
    function burnAllStake(
        uint exchangeId
        )
        external
        returns (uint burnedLRC);

    /// @dev Burn a certain amount of staked LRC for a specific exchange.
    ///      This function is meant to be called only from exchange contracts.
    /// @param  exchangeId The id of the exchange
    /// @return burnedLRC The amount of LRC burned. If the amount is greater than
    ///         the staked amount, all staked LRC will be burned.
    function burnStake(
        uint exchangeId,
        uint amount
        )
        public
        returns (uint burnedLRC);

    /// @dev Stake more LRC for an exchange.
    /// @param  exchangeId The id of the exchange
    /// @param  amountLRC The amount of LRC to stake
    /// @return stakedLRC The total amount of LRC staked for the exchange
    function depositStake(
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
    function withdrawStake(
        uint exchangeId,
        address recipient,
        uint requestedAmount
        )
        public
        returns (uint amount);

    /// @dev Get the burn rate for a given ERC20 token or Ether
    /// @param  token The address of the token. Use 0x0 for Ether.
    /// @return burnRate The burn rate in terms of bips.
    function getTokenBurnRate(
        address token
        )
        public
        view
        returns (uint16 burnRate);

    /// @dev Get the amount of LRC to burn for lowering a token's burn rate for 365 days.
    /// @param  token The address of the token. Use 0x0 for Ether
    /// @return amountLRC The amount of LRC to burn
    /// @return currentTier The current tier of the token
    function getLRCCostToBuydownTokenBurnRate(
        address token
        )
        public
        view
        returns (
            uint amountLRC,
            uint8 currentTier
        );

    /// @dev Burn LRC to lower a token's burn rate for 365 days.
    ///      Initially all ERC20 tokens' burn rates are at tier-4, with the exception
    ///      that LRC's burn rate is at tier-1, and WETH's burn rate is at tier-3. Ether's burn
    ///      rate is also at tier-3.
    ///
    ///      The amount of LRC required to lower the burn rate to the next level
    ///      is governed by `tierUpgradeCostBips`. If `tierUpgradeCostBips` is P,
    ///      a total of `137,495 * P` LRC is required.
    ///
    ///      Calling this function more than once will extend the burn rate period.
    ///      For example, if the token's current burn rate at tier-3 and the burn rate
    ///      is expiering (restoring to tier-4) in 30 days, a successfull call of this
    ///      function will extend the tier-2 period to 395 (365+30) days.
    ///
    /// @param  token The address of the token. Use 0x0 for Ether
    /// @return amountBurned The amount of LRC burned
    /// @return currentTier The current tier of the token after the buydown
    function buydownTokenBurnRate(
        address token
        )
        external
        returns (
            uint amountBurned,
            uint8 currentTier
        );

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
