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

    address private mBurnOperator;

    constructor(
        string _name,
        string _symbol,
        uint256 _granularity,
        uint256 _totalSupply,
        address[] _defaultOperators,
        address _erc820RegistryAddress,
        address _burnOperator
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
        mBurnOperator = _burnOperator;
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

    /// @notice Burns `_amount` tokens from `_tokenHolder`
    ///  Silly example of overriding the `burn` function to only let the owner burn its tokens.
    ///  Do not forget to override the `burn` function in your token contract if you want to prevent users from
    ///  burning their tokens.
    /// @param _amount The quantity of tokens to burn
    function burn(uint256 _amount, bytes _holderData) public onlyOwner {
        super.burn(_amount, _holderData);
    }

    /// @notice Burns `_amount` tokens from `_tokenHolder` by `_operator`
    ///  Silly example of overriding the `operatorBurn` function to only let a specific operator burn tokens.
    ///  Do not forget to override the `operatorBurn` function in your token contract if you want to prevent users from
    ///  burning their tokens.
    /// @param _tokenHolder The address that will lose the tokens
    /// @param _amount The quantity of tokens to burn
    function operatorBurn(address _tokenHolder, uint256 _amount, bytes _holderData, bytes _operatorData) public {
        require(msg.sender == mBurnOperator);
        super.operatorBurn(_tokenHolder, _amount, _holderData, _operatorData);
    }

    function ()
        payable
        public
        {
            revert();
        }
}
