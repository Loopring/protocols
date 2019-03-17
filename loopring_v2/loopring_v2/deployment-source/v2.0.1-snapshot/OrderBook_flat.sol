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



/// @title An Implementation of IOrderbook.
/// @author Daniel Wang - <daniel@loopring.org>.
/// @author Kongliang Zhong - <kongliang@loopring.org>.
contract OrderBook is IOrderBook, NoDefaultFunc {
    using OrderHelper     for Data.Order;
    using BytesUtil       for bytes;

    function submitOrder(
        bytes data
        )
        external
        returns (bytes32)
    {
        require(data.length == 17 * 32, INVALID_SIZE);

        Data.Order memory order = Data.Order(
            0,                                                      // version
            address(data.bytesToUint(0 * 32)),                      // owner
            address(data.bytesToUint(1 * 32)),                      // tokenS
            address(data.bytesToUint(2 * 32)),                      // tokenB
            data.bytesToUint(3 * 32),                               // amountS
            data.bytesToUint(4 * 32),                               // amountB
            data.bytesToUint(5 * 32),                               // validSince
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            0x0,
            address(data.bytesToUint(6 * 32)),                      // broker
            Data.Spendable(true, 0, 0),
            Data.Spendable(true, 0, 0),
            address(data.bytesToUint(7 * 32)),                      // orderInterceptor
            address(data.bytesToUint(8 * 32)),                      // wallet
            uint(data.bytesToUint(9 * 32)),                         // validUtil
            new bytes(0),
            new bytes(0),
            bool(data.bytesToUint(10 * 32) > 0),                    // allOrNone
            address(data.bytesToUint(11 * 32)),                     // feeToken
            data.bytesToUint(12 * 32),                              // feeAmount
            0,
            uint16(data.bytesToUint(13 * 32)),                      // tokenSFeePercentage
            uint16(data.bytesToUint(14 * 32)),                      // tokenBFeePercentage
            address(data.bytesToUint(15 * 32)),                     // tokenRecipient
            uint16(data.bytesToUint(16 * 32)),                      // walletSplitPercentage
            false,
            bytes32(0x0),
            0x0,
            0,
            0,
            true
        );

        /// msg.sender must be order's owner or broker.
        /// no need to check order's broker is registered here. it will be checked during
        /// ring settlement.
        require(
            msg.sender == order.owner || msg.sender == order.broker,
            UNAUTHORIZED_ONCHAIN_ORDER
        );

        // Calculate the order hash
        order.updateHash();

        // Register the hash
        require(!orderSubmitted[order.hash], ALREADY_EXIST);
        orderSubmitted[order.hash] = true;

        // Broadcast the order data
        emit OrderSubmitted(order.hash, data);

        return order.hash;
    }

}
