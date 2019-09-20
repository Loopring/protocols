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

import "../iface/IFeeHolder.sol";
import "../iface/ITradeDelegate.sol";
import "../lib/Claimable.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @author Kongliang Zhong - <kongliang@loopring.org>
contract FeeHolder is IFeeHolder, NoDefaultFunc {
    using MathUint for uint;
    using ERC20SafeTransfer for address;

    address public delegateAddress = address(0x0);

    constructor(address _delegateAddress) public {
        require(_delegateAddress != address(0x0), ZERO_ADDRESS);
        delegateAddress = _delegateAddress;
    }

    modifier onlyAuthorized() {
        ITradeDelegate delegate = ITradeDelegate(delegateAddress);
        bool isAuthorized = delegate.isAddressAuthorized(msg.sender);
        require(isAuthorized, UNAUTHORIZED);
        _;
    }

    function batchAddFeeBalances(bytes32[] calldata batch)
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
        return withdraw(token, address(this), msg.sender, value);
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
