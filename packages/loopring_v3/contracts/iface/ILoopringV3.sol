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
    // == Events ==========================================================

    event ExchangeCreated(
        uint    exchanegId,
        address exchangeAddress,
        address exchangeOwnerContractAddress,
        address creator,
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

    // == Public Variables ================================================

    address[] public exchanges;

    mapping (uint => uint) exchangeStakes; // exchangeId => amountOfLRC
    uint public totalStake = 0 ether;

    address public lrcAddress   = address(0);
    uint public creationCostLRC = 0 ether;

    // == Public Functions ================================================

    function updateSettings(
        address _lrcAddress,
        uint _creationCostLRC
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
}
