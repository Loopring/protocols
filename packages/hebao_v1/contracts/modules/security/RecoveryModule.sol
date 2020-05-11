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
pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "./SecurityModule.sol";
import "./GuardianUtils.sol";


/// @title RecoveryModule
contract RecoveryModule is SecurityModule
{
    event Recovered(
        address indexed wallet,
        address indexed oldOwner,
        address indexed newOwner
    );

    constructor(Controller _controller)
        public
        SecurityModule(_controller)
    {
    }

    /// @dev Recover a wallet by setting a new owner.
    /// @param wallet The wallet for which the recovery shall be cancelled.
    /// @param newOwner The new owner address to set.
    /// @param signers A list of addresses that signed the meta transaction.
    ///        The addresses must be sorted ascendently.
    function recover(
        address            wallet,
        address[] calldata signers,
        address            newOwner
        )
        external
        nonReentrant(this.recover.selector)
        notWalletOwner(wallet, newOwner)
        onlyFromMetaTxWithMajority(
            wallet,
            signers,
            GuardianUtils.SigRequirement.OwnerNotAllowed
        )
    {
        Wallet w = Wallet(wallet);
        address oldOwner = w.owner();
        require(newOwner != oldOwner, "SAME_ADDRESS");
        require(newOwner != address(0), "ZERO_ADDRESS");

        w.setOwner(newOwner);
        emit Recovered(wallet, oldOwner, newOwner);
    }

    function extractMetaTxSigners(
        address /*wallet*/,
        bytes4  method,
        bytes   memory data
        )
        internal
        view
        override
        returns (address[] memory signers)
    {
        require (method == this.recover.selector, "INVALID_METHOD");
        return extractAddressesFromCallData(data, 1);
    }
}
