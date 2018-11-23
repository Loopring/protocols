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



/// @title A public library for deserializing loopring submitRings params.
/// @author Daniel Wang - <daniel@loopring.org>,
library PublicExchangeDeserializer {

    address public constant LRC_TOKEN_ADDRESS = 0xEF68e7C694F40c8202821eDF525dE3782458639f;

    function deserialize(
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
        (
            mining,
            orders,
            rings
        ) = ExchangeDeserializer.deserialize(LRC_TOKEN_ADDRESS, data);
    }
}
