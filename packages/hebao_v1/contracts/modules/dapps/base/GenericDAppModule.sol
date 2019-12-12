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
pragma solidity ^0.5.13;
pragma experimental ABIEncoderV2;

import "../../../thirdparty/BytesUtil.sol";

import "../../security/SecurityModule.sol";


/// @title GenericDAppModule
/// @dev GenericDAppModule allows wallet owners to transact directly or through meta
///      transactions on the specified dApp. The transaction data must be appended
///      with the wallet address.
contract GenericDAppModule is SecurityModule
{
    using BytesUtil for bytes;

    address public _dapp;
    string  public _name;

    constructor(
        Controller    _controller,
        address       dapp,
        string memory name
        )
        public
        SecurityModule(_controller)
    {
        require(
            dapp != address(0) &&
            !controller.moduleRegistry().isModuleRegistered(dapp) &&
            !controller.walletRegistry().isWalletRegistered(dapp),
            "INVALID_DAPP"
        );
        _dapp = dapp;
        _name = name;
    }

    modifier onlyApprovedDapp(address addr)
    {
        require(addr == _dapp, "DAPP_NOT_APPROVED");
        _;
    }

    function callDApp(
        address          wallet,
        address          dapp,
        uint             value,
        bytes   calldata data
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        onlyApprovedDapp(dapp)
    {
        transactCall(wallet, dapp, value, data);
    }

    function approveERC20(
        address wallet,
        address dapp,
        address token,
        uint    amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        onlyApprovedDapp(dapp)
    {
        approveERC20Internal(wallet, dapp, token, amount);
    }

    function approveAndCallDApp(
        address          wallet,
        address          dapp,
        address          token,
        uint             approvedAmount,
        uint             value,
        bytes   calldata data
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        onlyWhenWalletUnlocked(wallet)
        onlyApprovedDapp(dapp)
    {
        approveERC20Internal(wallet, dapp, token, approvedAmount);
        transactCall(wallet, dapp, value, data);
    }

    function approveERC20Internal(
        address wallet,
        address dapp,
        address token,
        uint    amount
        )
        internal
        nonReentrant
    {
        bytes memory txData = abi.encodeWithSelector(
            ERC20(token).approve.selector,
            dapp,
            amount
        );
        transactCall(wallet, token, 0, txData);
    }

    function extractMetaTxSigners(
        address wallet,
        bytes4  /* method */,
        bytes   memory /* data */
        )
        internal
        view
        returns (address[] memory signers)
    {
        signers = new address[](1);
        signers[0] = Wallet(wallet).owner();
    }
}
