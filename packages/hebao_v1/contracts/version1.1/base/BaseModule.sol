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

import "../../iface/Module.sol";
import "../../iface/Wallet.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../ControllerImpl.sol";


/// @title BaseModule
/// @dev This contract implements some common functions that are likely
///      be useful for all modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts
abstract contract BaseModule is ReentrancyGuard, Module
{
    using MathUint for uint;

    event Activated   (address indexed wallet);
    event Deactivated (address indexed wallet);

    function logicalSender()
        internal
        virtual
        returns(address payable)
    {
        return msg.sender;
    }

    modifier onlyFromWalletOrOwner(address wallet)
        virtual
    {
        address payable _logicalSender = logicalSender();
        require(
            _logicalSender == wallet || _logicalSender == Wallet(wallet).owner(),
            "NOT_FROM_WALLET");
        _;
    }

    modifier onlyWalletOwner(address wallet, address addr)
        virtual
    {
        require(Wallet(wallet).owner() == addr, "NOT_WALLET_OWNER");
        _;
    }

    modifier notWalletOwner(address wallet, address addr)
        virtual
    {
        require(Wallet(wallet).owner() != addr, "IS_WALLET_OWNER");
        _;
    }

    ControllerImpl public controller;

    constructor(ControllerImpl _controller)
        public
    {
        controller = _controller;
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function activate()
        external
        override
        virtual
    {
        address wallet = logicalSender();
        bindMethods(wallet);
        emit Activated(wallet);
    }

    /// @dev This method will cause an re-entry to the same module contract.
    function deactivate()
        external
        override
        virtual
    {
        address wallet = logicalSender();
        unbindMethods(wallet);
        emit Deactivated(wallet);
    }

    ///.@dev Gets the list of methods for binding to wallets.
    ///      Sub-contracts should override this method to provide methods for
    ///      wallet binding.
    /// @return methods A list of method selectors for binding to the wallet
    ///         when this module is activated for the wallet.
    function bindableMethods()
        public
        pure
        virtual
        returns (bytes4[] memory methods)
    {
    }

    // ===== internal & private methods =====

    /// @dev Binds all methods to the given wallet.
    function bindMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = bindableMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindMethod(methods[i], address(this));
        }
    }

    /// @dev Unbinds all methods from the given wallet.
    function unbindMethods(address wallet)
        internal
    {
        Wallet w = Wallet(wallet);
        bytes4[] memory methods = bindableMethods();
        for (uint i = 0; i < methods.length; i++) {
            w.bindMethod(methods[i], address(0));
        }
    }

    function transactCall(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(1), to, value, data);
    }

    // Special case for transactCall to support transfers on "bad" ERC20 tokens
    function transactTokenTransfer(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        internal
        returns (bool success)
    {
        bytes memory txData = abi.encodeWithSelector(
            ERC20(0).transfer.selector,
            to,
            amount
        );
        bytes memory returnData = transactCall(wallet, token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        if (returnData.length > 0) {
            success = abi.decode(returnData, (bool));
        } else {
            // If there is no return value then a failure would have resulted in a revert
            success = true;
        }
    }

    // Special case for transactCall to support approvals on "bad" ERC20 tokens
    function transactTokenApprove(
        address wallet,
        address token,
        address spender,
        uint    amount
        )
        internal
        returns (bool success)
    {
        bytes memory txData = abi.encodeWithSelector(
            ERC20(0).approve.selector,
            spender,
            amount
        );
        bytes memory returnData = transactCall(wallet, token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        if (returnData.length > 0) {
            success = abi.decode(returnData, (bool));
        } else {
            // If there is no return value then a failure would have resulted in a revert
            success = true;
        }
    }

    function transactDelegateCall(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(2), to, value, data);
    }

    function transactStaticCall(
        address wallet,
        address to,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(3), to, 0, data);
    }


    function reimburseGasFee(
        address     wallet,
        address     recipient,
        address     gasToken,
        uint        gasPrice,
        uint        gasAmount
        )
        internal
    {
        uint gasCost = gasAmount.mul(gasPrice);
        uint value = controller.priceOracle().tokenValue(gasToken, gasCost);
        if (value > 0) {
          controller.quotaStore().checkAndAddToSpent(wallet, value);
        }

        if (gasToken == address(0)) {
            transactCall(wallet, recipient, gasCost, "");
        } else {
            require(
                transactTokenTransfer(wallet, gasToken, recipient, gasCost),
                "TRANSFER_FAILED"
            );
        }
    }
}
