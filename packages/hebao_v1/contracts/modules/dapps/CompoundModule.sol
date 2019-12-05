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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../../base/BaseSubAccount.sol";
import "../../thirdparty/compound/CompoundRegistery.sol";
import "../../thirdparty/compound/CEther.sol";
import "../../thirdparty/compound/CErc20.sol";

import "../security/SecurityModule.sol";


/// @title CompoundModule
contract CompoundModule is BaseSubAccount, SecurityModule
{
    CompoundRegistry internal compoundRegistry;
    address constant internal ETH_TOKEN_ADDRESS = address(0);

    constructor(
        Controller       _controller,
        CompoundRegistry _compoundRegistry
    )
        public
        SecurityModule(_controller)
    {
        compoundRegistry = _compoundRegistry;
    }

    /// @dev Fund Compound for earn interests and automatically enters market
    ///      so the funds will be used as collateral; or return borrowed assets
    ///      back to Compound.
    function deposit(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        uint allowed = tokenDepositable(wallet, token);
        require(amount > 0 && amount <= allowed, "INVALID_AMOUNT");

        address cToken = compoundRegistry.getCToken(token);
        require(cToken != address(0), "NO_MARKET");

        mint(wallet, cToken, token, amount);
        trackDeposit(wallet, token, amount);
    }

    /// @dev Redeem fund from Compound.
    function withdraw(
        address            wallet,
        address[] calldata signers,
        address            token,
        uint               amount
        )
        external
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
    {
        // TODO: enable signers later
        require(signers.length == 0, "NOT_SUPPORT_NOW");

        address cToken = compoundRegistry.getCToken(token);
        require(cToken != address(0), "NO_MARKET");

        uint balance = uint(tokenBalance(wallet, token));
        require(amount > 0 && amount <= balance, "INVALID_WITHDRAW_AMOUNT");

        redeem(wallet, cToken, amount);
        trackWithdrawal(wallet, token, amount);
    }

    function tokenBalance (
        address wallet,
        address token
    )
        public
        view
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken != address(0)) {
            return 0;
        }

        uint amount = CToken(cToken).balanceOf(wallet);
        uint exchangeRateMantissa = CToken(cToken).exchangeRateStored();
        uint tokenValue = amount.mul(exchangeRateMantissa) / (10 ** 18);
        return int(tokenValue);
    }

    function tokenInterestRate(
        address /* wallet */,
        address token,
        uint    /* amount */,
        bool    loan
    )
        public
        view
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken != address(0)) {
            return 0;
        }

        if (loan) {
            return - int(CToken(cToken).borrowRatePerBlock());
        } else {
            return int(CToken(cToken).supplyRatePerBlock());
        }
    }

    /// internal functions for invest
    function mint(
        address _wallet,
        address _cToken,
        address _token,
        uint    _amount
    )
        internal
    {
        if(_token == ETH_TOKEN_ADDRESS) {
            transactCall(_wallet, _cToken, _amount, abi.encodeWithSelector(CEther(0).mint.selector));
        } else {
            transactCall(_wallet, _token, 0, abi. encodeWithSelector(ERC20(0).approve.selector, _cToken, _amount));
            transactCall(_wallet, _cToken, 0, abi. encodeWithSelector(CErc20(0).mint.selector, _amount));
        }
    }

    function redeem(
        address _wallet,
        address _cToken,
        uint    _amount
    )
        internal
    {
        // CErc20 and CEther have same function signature
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("redeemUnderlying(uint256)", _amount));
    }
}
