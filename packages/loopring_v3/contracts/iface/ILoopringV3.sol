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


/// @title ILoopringV3
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract ILoopringV3
{
    // == Structs =========================================================

    struct Token
    {
        address tokenAddress;
        uint8   tier;
        uint    tierValidUntil;
    }

    // == Events ==========================================================

    event ExchangeCreated(
        uint    exchanegId,
        address exchangeAddress,
        address owner,
        address committer,
        uint    burnedLRC
    );

    event StakeDeposited(
        uint exchangeId,
        uint amount
    );

    event StakeBurned(
        uint exchangeId,
        uint amount
    );

    event StakeWithdrawn(
        uint exchangeId,
        uint amount
    );

    event SettingsUpdated(
        uint time
    );

    event TokenTierUpgraded(
        address indexed token,
        uint            tier
    );

    // == Constants =======================================================

    // Burn rates (in bips -- 100bips == 1%)
    uint16 public constant BURNRATE_TIER1 =  250;  // 2.5%
    uint16 public constant BURNRATE_TIER2 = 1500; //  15%
    uint16 public constant BURNRATE_TIER3 = 3000; //  30%
    uint16 public constant BURNRATE_TIER4 = 5000; //  50%

    uint   public constant TIER_UPGRADE_DURATION  = 365 days;

    // == Public Variables ================================================

    address[] public exchanges;

    mapping (uint => uint) exchangeStakes; // exchangeId => amountOfLRC

    uint    public totalStake   = 0 ether;
    address public lrcAddress   = address(0);
    address public wethAddress  = address(0);
    uint    public exchangeCreationCostLRC = 0 ether;

     // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16  public  tierUpgradeCostBips  =  0; // 0.01% or 130K LRC

    mapping (address => Token) public tokens;

    // == Public Functions ================================================

    function updateSettings(
        address _lrcAddress,
        address _wethAddress,
        uint    _exchangeCreationCostLRC,
        uint16  _tierUpgradeCostBips
        )
        external;

    function createExchange(
        address _exchangeOwnerContractAddress
        )
        external
        returns (
            uint exchangeId,
            address exchangeAddress
        );

    function getStake(
        uint exchangeId
        )
        public
        view
        returns (uint stakedLRC);

    function burnStake(
        uint exchangeId
        )
        external
        returns (uint stakedLRC);

    function depositStake(
        uint exchangeId,
        uint amountLRC
        )
        external
        returns (uint stakedLRC);

    function withdrawStake(
        uint exchangeId
        )
        external
        returns (uint stakedLRC);

    function getTokenBurnRate(
        address token
        )
        public
        view
        returns (uint16 burnRate);

    function upgradeTokenTier(
        address _token
        )
        external;
}
