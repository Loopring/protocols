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
pragma solidity 0.4.24;
pragma experimental "v0.5.0";
pragma experimental "ABIEncoderV2";


/// @title A safe wrapper around the IBrokerInterceptor functions
/// @author Brecht Devos - <brecht@loopring.org>.
library BrokerInterceptorProxy {

    function getAllowanceSafe(
        address brokerInterceptor,
        address owner,
        address broker,
        address token
        )
        internal
        returns (uint allowance)
    {
        bool success = brokerInterceptor.call.gas(5000)(
            0xe7092b41, // bytes4(keccak256("getAllowance(address,address,address)"))
            owner,
            broker,
            token
        );
        // Just return an allowance of 0 when something goes wrong
        if (success) {
            assembly {
                switch returndatasize()
                // We expect a single uint256 value
                case 32 {
                    returndatacopy(0, 0, 32)
                    allowance := mload(0)
                }
                // Unexpected return value
                default {
                    allowance := 0
                }
            }
        } else {
            allowance = 0;
        }
    }

    function onTokenSpentSafe(
        address brokerInterceptor,
        address owner,
        address broker,
        address token,
        uint    amount
        )
        internal
        returns (bool ok)
    {
        ok = brokerInterceptor.call.gas(25000)(
            0x9e80e44d, // bytes4(keccak256("onTokenSpent(address,address,address,uint256)"))
            owner,
            broker,
            token,
            amount
        );
        if (ok) {
            assembly {
                switch returndatasize()
                // We expect a single bool value
                case 32 {
                    returndatacopy(0, 0, 32)
                    ok := mload(0)
                }
                // Unexpected return value
                default {
                    ok := 0
                }
            }
        }
    }

}
