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





/// @title Ownable
/// @dev The Ownable contract has an owner address, and provides basic
///      authorization control functions, this simplifies the implementation of
///      "user permissions".
contract Ownable {
    address public owner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @dev The Ownable constructor sets the original `owner` of the contract
    ///      to the sender.
    constructor()
        public
    {
        owner = msg.sender;
    }

    /// @dev Throws if called by any account other than the owner.
    modifier onlyOwner()
    {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    /// @dev Allows the current owner to transfer control of the contract to a
    ///      newOwner.
    /// @param newOwner The address to transfer ownership to.
    function transferOwnership(
        address newOwner
        )
        public
        onlyOwner
    {
        require(newOwner != 0x0, "ZERO_ADDRESS");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}



/// @title Claimable
/// @dev Extension for the Ownable contract, where the ownership needs
///      to be claimed. This allows the new owner to accept the transfer.
contract Claimable is Ownable {
    address public pendingOwner;

    /// @dev Modifier throws if called by any account other than the pendingOwner.
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner, "UNAUTHORIZED");
        _;
    }

    /// @dev Allows the current owner to set the pendingOwner address.
    /// @param newOwner The address to transfer ownership to.
    function transferOwnership(
        address newOwner
        )
        public
        onlyOwner
    {
        require(newOwner != 0x0 && newOwner != owner, "INVALID_ADDRESS");
        pendingOwner = newOwner;
    }

    /// @dev Allows the pendingOwner address to finalize the transfer.
    function claimOwnership()
        public
        onlyPendingOwner
    {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = 0x0;
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





/// @title ERC20 safe transfer
/// @dev see https://github.com/sec-bit/badERC20Fix
/// @author Brecht Devos - <brecht@loopring.org>
library ERC20SafeTransfer {

    function safeTransfer(
        address token,
        address to,
        uint256 value)
        internal
        returns (bool success)
    {
        // A transfer is successful when 'call' is successful and depending on the token:
        // - No value is returned: we assume a revert when the transfer failed (i.e. 'call' returns false)
        // - A single boolean is returned: this boolean needs to be true (non-zero)

        // bytes4(keccak256("transfer(address,uint256)")) = 0xa9059cbb
        success = token.call(0xa9059cbb, to, value);
        return checkReturnValue(success);
    }

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 value)
        internal
        returns (bool success)
    {
        // A transferFrom is successful when 'call' is successful and depending on the token:
        // - No value is returned: we assume a revert when the transfer failed (i.e. 'call' returns false)
        // - A single boolean is returned: this boolean needs to be true (non-zero)

        // bytes4(keccak256("transferFrom(address,address,uint256)")) = 0x23b872dd
        success = token.call(0x23b872dd, from, to, value);
        return checkReturnValue(success);
    }

    function checkReturnValue(
        bool success
        )
        internal
        pure
        returns (bool)
    {
        // A transfer/transferFrom is successful when 'call' is successful and depending on the token:
        // - No value is returned: we assume a revert when the transfer failed (i.e. 'call' returns false)
        // - A single boolean is returned: this boolean needs to be true (non-zero)
        if (success) {
            assembly {
                switch returndatasize()
                // Non-standard ERC20: nothing is returned so if 'call' was successful we assume the transfer succeeded
                case 0 {
                    success := 1
                }
                // Standard ERC20: a single boolean value is returned which needs to be true
                case 32 {
                    returndatacopy(0, 0, 32)
                    success := mload(0)
                }
                // None of the above: not successful
                default {
                    success := 0
                }
            }
        }
        return success;
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



/// @author Kongliang Zhong - <kongliang@loopring.org>
contract FeeHolder is IFeeHolder, NoDefaultFunc {
    using MathUint for uint;
    using ERC20SafeTransfer for address;

    address public delegateAddress = 0x16aF305ece469CEA464722B65604a8a113aD9822;

    /* constructor(address _delegateAddress) public { */
    /*     require(_delegateAddress != 0x0, ZERO_ADDRESS); */
    /*     delegateAddress = _delegateAddress; */
    /* } */

    modifier onlyAuthorized() {
        ITradeDelegate delegate = ITradeDelegate(delegateAddress);
        bool isAuthorized = delegate.isAddressAuthorized(msg.sender);
        require(isAuthorized, UNAUTHORIZED);
        _;
    }

    function batchAddFeeBalances(bytes32[] batch)
        external
        onlyAuthorized
    {
        uint length = batch.length;
        require(length % 3 == 0, INVALID_SIZE);

        address token;
        address owner;
        uint value;
        uint start = 68;
        uint end = start + length * 32;
        for (uint p = start; p < end; p += 96) {
            assembly {
                token := calldataload(add(p,  0))
                owner := calldataload(add(p, 32))
                value := calldataload(add(p, 64))
            }
            feeBalances[token][owner] = feeBalances[token][owner].add(value);
        }
    }

    function withdrawBurned(address token, uint value)
        external
        onlyAuthorized
        returns (bool)
    {
        return withdraw(token, this, msg.sender, value);
    }

    function withdrawToken(address token, uint value)
        external
        returns (bool)
    {
        return withdraw(token, msg.sender, msg.sender, value);
    }

    function withdraw(address token, address from, address to, uint value)
        internal
        returns (bool success)
    {
        require(feeBalances[token][from] >= value, INVALID_VALUE);
        feeBalances[token][from] = feeBalances[token][from].sub(value);
        // Token transfer needs to be done after the state changes to prevent a reentrancy attack
        success = token.safeTransfer(to, value);
        require(success, TRANSFER_FAILURE);
        emit TokenWithdrawn(from, token, value);
    }

}
