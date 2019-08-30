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

import "../impl/Data.sol";
import "../impl/ExchangeDeserializer.sol";


/* solium-disable */
contract DeserializerTest {

    address public lrcTokenAddress = address(0x0);

    constructor(address _lrcTokenAddress) public {
        require(_lrcTokenAddress != address(0x0));
        lrcTokenAddress = _lrcTokenAddress;
    }

    function deserialize(bytes calldata data)
        external
    /// we should not decorate this function as a view function because view function will not
    /// return tx recipient info after calling in uint test.
    // view
    {
        (
            Data.Mining  memory mining,
            Data.Order[] memory orders,
            Data.Ring[]  memory rings
        ) = ExchangeDeserializer.deserialize(lrcTokenAddress, data);
        (mining, orders, rings); // To disable compilation warning
    }

    function submitByArrays(uint16[] calldata uint16Data,
                            uint[] calldata uintData,
                            address[] calldata addresses,
                            uint ringSize)
        external
    // view
    {
        // Data.Mining  memory mining = Data.Mining(
        //     addresses[0],
        //     addresses[1],
        //     new bytes(0),
        //     bytes32(0x0),
        //     0x0
        // );

        Data.Order[] memory orders = new Data.Order[](ringSize);
        Data.Participation[] memory participations = new Data.Participation[](ringSize);
        for (uint i = 0; i < ringSize; i++) {
            orders[i] = assembleOrder(uint16Data, uintData, addresses);
            participations[i] = assembleParicipation(orders[i]);
        }

        Data.Ring[] memory rings = new Data.Ring[](1);
        rings[0] = Data.Ring(
            2,
            participations,
            bytes32(0x0),
            0,
            true
        );
    }

    function assembleOrder(uint16[] memory uint16Data,
                           uint[] memory uintData,
                           address[] memory addresses)
        internal
        view
        returns (Data.Order memory order)
    {
        order = Data.Order(
            0,
            addresses[0], // owner
            addresses[0], // tokenS
            address(0x0),         // tokenB
            uintData[0],    // amountS
            uintData[0],    // amountB
            uintData[0],    // validSince
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            addresses[0],
            addresses[0],
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            addresses[0],
            addresses[0],
            uintData[0],
            new bytes(0),
            new bytes(0),
            true,
            lrcTokenAddress,
            uintData[0],
            int16(uint16Data[0]),
            uint16Data[0],
            uint16Data[0],
            addresses[0],
            uint16Data[0],
            false,        // P2P
            bytes32(0x0), // hash
            address(0x0), // orderBrokerInterceptor
            0,            // filledAmountS
            0,            // initialFilledAmountS
            true,         // valid
            Data.TokenType.ERC20,
            Data.TokenType.ERC20,
            Data.TokenType.ERC20,
            0x0,
            0x0,
            new bytes(0)
        );

    }

    function assembleParicipation(Data.Order memory order)
        internal
        pure
        returns (Data.Participation memory p)
    {
        p = Data.Participation(
            order,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0
        );
    }
}
