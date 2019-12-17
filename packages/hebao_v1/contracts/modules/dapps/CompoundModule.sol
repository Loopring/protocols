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

import "../../base/BaseSubAccount.sol";

import "../../thirdparty/compound/CompoundRegistery.sol";
import "../../thirdparty/compound/CEther.sol";
import "../../thirdparty/compound/CErc20.sol";
import "../../thirdparty/compound/Comptroller.sol";

import "../security/SecurityModule.sol";


/// @title CompoundModule
contract CompoundModule is BaseSubAccount, SecurityModule
{
    event CollateralAdded(address indexed _wallet, address _collateral, uint _collateralAmount);
    event CollateralRemoved(address indexed _wallet, address _collateral, uint _collateralAmount);
    event SubAccountBorrow(address indexed _wallet, address _debtToken, int _debtAmount);

    CompoundRegistry internal compoundRegistry;
    Comptroller      internal comptroller;
    address constant internal ETH_TOKEN_ADDRESS = address(0);

    constructor(
        Controller       _controller,
        CompoundRegistry _compoundRegistry,
        Comptroller      _comptroller
        )
        public
        SecurityModule(_controller)
    {
        compoundRegistry = _compoundRegistry;
        comptroller = _comptroller;
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

        // 3 cases:
        //  a. borrowed > 0 && amount <= borrowed ==> repayBorrow();
        //  b. borrowed > 0 && amount > borrowed  ==> repayBorrow() && deposit();
        //  c. borrowed == 0                      ==> deposit();
        uint repayAmount;
        uint mintAmount;
        uint borrowed = CToken(cToken).borrowBalanceCurrent(wallet);
        if (borrowed > amount) {
            repayAmount = amount;
        } else {
            repayAmount = borrowed;
            mintAmount = amount - borrowed;
        }

        // repay borrowed amount if need
        if (repayAmount > 0 ) {
            repayBorrow(wallet, token, borrowed);
            trackRepayBorrow(wallet, token, borrowed);
        }

        // mint new.
        if (mintAmount > 0) {
            // TODO: check if we need exit market here.
            mint(wallet, cToken, token, mintAmount);
            trackDeposit(wallet, token, mintAmount);
        }
    }

    /// @dev Redeem or borrow fund from Compound.
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

        require(amount > 0, "ZERO_WITHDRAW_AMOUNT");

        if (isCollaterlCToken(wallet, cToken)) {
            // for collaterl token, check liquidity to withdraw.
            (uint collateralRemovable, uint borrowableAfterRemove) = collateralTokenRemovable(wallet, token);
            require(amount <= collateralRemovable + borrowableAfterRemove, "INVALID_WITHDRAW_AMOUNT");

            uint redeemable = collateralRemovable;
            uint borrowable;
            if (amount <= collateralRemovable) {
                redeemable = amount;
            } else {
                borrowable = amount - collateralRemovable;
            }

            if (redeemable > 0) {
                redeemUnderlying(wallet, cToken, redeemable);
                trackWithdrawal(wallet, token, redeemable);
            }

            if (borrowable > 0) {
                borrow(wallet, cToken, borrowable);
                trackBorrow(wallet, token, borrowable);
            }
            return;
        }

        // Non-collateral token, user exchange current cToken and borrow more according to liquidity.
        // 2 cases:
        //  a. amount <= balance                                  ==> redeem();
        //  b. amount > balance && amount - balance <= borrowable ==> redeem() && borrow();
        uint balance = CToken(cToken).balanceOfUnderlying(wallet);
        uint borrowable = tokenBorrowable(wallet, token); // other collaterals tokens as this one is not.
        require(amount <= balance + borrowable, "INVALID_WITHDRAW_AMOUNT");

        uint withdrawAmount;
        uint borrowAmount;
        if (amount <= balance) {
            withdrawAmount = amount;
        } else {
            withdrawAmount = balance;
            borrowAmount = amount - withdrawAmount;
        }

        if (withdrawAmount > 0) {
            redeemUnderlying(wallet, cToken, withdrawAmount);
            trackWithdrawal(wallet, token, amount);
        }

        if (borrowAmount > 0) {
            borrow(wallet, cToken, borrowAmount);
            trackBorrow(wallet, token, borrowAmount);
        }
    }

    /// @dev tokenBalance is just the mapping from cToken to token, regardless of the collateral part.
    function tokenBalance (
        address wallet,
        address token
        )
        public
        view
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return 0;
        }

        (uint err, uint cTokenSupply, , uint exchangeRateMantissa) = CToken(cToken).getAccountSnapshot(wallet);
        if (err != 0) {
            return 0;
        }

        int tokenSupply = int(cTokenSupply.mul(exchangeRateMantissa)) / (10 ** 18);
        return tokenSupply;
    }

    function tokenInterestRate(
        address /* wallet */,
        address token,
        uint    /* amount */,
        bool    borrow
        )
        public
        view
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return 0;
        }

        if (borrow) {
            return - int(CToken(cToken).borrowRatePerBlock() / (10 ** 14));
        } else {
            return int(CToken(cToken).supplyRatePerBlock() / (10 ** 14));
        }
    }

    /// @dev tokenWithdrawalable calculates withdrawable token amount according to token type.
    ///      For non-collateral token, it is the token balance plus borrowable amount.
    ///      For collateral token, it removable part of this token collateral and borrowable amount of left other tokens collaterals.
    function tokenWithdrawalable (
        address wallet,
        address token
        )
        public
        view
        returns (
            uint userWithdrawable
        )
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return 0;
        }

        if (isCollaterlCToken(wallet, cToken)) {
            // if token is in collaterl markets, amount is calculated based on liquidity
            (uint collateralRemovable, uint borrowableAfterRemove) = collateralTokenRemovable(wallet, token);
            userWithdrawable = collateralRemovable + borrowableAfterRemove;
        } else {
            // otherwise, user redeem all mint token amount.
            userWithdrawable = uint(tokenBalance(wallet, token)) + tokenBorrowable(wallet, token);
        }
    }

    /// @dev get current borrowable token amount according user's liquidity.
    function tokenBorrowable (
        address wallet,
        address token
        )
        public
        view
        returns (uint)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return 0;
        }

        address priceOracle = address(Comptroller(comptroller).oracle);
        uint price = ComptrollerPriceOracle(priceOracle).getUnderlyingPrice(CToken(cToken));
        require(price != 0, "TOKEN_NO_PRICE");

        (uint err, uint liquidity, ) = Comptroller(comptroller).getAccountLiquidity(wallet);
        if (err != 0) {
            return err;
        }

        // amount == liquidity / price, i.e. amount_of_ETH / token_to_ETH price
        return liquidity / price;
    }

    /// @dev get removable part of current collateral token.
    ///      returns safeLiquidityToToken the safe part of cToken can be redeemed, which will not cause liquidation.
    ///              leftLiquidityToToken, the borrowable token based on user's remain liquidity after removable liquidity is removed.
    function collateralTokenRemovable(
        address wallet,
        address token
        )
        internal
        view
        returns (
            uint safeLiquidityToToken,
            uint leftLiquidityToToken
        )
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return (0, 0);
        }

        require(isCollaterlCToken(wallet, token), "NOT_COLLATERAL_CTOKEN");

        address priceOracle = address(Comptroller(comptroller).oracle);
        uint price = ComptrollerPriceOracle(priceOracle).getUnderlyingPrice(CToken(cToken));
        require(price != 0, "TOKEN_NO_PRICE");

        (uint err, uint liquidity, ) = Comptroller(comptroller).getAccountLiquidity(wallet);
        if (err != 0 || liquidity == 0) {
            return (0, 0);
        }

        // mapping(address => Comptroller.Market) storage markets = Comptroller(comptroller).markets;
        (bool isListed, uint collateralFactorMantissa) = ComptrollerV2Storage(comptroller).markets(cToken);
        if (isListed) {
            return (0, 0);
        }

        // calculate current cToken liquidity
        uint cTokenSupply;
        uint exchangeRateMantissa;
        (err, cTokenSupply, , exchangeRateMantissa) = CToken(cToken).getAccountSnapshot(wallet);
        if (err != 0) {
            return (0, 0);
        }
        uint cTokenToTokenAmount = cTokenSupply.mul(exchangeRateMantissa) / (10 ** 18);
        uint normalizedTokenLiquidity = cTokenToTokenAmount.mul(price);
        uint currentHoldLiquidity = normalizedTokenLiquidity.mul(collateralFactorMantissa) / (10 ** 18);

        if (currentHoldLiquidity <= liquidity) {
            // current holding liquidity <= free liquidity, means we have other enough collaterals.
            // we can remove this cToken all.
            safeLiquidityToToken = cTokenToTokenAmount;

            // After removal, we still have free liquidity, so we can borrow more.
            leftLiquidityToToken = (liquidity - currentHoldLiquidity) / price;
        } else {
            // current holding liquidity >= free liquidity, means part of our cToken is already used as collateral.
            // So we can remove only a part of this cToken.
            safeLiquidityToToken = liquidity / price;
            // After removal, we don't have free liquidity, so we can borrow 0.
            leftLiquidityToToken = 0;
        }
    }

    // Compound specific functions

    /// @dev add more collateral to get more withdrawables.
    function addCollaterals (
        address          wallet,
        address[] memory tokens,
        uint[]    memory amounts
        )
        public
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (uint)
    {
        require(tokens.length > 0, "EMPTY_TOKEN_ARRAY");

        // address[] memory cTokens = new address[](tokens.length);
        for (uint i = 0; i < tokens.length; ++i) {
            address cToken = compoundRegistry.getCToken(tokens[i]);
            if (cToken != address(0) && amounts[i] != 0) {
                enterMarketIfNeeded(wallet, cToken);
                mint(wallet, cToken, tokens[i], amounts[i]);
                emit CollateralAdded(wallet, tokens[i], amounts[i]);
            }
        }

        return 0;
    }

    /// @dev remove collaterals.
    /// return 0 if no error, else return the index of the first failed market, and stop exitMarket.
    function removeCollaterals (
        address          wallet,
        address[] memory tokens,
        uint[]    memory amounts
        )
        public
        nonReentrant
        onlyFromMetaTxOrWalletOwner(wallet)
        returns (uint)
    {
        require(tokens.length > 0, "EMPTY_TOKEN_ARRAY");

        for (uint i = 0; i < tokens.length; ++i) {
            address cToken = compoundRegistry.getCToken(tokens[i]);
            if (cToken != address(0)) {
                redeemUnderlying(wallet, cToken, amounts[i]);
                exitMarketIfNeeded(wallet, cToken);
            }
        }

        return 0;
    }

    // internal functions

    /// @dev get token balance based in real time from CToken. This is not a view func
    ///      because of status change during supply/borrowBalanceCurrent().
    function tokenBalanceCurrent (
        address wallet,
        address token
        )
        internal
        returns (int)
    {
        address cToken = compoundRegistry.getCToken(token);
        if (cToken == address(0)) {
            return 0;
        }

        uint supplyBalance = CToken(cToken).balanceOfUnderlying(wallet);
        return int(supplyBalance);
    }

    function trackBorrow(address wallet, address token, uint amount) internal {
        //TODO: add more track logic
        emit SubAccountBorrow(wallet, token, int(amount));
    }

    function trackRepayBorrow(address wallet, address token, uint amount) internal {
        //TODO: add more track logic
        emit SubAccountBorrow(wallet, token, -int(amount));
    }

    // internal wallet calls

    function mint(
        address _wallet,
        address _cToken,
        address _token,
        uint    _amount
        )
        internal
    {
        if (_token == ETH_TOKEN_ADDRESS) {
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
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("redeem(uint256)", _amount));
    }

    function redeemUnderlying(
        address _wallet,
        address _cToken,
        uint    _amount
        )
        internal
    {
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("redeemUnderlying(uint256)", _amount));
    }

    function borrow(
        address _wallet,
        address _cToken,
        uint    _amount
        )
        internal
    {
        // CErc20 and CEther have same function signature
        enterMarketIfNeeded(_wallet, _cToken);
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("borrow(uint256)", _amount));
    }

    function repayBorrow(
        address _wallet,
        address _cToken,
        uint    _amount
        )
        internal
    {
        // CErc20 and CEther have same function signature
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("repayBorrow(uint256)", _amount));
    }

    function isCollaterlCToken(address wallet, address cToken) internal view returns (bool) {
        return Comptroller(comptroller).checkMembership(wallet, CToken(cToken));
    }

    /// @dev Enters a cToken market if it was not entered before.
    /// @param wallet The target wallet.
    /// @param cToken The cToken contract.
    function enterMarketIfNeeded(address wallet, address cToken) internal {
        if(!isCollaterlCToken(wallet, cToken)) {
            address[] memory market = new address[](1);
            market[0] = cToken;
            transactCall(wallet, address(comptroller), 0, abi.encodeWithSignature("enterMarkets(address[])", market));
        }
    }

    /// @dev Exits a cToken market if there is no more collateral and debt.
    /// @param wallet The target wallet.
    /// @param cToken The cToken contract.
    function exitMarketIfNeeded(address wallet, address cToken) internal {
        uint collateral = CToken(cToken).balanceOf(wallet);
        uint debt = CToken(cToken).borrowBalanceStored(wallet);
        if(collateral == 0 && debt == 0) {
            transactCall(wallet, address(comptroller), 0, abi.encodeWithSignature("exitMarket(address)", cToken));
        }
    }
}
