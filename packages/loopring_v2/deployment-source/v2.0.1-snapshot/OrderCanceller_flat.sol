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



/// @title Utility Functions for uint
/// @author Daniel Wang - <daniel@loopring.org>
library MathUint {

    function mul(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint c)
    {
        c = a * b;
        require(a == 0 || c / a == b, "INVALID_VALUE");
    }

    function sub(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint)
    {
        require(b <= a, "INVALID_VALUE");
        return a - b;
    }

    function add(
        uint a,
        uint b
        )
        internal
        pure
        returns (uint c)
    {
        c = a + b;
        require(c >= a, "INVALID_VALUE");
    }
}
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





/// @title Utility Functions for bytes
/// @author Daniel Wang - <daniel@loopring.org>
library BytesUtil {
    function bytesToBytes32(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (bytes32)
    {
        return bytes32(bytesToUintX(b, offset, 32));
    }

    function bytesToUint(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (uint)
    {
        return bytesToUintX(b, offset, 32);
    }

    function bytesToAddress(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (address)
    {
        return address(bytesToUintX(b, offset, 20) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    }

    function bytesToUint16(
        bytes b,
        uint offset
        )
        internal
        pure
        returns (uint16)
    {
        return uint16(bytesToUintX(b, offset, 2) & 0xFFFF);
    }

    function bytesToUintX(
        bytes b,
        uint offset,
        uint numBytes
        )
        private
        pure
        returns (uint data)
    {
        require(b.length >= offset + numBytes, "INVALID_SIZE");
        assembly {
            data := mload(add(add(b, numBytes), offset))
        }
    }
}
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





/// @title ITradeDelegate
/// @dev Acts as a middle man to transfer ERC20 tokens on behalf of different
/// versions of Loopring protocol to avoid ERC20 re-authorization.
/// @author Daniel Wang - <daniel@loopring.org>.
contract ITradeDelegate {
    event AddressAuthorized(
        address indexed addr
    );

    event AddressDeauthorized(
        address indexed addr
    );

    // The list of all authorized addresses
    address[] authorizedAddresses;

    // The following map is used to keep trace of order fill and cancellation
    // history.
    mapping (bytes32 => uint) public filled;

    // This map is used to keep trace of order's cancellation history.
    mapping (address => mapping (bytes32 => bool)) public cancelled;

    // A map from a broker to its cutoff timestamp.
    mapping (address => uint) public cutoffs;

    // A map from a broker to its trading-pair cutoff timestamp.
    mapping (address => mapping (bytes20 => uint)) public tradingPairCutoffs;

    // A map from a broker to an order owner to its cutoff timestamp.
    mapping (address => mapping (address => uint)) public cutoffsOwner;

    // A map from a broker to an order owner to its trading-pair cutoff timestamp.
    mapping (address => mapping (address => mapping (bytes20 => uint))) public tradingPairCutoffsOwner;


    /// @dev Add a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function authorizeAddress(
        address addr
        )
        external;

    /// @dev Remove a Loopring protocol address.
    /// @param addr A loopring protocol address.
    function deauthorizeAddress(
        address addr
        )
        external;

    function batchTransfer(
        bytes32[] batch
        )
        external;

    function batchUpdateFilled(
        bytes32[] filledInfo
        )
        external;

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool);

    function setCancelled(
        address broker,
        bytes32 orderHash
        )
        external;

    function setCutoffs(
        address broker,
        uint cutoff
        )
        external;

    function setTradingPairCutoffs(
        address broker,
        bytes20 tokenPair,
        uint cutoff
        )
        external;

    function setCutoffsOfOwner(
        address broker,
        address owner,
        uint cutoff
        )
        external;

    function setTradingPairCutoffsOfOwner(
        address broker,
        address owner,
        bytes20 tokenPair,
        uint cutoff
        )
        external;

    function batchGetFilledAndCheckCancelled(
        bytes32[] orderInfo
        )
        external
        view
        returns (uint[]);

    function suspend()
        external;

    function resume()
        external;

    function kill()
        external;
}
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





/// @title IOrderRegistry
/// @author Daniel Wang - <daniel@loopring.org>.
contract IOrderRegistry {

    /// @dev   Returns wether the order hash was registered in the registry.
    /// @param broker The broker of the order
    /// @param orderHash The hash of the order
    /// @return True if the order hash was registered, else false.
    function isOrderHashRegistered(
        address broker,
        bytes32 orderHash
        )
        external
        view
        returns (bool);

    /// @dev   Registers an order in the registry.
    ///        msg.sender needs to be the broker of the order.
    /// @param orderHash The hash of the order
    function registerOrderHash(
        bytes32 orderHash
        )
        external;
}
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





/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @title IFeeHolder - A contract holding fees.
contract IFeeHolder {

    event TokenWithdrawn(
        address owner,
        address token,
        uint value
    );

    // A map of all fee balances
    mapping(address => mapping(address => uint)) public feeBalances;

    /// @dev   Allows withdrawing the tokens to be burned by
    ///        authorized contracts.
    /// @param token The token to be used to burn buy and burn LRC
    /// @param value The amount of tokens to withdraw
    function withdrawBurned(
        address token,
        uint value
        )
        external
        returns (bool success);

    /// @dev   Allows withdrawing the fee payments funds
    ///        msg.sender is the recipient of the fee and the address
    ///        to which the tokens will be sent.
    /// @param token The token to withdraw
    /// @param value The amount of tokens to withdraw
    function withdrawToken(
        address token,
        uint value
        )
        external
        returns (bool success);

    function batchAddFeeBalances(
        bytes32[] batch
        )
        external;
}
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





/// @title IBrokerRegistry
/// @dev A broker is an account that can submit orders on behalf of other
///      accounts. When registering a broker, the owner can also specify a
///      pre-deployed BrokerInterceptor to hook into the exchange smart contracts.
/// @author Daniel Wang - <daniel@loopring.org>.
contract IBrokerRegistry {
    event BrokerRegistered(
        address owner,
        address broker,
        address interceptor
    );

    event BrokerUnregistered(
        address owner,
        address broker,
        address interceptor
    );

    event AllBrokersUnregistered(
        address owner
    );

    /// @dev   Validates if the broker was registered for the order owner and
    ///        returns the possible BrokerInterceptor to be used.
    /// @param owner The owner of the order
    /// @param broker The broker of the order
    /// @return True if the broker was registered for the owner
    ///         and the BrokerInterceptor to use.
    function getBroker(
        address owner,
        address broker
        )
        external
        view
        returns(
            bool registered,
            address interceptor
        );

    /// @dev   Gets all registered brokers for an owner.
    /// @param owner The owner
    /// @param start The start index of the list of brokers
    /// @param count The number of brokers to return
    /// @return The list of requested brokers and corresponding BrokerInterceptors
    function getBrokers(
        address owner,
        uint    start,
        uint    count
        )
        external
        view
        returns (
            address[] brokers,
            address[] interceptors
        );

    /// @dev   Registers a broker for msg.sender and an optional
    ///        corresponding BrokerInterceptor.
    /// @param broker The broker to register
    /// @param interceptor The optional BrokerInterceptor to use (0x0 allowed)
    function registerBroker(
        address broker,
        address interceptor
        )
        external;

    /// @dev   Unregisters a broker for msg.sender
    /// @param broker The broker to unregister
    function unregisterBroker(
        address broker
        )
        external;

    /// @dev   Unregisters all brokers for msg.sender
    function unregisterAllBrokers(
        )
        external;
}
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







/// @title Utility Functions for Multihash signature verificaiton
/// @author Daniel Wang - <daniel@loopring.org>
/// For more information:
///   - https://github.com/saurfang/ipfs-multihash-on-solidity
///   - https://github.com/multiformats/multihash
///   - https://github.com/multiformats/js-multihash
library MultihashUtil {

    enum HashAlgorithm { Ethereum, EIP712 }

    string public constant SIG_PREFIX = "\x19Ethereum Signed Message:\n32";

    function verifySignature(
        address signer,
        bytes32 plaintext,
        bytes   multihash
        )
        internal
        pure
        returns (bool)
    {
        uint length = multihash.length;
        require(length >= 2, "invalid multihash format");
        uint8 algorithm;
        uint8 size;
        assembly {
            algorithm := mload(add(multihash, 1))
            size := mload(add(multihash, 2))
        }
        require(length == (2 + size), "bad multihash size");

        if (algorithm == uint8(HashAlgorithm.Ethereum)) {
            require(signer != 0x0, "invalid signer address");
            require(size == 65, "bad Ethereum multihash size");
            bytes32 hash;
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                let data := mload(0x40)
                mstore(data, 0x19457468657265756d205369676e6564204d6573736167653a0a333200000000) // SIG_PREFIX
                mstore(add(data, 28), plaintext)                                                 // plaintext
                hash := keccak256(data, 60)                                                      // 28 + 32
                // Extract v, r and s from the multihash data
                v := mload(add(multihash, 3))
                r := mload(add(multihash, 35))
                s := mload(add(multihash, 67))
            }
            return signer == ecrecover(
                hash,
                v,
                r,
                s
            );
        } else if (algorithm == uint8(HashAlgorithm.EIP712)) {
            require(signer != 0x0, "invalid signer address");
            require(size == 65, "bad EIP712 multihash size");
            uint8 v;
            bytes32 r;
            bytes32 s;
            assembly {
                // Extract v, r and s from the multihash data
                v := mload(add(multihash, 3))
                r := mload(add(multihash, 35))
                s := mload(add(multihash, 67))
            }
            return signer == ecrecover(
                plaintext,
                v,
                r,
                s
            );
        } else {
            return false;
        }
    }
}

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





/// @title ERC20 Token Interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
/// @author Daniel Wang - <daniel@loopring.org>
contract ERC20 {
    function totalSupply()
        public
        view
        returns (uint256);

    function balanceOf(
        address who
        )
        public
        view
        returns (uint256);

    function allowance(
        address owner,
        address spender
        )
        public
        view
        returns (uint256);

    function transfer(
        address to,
        uint256 value
        )
        public
        returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
        )
        public
        returns (bool);

    function approve(
        address spender,
        uint256 value
        )
        public
        returns (bool);
}
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





/// @author Brecht Devos - <brecht@loopring.org>
/// @title IBurnRateTable - A contract for managing burn rates for tokens
contract IBurnRateTable {

    struct TokenData {
        uint    tier;
        uint    validUntil;
    }

    mapping(address => TokenData) public tokens;

    uint public constant YEAR_TO_SECONDS = 31556952;

    // Tiers
    uint8 public constant TIER_4 = 0;
    uint8 public constant TIER_3 = 1;
    uint8 public constant TIER_2 = 2;
    uint8 public constant TIER_1 = 3;

    uint16 public constant BURN_BASE_PERCENTAGE           =                 100 * 10; // 100%

    // Cost of upgrading the tier level of a token in a percentage of the total LRC supply
    uint16 public constant TIER_UPGRADE_COST_PERCENTAGE   =                        1; // 0.1%

    // Burn rates
    // Matching
    uint16 public constant BURN_MATCHING_TIER1            =                   5 * 10; //   5%
    uint16 public constant BURN_MATCHING_TIER2            =                  20 * 10; //  20%
    uint16 public constant BURN_MATCHING_TIER3            =                  40 * 10; //  40%
    uint16 public constant BURN_MATCHING_TIER4            =                  60 * 10; //  60%
    // P2P
    uint16 public constant BURN_P2P_TIER1                 =                        5; // 0.5%
    uint16 public constant BURN_P2P_TIER2                 =                   2 * 10; //   2%
    uint16 public constant BURN_P2P_TIER3                 =                   3 * 10; //   3%
    uint16 public constant BURN_P2P_TIER4                 =                   6 * 10; //   6%

    event TokenTierUpgraded(
        address indexed addr,
        uint            tier
    );

    /// @dev   Returns the P2P and matching burn rate for the token.
    /// @param token The token to get the burn rate for.
    /// @return The burn rate. The P2P burn rate and matching burn rate
    ///         are packed together in the lowest 4 bytes.
    ///         (2 bytes P2P, 2 bytes matching)
    function getBurnRate(
        address token
        )
        external
        view
        returns (uint32 burnRate);

    /// @dev   Returns the tier of a token.
    /// @param token The token to get the token tier for.
    /// @return The tier of the token
    function getTokenTier(
        address token
        )
        public
        view
        returns (uint);

    /// @dev   Upgrades the tier of a token. Before calling this function,
    ///        msg.sender needs to approve this contract for the neccessary funds.
    /// @param token The token to upgrade the tier for.
    /// @return True if successful, false otherwise.
    function upgradeTokenTier(
        address token
        )
        external
        returns (bool);

}


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





/// @title IOrderBook
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract IOrderBook {
    // The map of registered order hashes
    mapping(bytes32 => bool) public orderSubmitted;

    /// @dev  Event emitted when an order was successfully submitted
    ///        orderHash      The hash of the order
    ///        orderData      The data of the order as passed to submitOrder()
    event OrderSubmitted(
        bytes32 orderHash,
        bytes   orderData
    );

    /// @dev   Submits an order to the on-chain order book.
    ///        No signature is needed. The order can only be sumbitted by its
    ///        owner or its broker (the owner can be the address of a contract).
    /// @param orderData The data of the order. Contains all fields that are used
    ///        for the order hash calculation.
    ///        See OrderHelper.updateHash() for detailed information.
    function submitOrder(
        bytes orderData
        )
        external
        returns (bytes32);
}





library Data {

    struct Header {
        uint version;
        uint numOrders;
        uint numRings;
        uint numSpendables;
    }

    struct Context {
        address lrcTokenAddress;
        ITradeDelegate  delegate;
        IBrokerRegistry orderBrokerRegistry;
        IOrderRegistry  orderRegistry;
        IFeeHolder feeHolder;
        IOrderBook orderBook;
        IBurnRateTable burnRateTable;
        uint64 ringIndex;
        uint feePercentageBase;
        bytes32[] tokenBurnRates;
        uint feeData;
        uint feePtr;
        uint transferData;
        uint transferPtr;
    }

    struct Mining {
        // required fields
        address feeRecipient;

        // optional fields
        address miner;
        bytes   sig;

        // computed fields
        bytes32 hash;
        address interceptor;
    }

    struct Spendable {
        bool initialized;
        uint amount;
        uint reserved;
    }

    struct Order {
        uint      version;

        // required fields
        address   owner;
        address   tokenS;
        address   tokenB;
        uint      amountS;
        uint      amountB;
        uint      validSince;
        Spendable tokenSpendableS;
        Spendable tokenSpendableFee;

        // optional fields
        address   dualAuthAddr;
        address   broker;
        Spendable brokerSpendableS;
        Spendable brokerSpendableFee;
        address   orderInterceptor;
        address   wallet;
        uint      validUntil;
        bytes     sig;
        bytes     dualAuthSig;
        bool      allOrNone;
        address   feeToken;
        uint      feeAmount;
        int16     waiveFeePercentage;
        uint16    tokenSFeePercentage;    // Pre-trading
        uint16    tokenBFeePercentage;   // Post-trading
        address   tokenRecipient;
        uint16    walletSplitPercentage;

        // computed fields
        bool    P2P;
        bytes32 hash;
        address brokerInterceptor;
        uint    filledAmountS;
        uint    initialFilledAmountS;
        bool    valid;
    }

    struct Participation {
        // required fields
        Order order;

        // computed fields
        uint splitS;
        uint feeAmount;
        uint feeAmountS;
        uint feeAmountB;
        uint rebateFee;
        uint rebateS;
        uint rebateB;
        uint fillAmountS;
        uint fillAmountB;
    }

    struct Ring{
        uint size;
        Participation[] participations;
        bytes32 hash;
        uint minerFeesToOrdersPercentage;
        bool valid;
    }

    struct FeeContext {
        Data.Ring ring;
        Data.Context ctx;
        address feeRecipient;
        uint walletPercentage;
        int16 waiveFeePercentage;
        address owner;
        address wallet;
        bool P2P;
    }
}
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








/// @title MiningHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library MiningHelper {

    function updateMinerAndInterceptor(
        Data.Mining mining
        )
        internal
        pure
    {

        if (mining.miner == 0x0) {
            mining.miner = mining.feeRecipient;
        }

        // We do not support any interceptors for now
        /* else { */
        /*     (bool registered, address interceptor) = ctx.minerBrokerRegistry.getBroker( */
        /*         mining.feeRecipient, */
        /*         mining.miner */
        /*     ); */
        /*     if (registered) { */
        /*         mining.interceptor = interceptor; */
        /*     } */
        /* } */
    }

    function updateHash(
        Data.Mining mining,
        Data.Ring[] rings
        )
        internal
        pure
    {
        bytes32 hash;
        assembly {
            let ring := mload(add(rings, 32))                               // rings[0]
            let ringHashes := mload(add(ring, 64))                          // ring.hash
            for { let i := 1 } lt(i, mload(rings)) { i := add(i, 1) } {
                ring := mload(add(rings, mul(add(i, 1), 32)))               // rings[i]
                ringHashes := xor(ringHashes, mload(add(ring, 64)))         // ring.hash
            }
            let data := mload(0x40)
            data := add(data, 12)
            // Store data back to front to allow overwriting data at the front because of padding
            mstore(add(data, 40), ringHashes)                               // ringHashes
            mstore(sub(add(data, 20), 12), mload(add(mining, 32)))          // mining.miner
            mstore(sub(data, 12),          mload(add(mining,  0)))          // mining.feeRecipient
            hash := keccak256(data, 72)                                     // 20 + 20 + 32
        }
        mining.hash = hash;
    }

    function checkMinerSignature(
        Data.Mining mining
        )
        internal
        view
        returns (bool)
    {
        if (mining.sig.length == 0) {
            return (msg.sender == mining.miner);
        } else {
            return MultihashUtil.verifySignature(
                mining.miner,
                mining.hash,
                mining.sig
            );
        }
    }

}

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











/// @title OrderHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library OrderHelper {
    using MathUint      for uint;
    using BrokerInterceptorProxy for address;

    string constant internal EIP191_HEADER = "\x19\x01";
    string constant internal EIP712_DOMAIN_NAME = "Loopring Protocol";
    string constant internal EIP712_DOMAIN_VERSION = "2";
    bytes32 constant internal EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH = keccak256(
        abi.encodePacked(
            "EIP712Domain(",
            "string name,",
            "string version",
            ")"
        )
    );
    bytes32 constant internal EIP712_ORDER_SCHEMA_HASH = keccak256(
        abi.encodePacked(
            "Order(",
            "uint amountS,",
            "uint amountB,",
            "uint feeAmount,",
            "uint validSince,",
            "uint validUntil,",
            "address owner,",
            "address tokenS,",
            "address tokenB,",
            "address dualAuthAddr,",
            "address broker,",
            "address orderInterceptor,",
            "address wallet,",
            "address tokenRecipient,",
            "address feeToken,",
            "uint16 walletSplitPercentage,",
            "uint16 tokenSFeePercentage,",
            "uint16 tokenBFeePercentage,",
            "bool allOrNone",
            ")"
        )
    );
    bytes32 constant internal EIP712_DOMAIN_HASH = keccak256(
        abi.encodePacked(
            EIP712_DOMAIN_SEPARATOR_SCHEMA_HASH,
            keccak256(bytes(EIP712_DOMAIN_NAME)),
            keccak256(bytes(EIP712_DOMAIN_VERSION))
        )
    );

    function updateHash(Data.Order order)
        internal
        pure
    {
        /* bytes32 message = keccak256( */
        /*     abi.encode( */
        /*         EIP712_ORDER_SCHEMA_HASH, */
        /*         order.amountS, */
        /*         order.amountB, */
        /*         order.feeAmount, */
        /*         order.validSince, */
        /*         order.validUntil, */
        /*         order.owner, */
        /*         order.tokenS, */
        /*         order.tokenB, */
        /*         order.dualAuthAddr, */
        /*         order.broker, */
        /*         order.orderInterceptor, */
        /*         order.wallet, */
        /*         order.tokenRecipient */
        /*         order.feeToken, */
        /*         order.walletSplitPercentage, */
        /*         order.tokenSFeePercentage, */
        /*         order.tokenBFeePercentage, */
        /*         order.allOrNone */
        /*     ) */
        /* ); */
        /* order.hash = keccak256( */
        /*    abi.encodePacked( */
        /*        EIP191_HEADER, */
        /*        EIP712_DOMAIN_HASH, */
        /*        message */
        /*    ) */
        /*); */

        // Precalculated EIP712_ORDER_SCHEMA_HASH amd EIP712_DOMAIN_HASH because
        // the solidity compiler doesn't correctly precalculate them for us.
        bytes32 _EIP712_ORDER_SCHEMA_HASH = 0x5632ff1bdfbe9ca7ecbcb1bd8c61f364e0debfed45fd8be4e459081586292fff;
        bytes32 _EIP712_DOMAIN_HASH = 0xaea25658c273c666156bd427f83a666135fcde6887a6c25fc1cd1562bc4f3f34;

        bytes32 hash;
        assembly {
            let ptr := mload(64)
            mstore(add(ptr,   0), _EIP712_ORDER_SCHEMA_HASH)     // EIP712_ORDER_SCHEMA_HASH
            mstore(add(ptr,  32), mload(add(order, 128)))        // order.amountS
            mstore(add(ptr,  64), mload(add(order, 160)))        // order.amountB
            mstore(add(ptr,  96), mload(add(order, 640)))        // order.feeAmount
            mstore(add(ptr, 128), mload(add(order, 192)))        // order.validSince
            mstore(add(ptr, 160), mload(add(order, 480)))        // order.validUntil
            mstore(add(ptr, 192), mload(add(order,  32)))        // order.owner
            mstore(add(ptr, 224), mload(add(order,  64)))        // order.tokenS
            mstore(add(ptr, 256), mload(add(order,  96)))        // order.tokenB
            mstore(add(ptr, 288), mload(add(order, 288)))        // order.dualAuthAddr
            mstore(add(ptr, 320), mload(add(order, 320)))        // order.broker
            mstore(add(ptr, 352), mload(add(order, 416)))        // order.orderInterceptor
            mstore(add(ptr, 384), mload(add(order, 448)))        // order.wallet
            mstore(add(ptr, 416), mload(add(order, 768)))        // order.tokenRecipient
            mstore(add(ptr, 448), mload(add(order, 608)))        // order.feeToken
            mstore(add(ptr, 480), mload(add(order, 800)))        // order.walletSplitPercentage
            mstore(add(ptr, 512), mload(add(order, 704)))        // order.tokenSFeePercentage
            mstore(add(ptr, 544), mload(add(order, 736)))        // order.tokenBFeePercentage
            mstore(add(ptr, 576), mload(add(order, 576)))        // order.allOrNone
            let message := keccak256(ptr, 608)                   // 19 * 32

            mstore(add(ptr,  0), 0x1901)                         // EIP191_HEADER
            mstore(add(ptr, 32), _EIP712_DOMAIN_HASH)            // EIP712_DOMAIN_HASH
            mstore(add(ptr, 64), message)                        // message
            hash := keccak256(add(ptr, 30), 66)                  // 2 + 32 + 32
        }
        order.hash = hash;
    }

    function updateBrokerAndInterceptor(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        if (order.broker == 0x0) {
            order.broker = order.owner;
        } else {
            bool registered;
            (registered, /*order.brokerInterceptor*/) = ctx.orderBrokerRegistry.getBroker(
                order.owner,
                order.broker
            );
            order.valid = order.valid && registered;
        }
    }

    function check(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        // If the order was already partially filled
        // we don't have to check all of the infos and the signature again
        if(order.filledAmountS == 0) {
            validateAllInfo(order, ctx);
            checkBrokerSignature(order, ctx);
        } else {
            validateUnstableInfo(order, ctx);
        }

        checkP2P(order);
    }

    function validateAllInfo(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        bool valid = true;
        valid = valid && (order.version == 0); // unsupported order version
        valid = valid && (order.owner != 0x0); // invalid order owner
        valid = valid && (order.tokenS != 0x0); // invalid order tokenS
        valid = valid && (order.tokenB != 0x0); // invalid order tokenB
        valid = valid && (order.amountS != 0); // invalid order amountS
        valid = valid && (order.amountB != 0); // invalid order amountB
        valid = valid && (order.feeToken != 0x0); // invalid fee token

        valid = valid && (order.tokenSFeePercentage < ctx.feePercentageBase); // invalid tokenS percentage
        valid = valid && (order.tokenBFeePercentage < ctx.feePercentageBase); // invalid tokenB percentage
        valid = valid && (order.walletSplitPercentage <= 100); // invalid wallet split percentage

        valid = valid && (order.validSince <= now); // order is too early to match

        order.valid = order.valid && valid;

        validateUnstableInfo(order, ctx);
    }


    function validateUnstableInfo(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        bool valid = true;
        valid = valid && (order.validUntil == 0 || order.validUntil > now);  // order is expired
        valid = valid && (order.waiveFeePercentage <= int16(ctx.feePercentageBase)); // invalid waive percentage
        valid = valid && (order.waiveFeePercentage >= -int16(ctx.feePercentageBase)); // invalid waive percentage
        if (order.dualAuthAddr != 0x0) { // if dualAuthAddr exists, dualAuthSig must be exist.
            valid = valid && (order.dualAuthSig.length > 0);
        }
        order.valid = order.valid && valid;
    }


    function checkP2P(
        Data.Order order
        )
        internal
        pure
    {
        order.P2P = (order.tokenSFeePercentage > 0 || order.tokenBFeePercentage > 0);
    }


    function checkBrokerSignature(
        Data.Order order,
        Data.Context ctx
        )
        internal
        view
    {
        if (order.sig.length == 0) {
            bool registered = ctx.orderRegistry.isOrderHashRegistered(
                order.broker,
                order.hash
            );

            if (!registered) {
                order.valid = order.valid && ctx.orderBook.orderSubmitted(order.hash);
            }
        } else {
            order.valid = order.valid && MultihashUtil.verifySignature(
                order.broker,
                order.hash,
                order.sig
            );
        }
    }

    function checkDualAuthSignature(
        Data.Order order,
        bytes32  miningHash
        )
        internal
        pure
    {
        if (order.dualAuthSig.length != 0) {
            order.valid = order.valid && MultihashUtil.verifySignature(
                order.dualAuthAddr,
                miningHash,
                order.dualAuthSig
            );
        }
    }

    function validateAllOrNone(
        Data.Order order
        )
        internal
        pure
    {
        // Check if this order needs to be completely filled
        if(order.allOrNone) {
            order.valid = order.valid && (order.filledAmountS == order.amountS);
        }
    }

    function getSpendableS(
        Data.Order order,
        Data.Context ctx
        )
        internal
        returns (uint)
    {
        return getSpendable(
            ctx.delegate,
            order.tokenS,
            order.owner,
            order.broker,
            order.brokerInterceptor,
            order.tokenSpendableS,
            order.brokerSpendableS
        );
    }

    function getSpendableFee(
        Data.Order order,
        Data.Context ctx
        )
        internal
        returns (uint)
    {
        return getSpendable(
            ctx.delegate,
            order.feeToken,
            order.owner,
            order.broker,
            order.brokerInterceptor,
            order.tokenSpendableFee,
            order.brokerSpendableFee
        );
    }

    function reserveAmountS(
        Data.Order order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved += amount;
        if (order.brokerInterceptor != 0x0) {
            order.brokerSpendableS.reserved += amount;
        }
    }

    function reserveAmountFee(
        Data.Order order,
        uint amount
        )
        internal
        pure
    {
        order.tokenSpendableFee.reserved += amount;
        if (order.brokerInterceptor != 0x0) {
            order.brokerSpendableFee.reserved += amount;
        }
    }

    function resetReservations(
        Data.Order order
        )
        internal
        pure
    {
        order.tokenSpendableS.reserved = 0;
        order.tokenSpendableFee.reserved = 0;
        if (order.brokerInterceptor != 0x0) {
            order.brokerSpendableS.reserved = 0;
            order.brokerSpendableFee.reserved = 0;
        }
    }

    /// @return Amount of ERC20 token that can be spent by this contract.
    function getERC20Spendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address owner
        )
        private
        view
        returns (uint spendable)
    {
        ERC20 token = ERC20(tokenAddress);
        spendable = token.allowance(
            owner,
            address(delegate)
        );
        if (spendable == 0) {
            return;
        }
        uint balance = token.balanceOf(owner);
        spendable = (balance < spendable) ? balance : spendable;
    }

    /// @return Amount of ERC20 token that can be spent by the broker
    function getBrokerAllowance(
        address tokenAddress,
        address owner,
        address broker,
        address brokerInterceptor
        )
        private
        returns (uint allowance)
    {
        allowance = brokerInterceptor.getAllowanceSafe(
            owner,
            broker,
            tokenAddress
        );
    }

    function getSpendable(
        ITradeDelegate delegate,
        address tokenAddress,
        address owner,
        address broker,
        address brokerInterceptor,
        Data.Spendable tokenSpendable,
        Data.Spendable brokerSpendable
        )
        private
        returns (uint spendable)
    {
        if (!tokenSpendable.initialized) {
            tokenSpendable.amount = getERC20Spendable(
                delegate,
                tokenAddress,
                owner
            );
            tokenSpendable.initialized = true;
        }
        spendable = tokenSpendable.amount.sub(tokenSpendable.reserved);
        if (brokerInterceptor != 0x0) {
            if (!brokerSpendable.initialized) {
                brokerSpendable.amount = getBrokerAllowance(
                    tokenAddress,
                    owner,
                    broker,
                    brokerInterceptor
                );
                brokerSpendable.initialized = true;
            }
            uint brokerSpendableAmount = brokerSpendable.amount.sub(brokerSpendable.reserved);
            spendable = (brokerSpendableAmount < spendable) ? brokerSpendableAmount : spendable;
        }
    }
}

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





/// @title IRingSubmitter
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IRingSubmitter {
    uint16  public constant FEE_PERCENTAGE_BASE = 1000;

    /// @dev  Event emitted when a ring was successfully mined
    ///        _ringIndex     The index of the ring
    ///        _ringHash      The hash of the ring
    ///        _feeRecipient  The recipient of the matching fee
    ///        _fills         The info of the orders in the ring stored like:
    ///                       [orderHash, owner, tokenS, amountS, split, feeAmount]
    event RingMined(
        uint            _ringIndex,
        bytes32 indexed _ringHash,
        address indexed _feeRecipient,
        bytes           _fills
    );

    /// @dev   Event emitted when a ring was not successfully mined
    ///         _ringHash  The hash of the ring
    event InvalidRing(
        bytes32 _ringHash
    );

    /// @dev   Submit order-rings for validation and settlement.
    /// @param data Packed data of all rings.
    function submitRings(
        bytes data
        )
        external;
}







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









/// @title ParticipationHelper
/// @author Daniel Wang - <daniel@loopring.org>.
library ParticipationHelper {
    using MathUint for uint;
    using OrderHelper for Data.Order;

    function setMaxFillAmounts(
        Data.Participation p,
        Data.Context ctx
        )
        internal
    {
        uint spendableS = p.order.getSpendableS(ctx);
        uint remainingS = p.order.amountS.sub(p.order.filledAmountS);
        p.fillAmountS = (spendableS < remainingS) ? spendableS : remainingS;

        if (!p.order.P2P) {
            // No need to check the fee balance of the owner if feeToken == tokenB,
            // fillAmountB will be used to pay the fee.
            if (!(p.order.feeToken == p.order.tokenB &&
                  p.order.owner == p.order.tokenRecipient &&
                  p.order.feeAmount <= p.order.amountB)) {
                // Check how much fee needs to be paid. We limit fillAmountS to how much
                // fee the order owner can pay.
                uint feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
                if (feeAmount > 0) {
                    uint spendableFee = p.order.getSpendableFee(ctx);
                    if (p.order.feeToken == p.order.tokenS && p.fillAmountS + feeAmount > spendableS) {
                        assert(spendableFee == spendableS);
                        // Equally divide the available tokens between fillAmountS and feeAmount
                        uint totalAmount = p.order.amountS.add(p.order.feeAmount);
                        p.fillAmountS = spendableS.mul(p.order.amountS) / totalAmount;
                        feeAmount = spendableS.mul(p.order.feeAmount) / totalAmount;
                    } else if (feeAmount > spendableFee) {
                        // Scale down fillAmountS so the available feeAmount is sufficient
                        feeAmount = spendableFee;
                        p.fillAmountS = feeAmount.mul(p.order.amountS) / p.order.feeAmount;
                    }
                }
            }
        }

        p.fillAmountB = p.fillAmountS.mul(p.order.amountB) / p.order.amountS;
    }

    function calculateFees(
        Data.Participation p,
        Data.Participation prevP,
        Data.Context ctx
        )
        internal
        returns (bool)
    {
        if (p.order.P2P) {
            // Calculate P2P fees
            p.feeAmount = 0;
            p.feeAmountS = p.fillAmountS.mul(p.order.tokenSFeePercentage) / ctx.feePercentageBase;
            p.feeAmountB = p.fillAmountB.mul(p.order.tokenBFeePercentage) / ctx.feePercentageBase;
        } else {
            // Calculate matching fees
            p.feeAmount = p.order.feeAmount.mul(p.fillAmountS) / p.order.amountS;
            p.feeAmountS = 0;
            p.feeAmountB = 0;

            // If feeToken == tokenB AND owner == tokenRecipient, try to pay using fillAmountB

            if (p.order.feeToken == p.order.tokenB &&
                p.order.owner == p.order.tokenRecipient &&
                p.fillAmountB >= p.feeAmount) {
                p.feeAmountB = p.feeAmount;
                p.feeAmount = 0;
            }

            if (p.feeAmount > 0) {
                // Make sure we can pay the feeAmount
                uint spendableFee = p.order.getSpendableFee(ctx);
                if (p.feeAmount > spendableFee) {
                    // This normally should not happen, but this is possible when self-trading
                    return false;
                } else {
                    p.order.reserveAmountFee(p.feeAmount);
                }
            }
        }

        if ((p.fillAmountS - p.feeAmountS) >= prevP.fillAmountB) {
            // The miner (or in a P2P case, the taker) gets the margin
            p.splitS = (p.fillAmountS - p.feeAmountS) - prevP.fillAmountB;
            p.fillAmountS = prevP.fillAmountB + p.feeAmountS;
            return true;
        } else {
            return false;
        }
    }

    function adjustOrderState(
        Data.Participation p
        )
        internal
        pure
    {
        // Update filled amount
        p.order.filledAmountS += p.fillAmountS + p.splitS;

        // Update spendables
        uint totalAmountS = p.fillAmountS + p.splitS;
        uint totalAmountFee = p.feeAmount;
        p.order.tokenSpendableS.amount = p.order.tokenSpendableS.amount.sub(totalAmountS);
        p.order.tokenSpendableFee.amount = p.order.tokenSpendableFee.amount.sub(totalAmountFee);
        if (p.order.brokerInterceptor != 0x0) {
            p.order.brokerSpendableS.amount = p.order.brokerSpendableS.amount.sub(totalAmountS);
            p.order.brokerSpendableFee.amount = p.order.brokerSpendableFee.amount.sub(totalAmountFee);
        }
    }

    function revertOrderState(
        Data.Participation p
        )
        internal
        pure
    {
        // Revert filled amount
        p.order.filledAmountS = p.order.filledAmountS.sub(p.fillAmountS + p.splitS);

        // We do not revert any spendables. Rings will not get rebalanced so this doesn't matter.
    }

}



/// @title RingHelper
library RingHelper {
    using MathUint for uint;
    using OrderHelper for Data.Order;
    using ParticipationHelper for Data.Participation;

    using BrokerInterceptorProxy for address;
    function updateHash(
        Data.Ring ring
        )
        internal
        pure
    {
        uint ringSize = ring.size;
        bytes32 hash;
        assembly {
            let data := mload(0x40)
            let ptr := data
            let participations := mload(add(ring, 32))                                  // ring.participations
            for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                let participation := mload(add(participations, add(32, mul(i, 32))))    // participations[i]
                let order := mload(participation)                                       // participation.order

                let waiveFeePercentage := and(mload(add(order, 672)), 0xFFFF)           // order.waiveFeePercentage
                let orderHash := mload(add(order, 864))                                 // order.hash

                mstore(add(ptr, 2), waiveFeePercentage)
                mstore(ptr, orderHash)

                ptr := add(ptr, 34)
            }
            hash := keccak256(data, sub(ptr, data))
        }
        ring.hash = hash;
    }

    function calculateFillAmountAndFee(
        Data.Ring ring,
        Data.Context ctx
        )
        internal
    {
        // Invalid order data could cause a divide by zero in the calculations
        if (!ring.valid) {
            return;
        }

        uint i;
        int j;
        uint prevIndex;

        for (i = 0; i < ring.size; i++) {
            ring.participations[i].setMaxFillAmounts(
                ctx
            );
        }

        uint smallest = 0;
        for (j = int(ring.size) - 1; j >= 0; j--) {
            prevIndex = (uint(j) + ring.size - 1) % ring.size;
            smallest = calculateOrderFillAmounts(
                ctx,
                ring.participations[uint(j)],
                ring.participations[prevIndex],
                uint(j),
                smallest
            );
        }
        for (j = int(ring.size) - 1; j >= int(smallest); j--) {
            prevIndex = (uint(j) + ring.size - 1) % ring.size;
            calculateOrderFillAmounts(
                ctx,
                ring.participations[uint(j)],
                ring.participations[prevIndex],
                uint(j),
                smallest
            );
        }

        // Reserve the total amount tokenS used for all the orders
        // (e.g. the owner of order 0 could use LRC as feeToken in order 0, while
        // the same owner can also sell LRC in order 2).
        for (i = 0; i < ring.size; i++) {
            ring.participations[i].order.reserveAmountS(ring.participations[i].fillAmountS);
        }

        for (i = 0; i < ring.size; i++) {
            prevIndex = (i + ring.size - 1) % ring.size;

            bool valid = ring.participations[i].calculateFees(ring.participations[prevIndex], ctx);
            if (!valid) {
                ring.valid = false;
                break;
            }

            int16 waiveFeePercentage = ring.participations[i].order.waiveFeePercentage;
            if (waiveFeePercentage < 0) {
                ring.minerFeesToOrdersPercentage += uint(-waiveFeePercentage);
            }
        }
        // Miner can only distribute 100% of its fees to all orders combined
        ring.valid = ring.valid && (ring.minerFeesToOrdersPercentage <= ctx.feePercentageBase);

        // Ring calculations are done. Make sure te remove all spendable reservations for this ring
        for (i = 0; i < ring.size; i++) {
            ring.participations[i].order.resetReservations();
        }
    }

    function calculateOrderFillAmounts(
        Data.Context ctx,
        Data.Participation p,
        Data.Participation prevP,
        uint i,
        uint smallest
        )
        internal
        pure
        returns (uint smallest_)
    {
        // Default to the same smallest index
        smallest_ = smallest;

        uint postFeeFillAmountS = p.fillAmountS;
        uint tokenSFeePercentage = p.order.tokenSFeePercentage;
        if (tokenSFeePercentage > 0) {
            uint feeAmountS = p.fillAmountS.mul(tokenSFeePercentage) / ctx.feePercentageBase;
            postFeeFillAmountS = p.fillAmountS - feeAmountS;
        }

        if (prevP.fillAmountB > postFeeFillAmountS) {
            smallest_ = i;
            prevP.fillAmountB = postFeeFillAmountS;
            prevP.fillAmountS = postFeeFillAmountS.mul(prevP.order.amountS) / prevP.order.amountB;
        }
    }

    function checkOrdersValid(
        Data.Ring ring
        )
        internal
        pure
    {
        ring.valid = ring.valid && (ring.size > 1 && ring.size <= 8); // invalid ring size
        for (uint i = 0; i < ring.size; i++) {
            uint prev = (i + ring.size - 1) % ring.size;
            ring.valid = ring.valid && ring.participations[i].order.valid;
            ring.valid = ring.valid && ring.participations[i].order.tokenS == ring.participations[prev].order.tokenB;
        }
    }

    function checkForSubRings(
        Data.Ring ring
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size - 1; i++) {
            address tokenS = ring.participations[i].order.tokenS;
            for (uint j = i + 1; j < ring.size; j++) {
                ring.valid = ring.valid && (tokenS != ring.participations[j].order.tokenS);
            }
        }
    }

    function adjustOrderStates(
        Data.Ring ring
        )
        internal
        pure
    {
        // Adjust the orders
        for (uint i = 0; i < ring.size; i++) {
            ring.participations[i].adjustOrderState();
        }
    }


    function revertOrderStats(
        Data.Ring ring
        )
        internal
        pure
    {
        for (uint i = 0; i < ring.size; i++) {
            ring.participations[i].revertOrderState();
        }
    }

    function doPayments(
        Data.Ring ring,
        Data.Context ctx,
        Data.Mining mining
        )
        internal
    {
        payFees(ring, ctx, mining);
        transferTokens(ring, ctx, mining.feeRecipient);
    }

    function generateFills(
        Data.Ring ring,
        uint destPtr
        )
        internal
        pure
        returns (uint fill)
    {
        uint ringSize = ring.size;
        uint fillSize = 6 * 32;
        assembly {
            fill := destPtr
            let participations := mload(add(ring, 32))                                 // ring.participations

            for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                let participation := mload(add(participations, add(32, mul(i, 32))))   // participations[i]
                let order := mload(participation)                                      // participation.order

                // When !order.P2P and tokenB == feeToken
                // the matching fee can be paid in feeAmountB (and feeAmount == 0)
                let feeAmount := mload(add(participation,  64))                        // participation.feeAmount
                if eq(mload(add(order, 832)), 0) {                                     // order.P2P
                    let feeAmountB := mload(add(participation, 128))                   // participation.feeAmountB
                    feeAmount := add(feeAmount, feeAmountB)
                }

                mstore(add(fill,   0), mload(add(order, 864)))                         // order.hash
                mstore(add(fill,  32), mload(add(order,  32)))                         // order.owner
                mstore(add(fill,  64), mload(add(order,  64)))                         // order.tokenS
                mstore(add(fill,  96), mload(add(participation, 256)))                 // participation.fillAmountS
                mstore(add(fill, 128), mload(add(participation,  32)))                 // participation.splitS
                mstore(add(fill, 160), feeAmount)                                      // feeAmount

                fill := add(fill, fillSize)
            }
        }
    }

    function transferTokens(
        Data.Ring ring,
        Data.Context ctx,
        address feeRecipient
        )
        internal
    {
        for (uint i = 0; i < ring.size; i++) {
            transferTokensForParticipation(
                ctx,
                feeRecipient,
                ring.participations[i],
                ring.participations[(i + ring.size - 1) % ring.size]
            );
        }
    }

    function transferTokensForParticipation(
        Data.Context ctx,
        address feeRecipient,
        Data.Participation p,
        Data.Participation prevP
        )
        internal
        returns (uint)
    {
        uint buyerFeeAmountAfterRebateB = prevP.feeAmountB.sub(prevP.rebateB);

        // If the buyer needs to pay fees in tokenB, the seller needs
        // to send the tokenS amount to the fee holder contract
        uint amountSToBuyer = p.fillAmountS
            .sub(p.feeAmountS)
            .sub(buyerFeeAmountAfterRebateB);

        uint amountSToFeeHolder = p.feeAmountS
            .sub(p.rebateS)
            .add(buyerFeeAmountAfterRebateB);

        uint amountFeeToFeeHolder = p.feeAmount
            .sub(p.rebateFee);

        if (p.order.tokenS == p.order.feeToken) {
            amountSToFeeHolder = amountSToFeeHolder.add(amountFeeToFeeHolder);
            amountFeeToFeeHolder = 0;
        }

        // Transfers
        ctx.transferPtr = addTokenTransfer(
            ctx.transferData,
            ctx.transferPtr,
            p.order.feeToken,
            p.order.owner,
            address(ctx.feeHolder),
            amountFeeToFeeHolder
        );
        ctx.transferPtr = addTokenTransfer(
            ctx.transferData,
            ctx.transferPtr,
            p.order.tokenS,
            p.order.owner,
            address(ctx.feeHolder),
            amountSToFeeHolder
        );
        ctx.transferPtr = addTokenTransfer(
            ctx.transferData,
            ctx.transferPtr,
            p.order.tokenS,
            p.order.owner,
            prevP.order.tokenRecipient,
            amountSToBuyer
        );

        // Miner (or for P2P the taker) gets the margin without sharing it with the wallet or burning
        ctx.transferPtr = addTokenTransfer(
            ctx.transferData,
            ctx.transferPtr,
            p.order.tokenS,
            p.order.owner,
            feeRecipient,
            p.splitS
        );

        // onTokenSpent broker callbacks
        if (p.order.brokerInterceptor != 0x0) {
            onTokenSpent(
                p.order.brokerInterceptor,
                p.order.owner,
                p.order.broker,
                p.order.tokenS,
                amountSToBuyer + amountSToFeeHolder + p.splitS
            );
            onTokenSpent(
                p.order.brokerInterceptor,
                p.order.owner,
                p.order.broker,
                p.order.feeToken,
                amountFeeToFeeHolder
            );
        }
    }

    function addTokenTransfer(
        uint data,
        uint ptr,
        address token,
        address from,
        address to,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount > 0 && from != to) {
            assembly {
                // Try to find an existing fee payment of the same token to the same owner
                let addNew := 1
                for { let p := data } lt(p, ptr) { p := add(p, 128) } {
                    let dataToken := mload(add(p,  0))
                    let dataFrom := mload(add(p, 32))
                    let dataTo := mload(add(p, 64))
                    // if(token == dataToken && from == dataFrom && to == dataTo)
                    if and(and(eq(token, dataToken), eq(from, dataFrom)), eq(to, dataTo)) {
                        let dataAmount := mload(add(p, 96))
                        // dataAmount = amount.add(dataAmount);
                        dataAmount := add(amount, dataAmount)
                        // require(dataAmount >= amount) (safe math)
                        if lt(dataAmount, amount) {
                            revert(0, 0)
                        }
                        mstore(add(p, 96), dataAmount)
                        addNew := 0
                        // End the loop
                        p := ptr
                    }
                }
                // Add a new transfer
                if eq(addNew, 1) {
                    mstore(add(ptr,  0), token)
                    mstore(add(ptr, 32), from)
                    mstore(add(ptr, 64), to)
                    mstore(add(ptr, 96), amount)
                    ptr := add(ptr, 128)
                }
            }
            return ptr;
        } else {
            return ptr;
        }
    }

    function onTokenSpent(
        address brokerInterceptor,
        address owner,
        address broker,
        address token,
        uint    amount
        )
        internal
    {
        if (brokerInterceptor == 0x0 || amount == 0) {
            return;
        } else {
            brokerInterceptor.onTokenSpentSafe(
                owner,
                broker,
                token,
                amount
            );
        }
    }

    function payFees(
        Data.Ring ring,
        Data.Context ctx,
        Data.Mining mining
        )
        internal
        view
    {
        Data.FeeContext memory feeCtx;
        feeCtx.ring = ring;
        feeCtx.ctx = ctx;
        feeCtx.feeRecipient = mining.feeRecipient;
        for (uint i = 0; i < ring.size; i++) {
            payFeesForParticipation(
                feeCtx,
                ring.participations[i]
            );
        }
    }

    function payFeesForParticipation(
        Data.FeeContext feeCtx,
        Data.Participation p
        )
        internal
        view
        returns (uint)
    {
        feeCtx.walletPercentage = p.order.P2P ? 100 : (p.order.wallet == 0x0 ? 0 : p.order.walletSplitPercentage);
        feeCtx.waiveFeePercentage = p.order.waiveFeePercentage;
        feeCtx.owner = p.order.owner;
        feeCtx.wallet = p.order.wallet;
        feeCtx.P2P = p.order.P2P;

        p.rebateFee = payFeesAndBurn(
            feeCtx,
            p.order.feeToken,
            p.feeAmount
        );
        p.rebateS = payFeesAndBurn(
            feeCtx,
            p.order.tokenS,
            p.feeAmountS
        );
        p.rebateB = payFeesAndBurn(
            feeCtx,
            p.order.tokenB,
            p.feeAmountB
        );
    }

    function payFeesAndBurn(
        Data.FeeContext feeCtx,
        address token,
        uint totalAmount
        )
        internal
        view
        returns (uint)
    {
        if (totalAmount == 0) {
            return 0;
        }

        uint amount = totalAmount;
        // No need to pay any fees in a P2P order without a wallet
        // (but the fee amount is a part of amountS of the order, so the fee amount is rebated).
        if (feeCtx.P2P && feeCtx.wallet == 0x0) {
            amount = 0;
        }

        uint feeToWallet = 0;
        uint minerFee = 0;
        uint minerFeeBurn = 0;
        uint walletFeeBurn = 0;
        if (amount > 0) {
            feeToWallet = amount.mul(feeCtx.walletPercentage) / 100;
            minerFee = amount - feeToWallet;

            // Miner can waive fees for this order. If waiveFeePercentage > 0 this is a simple reduction in fees.
            if (feeCtx.waiveFeePercentage > 0) {
                minerFee = minerFee.mul(
                    feeCtx.ctx.feePercentageBase - uint(feeCtx.waiveFeePercentage)) /
                    feeCtx.ctx.feePercentageBase;
            } else if (feeCtx.waiveFeePercentage < 0) {
                // No fees need to be paid by this order
                minerFee = 0;
            }

            uint32 burnRate = getBurnRate(feeCtx, token);
            assert(burnRate <= feeCtx.ctx.feePercentageBase);

            // Miner fee
            minerFeeBurn = minerFee.mul(burnRate) / feeCtx.ctx.feePercentageBase;
            minerFee = minerFee - minerFeeBurn;
            // Wallet fee
            walletFeeBurn = feeToWallet.mul(burnRate) / feeCtx.ctx.feePercentageBase;
            feeToWallet = feeToWallet - walletFeeBurn;

            // Pay the wallet
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                feeCtx.wallet,
                feeToWallet
            );

            // Pay the burn rate with the feeHolder as owner
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                address(feeCtx.ctx.feeHolder),
                minerFeeBurn + walletFeeBurn
            );

            // Fees can be paid out in different tokens so we can't easily accumulate the total fee
            // that needs to be paid out to order owners. So we pay out each part out here to all
            // orders that need it.
            uint feeToMiner = minerFee;
            if (feeCtx.ring.minerFeesToOrdersPercentage > 0 && minerFee > 0) {
                // Pay out the fees to the orders
                distributeMinerFeeToOwners(
                    feeCtx,
                    token,
                    minerFee
                );
                // Subtract all fees the miner pays to the orders
                feeToMiner = minerFee.mul(feeCtx.ctx.feePercentageBase -
                    feeCtx.ring.minerFeesToOrdersPercentage) /
                    feeCtx.ctx.feePercentageBase;
            }

            // Pay the miner
            feeCtx.ctx.feePtr = addFeePayment(
                feeCtx.ctx.feeData,
                feeCtx.ctx.feePtr,
                token,
                feeCtx.feeRecipient,
                feeToMiner
            );
        }

        // Calculate the total fee payment after possible discounts (burn rebate + fee waiving)
        // and return the total rebate
        return totalAmount.sub((feeToWallet + minerFee) + (minerFeeBurn + walletFeeBurn));
    }

    function getBurnRate(
        Data.FeeContext feeCtx,
        address token
        )
        internal
        view
        returns (uint32)
    {
        bytes32[] memory tokenBurnRates = feeCtx.ctx.tokenBurnRates;
        uint length = tokenBurnRates.length;
        for (uint i = 0; i < length; i += 2) {
            if (token == address(tokenBurnRates[i])) {
                uint32 burnRate = uint32(tokenBurnRates[i + 1]);
                return feeCtx.P2P ? (burnRate / 0x10000) : (burnRate & 0xFFFF);
            }
        }
        // Not found, add it to the list
        uint32 burnRate = feeCtx.ctx.burnRateTable.getBurnRate(token);
        assembly {
            let ptr := add(tokenBurnRates, mul(add(1, length), 32))
            mstore(ptr, token)                              // token
            mstore(add(ptr, 32), burnRate)                  // burn rate
            mstore(tokenBurnRates, add(length, 2))          // length
        }
        return feeCtx.P2P ? (burnRate / 0x10000) : (burnRate & 0xFFFF);
    }

    function distributeMinerFeeToOwners(
        Data.FeeContext feeCtx,
        address token,
        uint minerFee
        )
        internal
        pure
    {
        for (uint i = 0; i < feeCtx.ring.size; i++) {
            if (feeCtx.ring.participations[i].order.waiveFeePercentage < 0) {
                uint feeToOwner = minerFee
                    .mul(uint(-feeCtx.ring.participations[i].order.waiveFeePercentage)) / feeCtx.ctx.feePercentageBase;

                feeCtx.ctx.feePtr = addFeePayment(
                    feeCtx.ctx.feeData,
                    feeCtx.ctx.feePtr,
                    token,
                    feeCtx.ring.participations[i].order.owner,
                    feeToOwner);
            }
        }
    }

    function addFeePayment(
        uint data,
        uint ptr,
        address token,
        address owner,
        uint amount
        )
        internal
        pure
        returns (uint)
    {
        if (amount == 0) {
            return ptr;
        } else {
            assembly {
                // Try to find an existing fee payment of the same token to the same owner
                let addNew := 1
                for { let p := data } lt(p, ptr) { p := add(p, 96) } {
                    let dataToken := mload(add(p,  0))
                    let dataOwner := mload(add(p, 32))
                    // if(token == dataToken && owner == dataOwner)
                    if and(eq(token, dataToken), eq(owner, dataOwner)) {
                        let dataAmount := mload(add(p, 64))
                        // dataAmount = amount.add(dataAmount);
                        dataAmount := add(amount, dataAmount)
                        // require(dataAmount >= amount) (safe math)
                        if lt(dataAmount, amount) {
                            revert(0, 0)
                        }
                        mstore(add(p, 64), dataAmount)
                        addNew := 0
                        // End the loop
                        p := ptr
                    }
                }
                // Add a new fee payment
                if eq(addNew, 1) {
                    mstore(add(ptr,  0), token)
                    mstore(add(ptr, 32), owner)
                    mstore(add(ptr, 64), amount)
                    ptr := add(ptr, 96)
                }
            }
            return ptr;
        }
    }

}





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





/// @title IOrderCanceller
/// @author Daniel Wang - <daniel@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
contract IOrderCanceller {

    event OrdersCancelled(
        address indexed _broker,
        bytes32[]       _orderHashes
    );

    event AllOrdersCancelledForTradingPair(
        address indexed _broker,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    event AllOrdersCancelled(
        address indexed _broker,
        uint            _cutoff
    );

    event OrdersCancelledByBroker(
        address indexed _broker,
        address indexed _owner,
        bytes32[]       _orderHashes
    );

    event AllOrdersCancelledForTradingPairByBroker(
        address indexed _broker,
        address indexed _owner,
        address         _token1,
        address         _token2,
        uint            _cutoff
    );

    event AllOrdersCancelledByBroker(
        address indexed _broker,
        address indexed _owner,
        uint            _cutoff
    );

    /// @dev Cancel multiple orders.
    ///      msg.sender needs to be the broker of the orders you want to cancel.
    /// @param orderHashes Hashes of the orders to be cancelled.
    function cancelOrders(
        bytes   orderHashes
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param token1 The first token of the trading pair
    /// @param token2 The second token of the trading pair
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersForTradingPair(
        address token1,
        address token2,
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    ///        msg.sender is the broker of the orders for which the cutoff is set.
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrders(
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp, for a specific trading pair.
    ///        This function can be used by brokers to cancel orders of an owner.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param owner The owner of the orders the broker wants to cancel
    /// @param token1 The first token of the trading pair
    /// @param token2 The second token of the trading pair
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersForTradingPairOfOwner(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external;

    /// @dev   Set a cutoff timestamp to invalidate all orders whose timestamp
    ///        is smaller than or equal to the new value of the address's cutoff
    ///        timestamp.
    ///        This function can be used by brokers to cancel orders of an owner.
    ///        msg.sender needs to be the broker of the orders you want to cancel.
    /// @param owner The owner of the orders the broker wants to cancel
    /// @param cutoff The cutoff timestamp, will default to `block.timestamp`
    ///        if it is 0.
    function cancelAllOrdersOfOwner(
        address owner,
        uint    cutoff
        )
        external;
}







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





/// @title Errors
contract Errors {
    string constant ZERO_VALUE                 = "ZERO_VALUE";
    string constant ZERO_ADDRESS               = "ZERO_ADDRESS";
    string constant INVALID_VALUE              = "INVALID_VALUE";
    string constant INVALID_ADDRESS            = "INVALID_ADDRESS";
    string constant INVALID_SIZE               = "INVALID_SIZE";
    string constant INVALID_SIG                = "INVALID_SIG";
    string constant INVALID_STATE              = "INVALID_STATE";
    string constant NOT_FOUND                  = "NOT_FOUND";
    string constant ALREADY_EXIST              = "ALREADY_EXIST";
    string constant REENTRY                    = "REENTRY";
    string constant UNAUTHORIZED               = "UNAUTHORIZED";
    string constant UNIMPLEMENTED              = "UNIMPLEMENTED";
    string constant UNSUPPORTED                = "UNSUPPORTED";
    string constant TRANSFER_FAILURE           = "TRANSFER_FAILURE";
    string constant WITHDRAWAL_FAILURE         = "WITHDRAWAL_FAILURE";
    string constant BURN_FAILURE               = "BURN_FAILURE";
    string constant BURN_RATE_FROZEN           = "BURN_RATE_FROZEN";
    string constant BURN_RATE_MINIMIZED        = "BURN_RATE_MINIMIZED";
    string constant UNAUTHORIZED_ONCHAIN_ORDER = "UNAUTHORIZED_ONCHAIN_ORDER";
    string constant INVALID_CANDIDATE          = "INVALID_CANDIDATE";
    string constant ALREADY_VOTED              = "ALREADY_VOTED";
    string constant NOT_OWNER                  = "NOT_OWNER";
}



/// @title NoDefaultFunc
/// @dev Disable default functions.
contract NoDefaultFunc is Errors {
    function ()
        external
        payable
    {
        revert(UNSUPPORTED);
    }
}



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








/// @title Deserializes the data passed to submitRings
/// @author Daniel Wang - <daniel@loopring.org>,
library ExchangeDeserializer {
    using BytesUtil     for bytes;

    function deserialize(
        address lrcTokenAddress,
        bytes data
        )
        internal
        view
        returns (
            Data.Mining mining,
            Data.Order[] orders,
            Data.Ring[] rings
        )
    {
        // Read the header
        Data.Header memory header;
        header.version = data.bytesToUint16(0);
        header.numOrders = data.bytesToUint16(2);
        header.numRings = data.bytesToUint16(4);
        header.numSpendables = data.bytesToUint16(6);

        // Validation
        require(header.version == 0, "Unsupported serialization format");
        require(header.numOrders > 0, "Invalid number of orders");
        require(header.numRings > 0, "Invalid number of rings");
        require(header.numSpendables > 0, "Invalid number of spendables");

        // Calculate data pointers
        uint dataPtr;
        assembly {
            dataPtr := data
        }
        uint miningDataPtr = dataPtr + 8;
        uint orderDataPtr = miningDataPtr + 3 * 2;
        uint ringDataPtr = orderDataPtr + (24 * header.numOrders) * 2;
        uint dataBlobPtr = ringDataPtr + (header.numRings * 9) + 32;

        // The data stream needs to be at least large enough for the
        // header/mining/orders/rings data + 64 bytes of zeros in the data blob.
        require(data.length >= (dataBlobPtr - dataPtr) + 32, "Invalid input data");

        // Setup the rings
        mining = setupMiningData(dataBlobPtr, miningDataPtr + 2);
        orders = setupOrders(dataBlobPtr, orderDataPtr + 2, header.numOrders, header.numSpendables, lrcTokenAddress);
        rings = assembleRings(ringDataPtr + 1, header.numRings, orders);
    }

    function setupMiningData(
        uint data,
        uint tablesPtr
        )
        internal
        view
        returns (Data.Mining mining)
    {
        bytes memory emptyBytes = new bytes(0);
        uint offset;

        assembly {
            // Default to transaction origin for feeRecipient
            mstore(add(data, 20), origin)

            // mining.feeRecipient
            offset := mul(and(mload(add(tablesPtr,  0)), 0xFFFF), 4)
            mstore(
                add(mining,   0),
                mload(add(add(data, 20), offset))
            )

            // Restore default to 0
            mstore(add(data, 20), 0)

            // mining.miner
            offset := mul(and(mload(add(tablesPtr,  2)), 0xFFFF), 4)
            mstore(
                add(mining,  32),
                mload(add(add(data, 20), offset))
            )

            // Default to empty bytes array
            mstore(add(data, 32), emptyBytes)

            // mining.sig
            offset := mul(and(mload(add(tablesPtr,  4)), 0xFFFF), 4)
            mstore(
                add(mining, 64),
                add(data, add(offset, 32))
            )

            // Restore default to 0
            mstore(add(data, 32), 0)
        }
    }

    function setupOrders(
        uint data,
        uint tablesPtr,
        uint numOrders,
        uint numSpendables,
        address lrcTokenAddress
        )
        internal
        pure
        returns (Data.Order[] orders)
    {
        bytes memory emptyBytes = new bytes(0);
        uint orderStructSize = 32 * 32;
        // Memory for orders length + numOrders order pointers
        uint arrayDataSize = (1 + numOrders) * 32;
        Data.Spendable[] memory spendableList = new Data.Spendable[](numSpendables);
        uint offset;

        assembly {
            // Allocate memory for all orders
            orders := mload(0x40)
            mstore(add(orders, 0), numOrders)                       // orders.length
            // Reserve the memory for the orders array
            mstore(0x40, add(orders, add(arrayDataSize, mul(orderStructSize, numOrders))))

            for { let i := 0 } lt(i, numOrders) { i := add(i, 1) } {
                let order := add(orders, add(arrayDataSize, mul(orderStructSize, i)))

                // Store the memory location of this order in the orders array
                mstore(add(orders, mul(add(1, i), 32)), order)

                // order.version
                offset := and(mload(add(tablesPtr,  0)), 0xFFFF)
                mstore(
                    add(order,   0),
                    offset
                )

                // order.owner
                offset := mul(and(mload(add(tablesPtr,  2)), 0xFFFF), 4)
                mstore(
                    add(order,  32),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.tokenS
                offset := mul(and(mload(add(tablesPtr,  4)), 0xFFFF), 4)
                mstore(
                    add(order,  64),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.tokenB
                offset := mul(and(mload(add(tablesPtr,  6)), 0xFFFF), 4)
                mstore(
                    add(order,  96),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.amountS
                offset := mul(and(mload(add(tablesPtr,  8)), 0xFFFF), 4)
                mstore(
                    add(order, 128),
                    mload(add(add(data, 32), offset))
                )

                // order.amountB
                offset := mul(and(mload(add(tablesPtr, 10)), 0xFFFF), 4)
                mstore(
                    add(order, 160),
                    mload(add(add(data, 32), offset))
                )

                // order.validSince
                offset := mul(and(mload(add(tablesPtr, 12)), 0xFFFF), 4)
                mstore(
                    add(order, 192),
                    and(mload(add(add(data, 4), offset)), 0xFFFFFFFF)
                )

                // order.tokenSpendableS
                offset := and(mload(add(tablesPtr, 14)), 0xFFFF)
                // Force the spendable index to 0 if it's invalid
                offset := mul(offset, lt(offset, numSpendables))
                mstore(
                    add(order, 224),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // order.tokenSpendableFee
                offset := and(mload(add(tablesPtr, 16)), 0xFFFF)
                // Force the spendable index to 0 if it's invalid
                offset := mul(offset, lt(offset, numSpendables))
                mstore(
                    add(order, 256),
                    mload(add(spendableList, mul(add(offset, 1), 32)))
                )

                // order.dualAuthAddr
                offset := mul(and(mload(add(tablesPtr, 18)), 0xFFFF), 4)
                mstore(
                    add(order, 288),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.broker
                offset := mul(and(mload(add(tablesPtr, 20)), 0xFFFF), 4)
                mstore(
                    add(order, 320),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.orderInterceptor
                offset := mul(and(mload(add(tablesPtr, 22)), 0xFFFF), 4)
                mstore(
                    add(order, 416),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.wallet
                offset := mul(and(mload(add(tablesPtr, 24)), 0xFFFF), 4)
                mstore(
                    add(order, 448),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // order.validUntil
                offset := mul(and(mload(add(tablesPtr, 26)), 0xFFFF), 4)
                mstore(
                    add(order, 480),
                    and(mload(add(add(data,  4), offset)), 0xFFFFFFFF)
                )

                // Default to empty bytes array for value sig and dualAuthSig
                mstore(add(data, 32), emptyBytes)

                // order.sig
                offset := mul(and(mload(add(tablesPtr, 28)), 0xFFFF), 4)
                mstore(
                    add(order, 512),
                    add(data, add(offset, 32))
                )

                // order.dualAuthSig
                offset := mul(and(mload(add(tablesPtr, 30)), 0xFFFF), 4)
                mstore(
                    add(order, 544),
                    add(data, add(offset, 32))
                )

                // Restore default to 0
                mstore(add(data, 32), 0)

                // order.allOrNone
                offset := and(mload(add(tablesPtr, 32)), 0xFFFF)
                mstore(
                    add(order, 576),
                    gt(offset, 0)
                )

                // lrcTokenAddress is the default value for feeToken
                mstore(add(data, 20), lrcTokenAddress)

                // order.feeToken
                offset := mul(and(mload(add(tablesPtr, 34)), 0xFFFF), 4)
                mstore(
                    add(order, 608),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // Restore default to 0
                mstore(add(data, 20), 0)

                // order.feeAmount
                offset := mul(and(mload(add(tablesPtr, 36)), 0xFFFF), 4)
                mstore(
                    add(order, 640),
                    mload(add(add(data, 32), offset))
                )

                // order.waiveFeePercentage
                offset := and(mload(add(tablesPtr, 38)), 0xFFFF)
                mstore(
                    add(order, 672),
                    offset
                )

                // order.tokenSFeePercentage
                offset := and(mload(add(tablesPtr, 40)), 0xFFFF)
                mstore(
                    add(order, 704),
                    offset
                )

                // order.tokenBFeePercentage
                offset := and(mload(add(tablesPtr, 42)), 0xFFFF)
                mstore(
                    add(order, 736),
                    offset
                )

                // The owner is the default value of tokenRecipient
                mstore(add(data, 20), mload(add(order, 32)))                // order.owner

                // order.tokenRecipient
                offset := mul(and(mload(add(tablesPtr, 44)), 0xFFFF), 4)
                mstore(
                    add(order, 768),
                    and(mload(add(add(data, 20), offset)), 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
                )

                // Restore default to 0
                mstore(add(data, 20), 0)

                // order.walletSplitPercentage
                offset := and(mload(add(tablesPtr, 46)), 0xFFFF)
                mstore(
                    add(order, 800),
                    offset
                )

                // Set default  values
                mstore(add(order, 832), 0)         // order.P2P
                mstore(add(order, 864), 0)         // order.hash
                mstore(add(order, 896), 0)         // order.brokerInterceptor
                mstore(add(order, 928), 0)         // order.filledAmountS
                mstore(add(order, 960), 0)         // order.initialFilledAmountS
                mstore(add(order, 992), 1)         // order.valid

                // Advance to the next order
                tablesPtr := add(tablesPtr, 48)
            }
        }
    }

    function assembleRings(
        uint data,
        uint numRings,
        Data.Order[] orders
        )
        internal
        pure
        returns (Data.Ring[] rings)
    {
        uint ringsArrayDataSize = (1 + numRings) * 32;
        uint ringStructSize = 5 * 32;
        uint participationStructSize = 10 * 32;

        assembly {
            // Allocate memory for all rings
            rings := mload(0x40)
            mstore(add(rings, 0), numRings)                      // rings.length
            // Reserve the memory for the rings array
            mstore(0x40, add(rings, add(ringsArrayDataSize, mul(ringStructSize, numRings))))

            for { let r := 0 } lt(r, numRings) { r := add(r, 1) } {
                let ring := add(rings, add(ringsArrayDataSize, mul(ringStructSize, r)))

                // Store the memory location of this ring in the rings array
                mstore(add(rings, mul(add(r, 1), 32)), ring)

                // Get the ring size
                let ringSize := and(mload(data), 0xFF)
                data := add(data, 1)

                // require(ringsSize <= 8)
                if gt(ringSize, 8) {
                    revert(0, 0)
                }

                // Allocate memory for all participations
                let participations := mload(0x40)
                mstore(add(participations, 0), ringSize)         // participations.length
                // Memory for participations length + ringSize participation pointers
                let participationsData := add(participations, mul(add(1, ringSize), 32))
                // Reserve the memory for the participations
                mstore(0x40, add(participationsData, mul(participationStructSize, ringSize)))

                // Initialize ring properties
                mstore(add(ring,   0), ringSize)                 // ring.size
                mstore(add(ring,  32), participations)           // ring.participations
                mstore(add(ring,  64), 0)                        // ring.hash
                mstore(add(ring,  96), 0)                        // ring.minerFeesToOrdersPercentage
                mstore(add(ring, 128), 1)                        // ring.valid

                for { let i := 0 } lt(i, ringSize) { i := add(i, 1) } {
                    let participation := add(participationsData, mul(participationStructSize, i))

                    // Store the memory location of this participation in the participations array
                    mstore(add(participations, mul(add(i, 1), 32)), participation)

                    // Get the order index
                    let orderIndex := and(mload(data), 0xFF)
                    // require(orderIndex < orders.length)
                    if iszero(lt(orderIndex, mload(orders))) {
                        revert(0, 0)
                    }
                    data := add(data, 1)

                    // participation.order
                    mstore(
                        add(participation,   0),
                        mload(add(orders, mul(add(orderIndex, 1), 32)))
                    )

                    // Set default values
                    mstore(add(participation,  32), 0)          // participation.splitS
                    mstore(add(participation,  64), 0)          // participation.feeAmount
                    mstore(add(participation,  96), 0)          // participation.feeAmountS
                    mstore(add(participation, 128), 0)          // participation.feeAmountB
                    mstore(add(participation, 160), 0)          // participation.rebateFee
                    mstore(add(participation, 192), 0)          // participation.rebateS
                    mstore(add(participation, 224), 0)          // participation.rebateB
                    mstore(add(participation, 256), 0)          // participation.fillAmountS
                    mstore(add(participation, 288), 0)          // participation.fillAmountB
                }

                // Advance to the next ring
                data := add(data, sub(8, ringSize))
            }
        }
    }
}



/// @title An Implementation of IExchange.
/// @author Daniel Wang - <daniel@loopring.org>,
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Brechtpd - <brecht@loopring.org>
/// Recognized contributing developers from the community:
///     https://github.com/rainydio
///     https://github.com/BenjaminPrice
///     https://github.com/jonasshen
///     https://github.com/Hephyrius
contract OrderCanceller is IOrderCanceller, NoDefaultFunc {
    using BytesUtil       for bytes;

    address public delegateAddress = 0x16aF305ece469CEA464722B65604a8a113aD9822;

    /* constructor( */
    /*     address _delegateAddress */
    /*     ) */
    /*     public */
    /* { */
    /*     require(_delegateAddress != 0x0, ZERO_ADDRESS); */

    /*     delegateAddress = _delegateAddress; */
    /* } */

    function cancelOrders(
        bytes   orderHashes
        )
        external
    {
        uint size = orderHashes.length;
        require(size > 0 && size % 32 == 0, INVALID_SIZE);

        size /= 32;
        bytes32[] memory hashes = new bytes32[](size);

        ITradeDelegate delegate = ITradeDelegate(delegateAddress);

        for (uint i = 0; i < size; i++) {
            hashes[i] = orderHashes.bytesToBytes32(i * 32);
            delegate.setCancelled(msg.sender, hashes[i]);
        }

        emit OrdersCancelled(
            msg.sender,
            hashes
        );
    }

    function cancelAllOrdersForTradingPair(
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffs(
            msg.sender,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPair(
            msg.sender,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrders(
        uint   cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffs(msg.sender, t);

        emit AllOrdersCancelled(
            msg.sender,
            t
        );
    }

    function cancelAllOrdersForTradingPairOfOwner(
        address owner,
        address token1,
        address token2,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        bytes20 tokenPair = bytes20(token1) ^ bytes20(token2);

        ITradeDelegate(delegateAddress).setTradingPairCutoffsOfOwner(
            msg.sender,
            owner,
            tokenPair,
            t
        );

        emit AllOrdersCancelledForTradingPairByBroker(
            msg.sender,
            owner,
            token1,
            token2,
            t
        );
    }

    function cancelAllOrdersOfOwner(
        address owner,
        uint    cutoff
        )
        external
    {
        uint t = (cutoff == 0) ? block.timestamp : cutoff;

        ITradeDelegate(delegateAddress).setCutoffsOfOwner(
            msg.sender,
            owner,
            t
        );

        emit AllOrdersCancelledByBroker(
            msg.sender,
            owner,
            t
        );
    }

}
