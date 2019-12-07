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

    // wallet to ctoken borrow
    mapping(address => address) internal borrowedCToken;

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
        if (hasLoan(wallet)) {
            if (hasCTokenLoan(wallet, cToken)) {
                uint borrowed = CToken(cToken).borrowBalanceCurrent(wallet);
                if (amount <= borrowed) {
                    repayBorrow(wallet, token, amount);
                    trackRepayBorrow(wallet, token, amount);
                } else {
                    repayBorrow(wallet, token, borrowed);
                    trackRepayBorrow(wallet, token, borrowed);
                    mint(wallet, cToken, token, amount - borrowed);
                    trackDeposit(wallet, token, amount - borrowed);
                }
                return;
            }
        }

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

        require(amount > 0, "ZERO_WITHDRAW_AMOUNT");

        if (hasLoan(wallet)) {
            // if wallet has loan, we can only borrow more same token until borrow capacity reaches.
            if (hasCTokenLoan(wallet, cToken)) {
                uint borrowable = borrowCapacity(wallet, token);
                require(amount <= borrowable, "INVALID_WITHDRAW_AMOUNT");
                borrow(wallet, cToken, amount);
                trackBorrow(wallet, token, amount);
                return;
            } else {
                return;
            }
        }

        // 3 cases:
        //  a. balance >  0 && amount <= balance                                    ==> redeem();
        //  b. balance >  0 && amount > balance && amount - balance <= withdrawable ==> redeem() && borrow();
        //  c. balance <= 0 && amount <= withdrawable                               ==> borrow();
        // else do nothing.
        int balance = tokenBalanceCurrent(wallet, token);
        uint borrowable = borrowCapacity(wallet, token);
        if (balance > 0) {
            if (amount <= uint(balance)) {
                redeemUnderlying(wallet, cToken, amount);
                trackWithdrawal(wallet, token, amount);
            } else { // amount > balance;
                uint borrowAmount = amount - uint(balance);
                require(borrowAmount <= borrowable, "INVALID_WITHDRAW_AMOUNT");
                redeemUnderlying(wallet, cToken, uint(balance));
                trackWithdrawal(wallet, token, uint(balance));

                borrow(wallet, cToken, borrowAmount);
                trackBorrow(wallet, token, borrowAmount);
            }
        } else {
            require(amount <= borrowable, "INVALID_WITHDRAW_AMOUNT");
            borrow(wallet, cToken, amount);
            trackBorrow(wallet, token, amount);
        }
    }

    /// @dev tokenBalance in Compound is the deposited underlying token minus the borrowed underlying token.
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

        if (hasLoan(wallet)) {
            if (hasCTokenLoan(wallet, cToken)) {
                return - int(CToken(cToken).borrowBalanceStored(wallet));
            } else if (isCollaterlCToken(wallet, cToken)) {
                // if cToken is in collateral market of compound, no withdraw allowed.
                return 0;
            }
        }

        (uint err, uint cTokenSupply, uint tokenBorrow, uint exchangeRateMantissa) = CToken(cToken).getAccountSnapshot(wallet);
        if (err != 0) {
            return 0;
        }

        int tokenSupply = int(cTokenSupply.mul(exchangeRateMantissa)) / (10 ** 18);
        return tokenSupply - int(tokenBorrow);
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

    function tokenWithdrawalable (
        address wallet,
        address token
        )
        public
        view
        returns (uint)
    {
        int balance = tokenBalance(wallet, token);
        if (balance <= 0) {
            return borrowCapacity(wallet, token);
        }

        // not balance + borrowCapacity because balance is collateral if borrow.
        return uint(balance);
    }

    /// @dev get current borrowable token amount from CToken.
    ///      If wallet has another CToken loan, return 0.
    function borrowCapacity (
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

        if (hasLoan(wallet) && !hasCTokenLoan(wallet, cToken)) {
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
        uint borrowBalance = CToken(cToken).borrowBalanceCurrent(wallet);
        return int(supplyBalance) - int(borrowBalance);
    }

    function hasLoan(address wallet) internal view returns (bool) {
        return borrowedCToken[wallet] != address(0);
    }

    function hasCTokenLoan(address wallet, address CToken) internal view returns (bool) {
        return borrowedCToken[wallet] == CToken;
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
        require(!hasLoan(_wallet) || hasCTokenLoan(_wallet, _cToken), "BORROW_CONDITION_NOT_MATCH");

        enterMarketIfNeeded(_wallet, _cToken);
        transactCall(_wallet, _cToken, 0, abi.encodeWithSignature("borrow(uint256)", _amount));
        borrowedCToken[_wallet] = _cToken;
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
        if (CToken(_cToken).borrowBalanceCurrent(_wallet) == 0) {
            // clear loan flag if loan closes.
            borrowedCToken[_wallet] = address(0);
        }
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
