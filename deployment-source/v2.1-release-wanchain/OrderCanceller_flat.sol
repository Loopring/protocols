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
        bytes calldata orderHashes
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



/// @title ITradeHistory
/// @dev Stores the trade history and cancelled data of orders
/// @author Brecht Devos - <brecht@loopring.org>.
contract ITradeHistory {

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


    function batchUpdateFilled(
        bytes32[] calldata filledInfo
        )
        external;

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
        bytes32[] calldata orderInfo
        )
        external
        view
        returns (uint[] memory fills);


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

    function isAddressAuthorized(
        address addr
        )
        public
        view
        returns (bool);


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



/// @title Utility Functions for bytes
/// @author Daniel Wang - <daniel@loopring.org>
library BytesUtil {
    function bytesToBytes32(
        bytes memory b,
        uint offset
        )
        internal
        pure
        returns (bytes32)
    {
        return bytes32(bytesToUintX(b, offset, 32));
    }

    function bytesToUint(
        bytes memory b,
        uint offset
        )
        internal
        pure
        returns (uint)
    {
        return bytesToUintX(b, offset, 32);
    }

    function bytesToAddress(
        bytes memory b,
        uint offset
        )
        internal
        pure
        returns (address)
    {
        return address(bytesToUintX(b, offset, 20) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
    }

    function bytesToUint16(
        bytes memory b,
        uint offset
        )
        internal
        pure
        returns (uint16)
    {
        return uint16(bytesToUintX(b, offset, 2) & 0xFFFF);
    }

    function bytesToUintX(
        bytes memory b,
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

    function subBytes(
        bytes memory b,
        uint offset
        )
        internal
        pure
        returns (bytes memory data)
    {
        require(b.length >= offset + 32, "INVALID_SIZE");
        assembly {
            data := add(add(b, 32), offset)
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

    address public constant tradeHistoryAddress = 0x7D9A78a8d9F3c6BeE71079eB6d58aCeb0C863318;

    /* constructor( */
    /*     address _tradeHistoryAddress */
    /*     ) */
    /*     public */
    /* { */
    /*     require(_tradeHistoryAddress != address(0x0), ZERO_ADDRESS); */

    /*     tradeHistoryAddress = _tradeHistoryAddress; */
    /* } */

    function cancelOrders(
        bytes calldata orderHashes
        )
        external
    {
        uint size = orderHashes.length;
        require(size > 0 && size % 32 == 0, INVALID_SIZE);

        size /= 32;
        bytes32[] memory hashes = new bytes32[](size);

        ITradeHistory tradeHistory = ITradeHistory(tradeHistoryAddress);

        for (uint i = 0; i < size; i++) {
            hashes[i] = orderHashes.bytesToBytes32(i * 32);
            tradeHistory.setCancelled(msg.sender, hashes[i]);
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

        ITradeHistory(tradeHistoryAddress).setTradingPairCutoffs(
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

        ITradeHistory(tradeHistoryAddress).setCutoffs(msg.sender, t);

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

        ITradeHistory(tradeHistoryAddress).setTradingPairCutoffsOfOwner(
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

        ITradeHistory(tradeHistoryAddress).setCutoffsOfOwner(
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
