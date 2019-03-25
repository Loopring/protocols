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

import "../iface/IExchange.sol";
import "./exchange/StakeQuery.sol";


/// @title An Implementation of IExchange.
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Daniel Wang  - <daniel@loopring.org>
contract Exchange is IExchange, StakeQuery
{
    constructor(
        uint    _id,
        address _loopringAddress,
        address _owner,
        address payable _operator,
        address _lrcAddress,
        address _wethAddress,
        address _exchangeHelperAddress,
        address _blockVerifierAddress
        )
        public
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _owner, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");

        // We can't call functions on the loopring contract here
        loopring = ILoopringV3(loopringAddress);

        id = _id;
        loopringAddress = _loopringAddress;
        owner = _owner;
        operator = _operator;

        lrcAddress = _lrcAddress;
        exchangeHelperAddress = _exchangeHelperAddress;
        blockVerifierAddress = _blockVerifierAddress;

        registerToken(address(0));
        registerToken(_wethAddress);
        registerToken(lrcAddress);

        Block memory genesisBlock = Block(
            0x1325726ba90231a978b9ab8b6b232f27d419333c8098fbd57b3ddc7378c0d9ed,
            0x0,
            BlockState.FINALIZED,
            uint32(now),
            0,
            0,
            new bytes(0)
        );
        blocks.push(genesisBlock);

        createDefaultAccount();
    }
}