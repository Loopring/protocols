/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */
pragma solidity 0.4.24;

/// @title New LRC Token Contract
/// @dev This token contract's goal is to give a new lrc token implementation
///  of ERC777 with ERC20 compatiblity using the base ERC777 and ERC20
///  implementations provided with the erc777 package.

import { ERC777ERC20BaseToken } from "./ERC777ERC20BaseToken.sol";
import { Ownable } from "./Ownable.sol";

contract NewLRCToken is ERC777ERC20BaseToken, Ownable {

    constructor(
        string _name,
        string _symbol,
        uint256 _granularity,
        uint256 _totalSupply,
        address[] _defaultOperators,
        address _erc820RegistryAddress
    ) public
        ERC777ERC20BaseToken(
            _name,
            _symbol,
            _granularity,
            _totalSupply,
            _defaultOperators,
            _erc820RegistryAddress
        )
    {
        mBalances[msg.sender] = _totalSupply;
    }

    /// @notice Disables the ERC20 interface. This function can only be called
    ///  by the owner.
    function disableERC20() public onlyOwner {
        mErc20compatible = false;
        setInterfaceImplementation("ERC20Token", 0x0);
    }

    /// @notice Re enables the ERC20 interface. This function can only be called
    ///  by the owner.
    function enableERC20() public onlyOwner {
        mErc20compatible = true;
        setInterfaceImplementation("ERC20Token", this);
    }

    function ()
        payable
        public
        {
            revert();
        }
}
