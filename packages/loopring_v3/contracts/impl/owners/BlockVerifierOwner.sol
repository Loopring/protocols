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

import "./DelayedOwner.sol";
import "../../iface/IBlockVerifier.sol";


/// @title  BlockVerifierOwner
/// @author Brecht Devos - <brecht@loopring.org>
contract BlockVerifierOwner is DelayedOwner
{
    constructor(
        IBlockVerifier blockVerifier
        )
        DelayedOwner(address(blockVerifier))
        public
    {
        setFunctionDelay(blockVerifier.transferOwnership.selector, 7 days);
        setFunctionDelay(blockVerifier.registerCircuit.selector, 7 days);
        setFunctionDelay(blockVerifier.disableCircuit.selector, 1 days);
    }
}
