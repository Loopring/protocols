// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Compound.
 * @dev Lending & Borrowing.
 */

import "./base_connector.sol";

interface CTokenInterface {
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
    function borrow(uint borrowAmount) external returns (uint);
    function repayBorrow(uint repayAmount) external returns (uint);
    function repayBorrowBehalf(
        address borrower,
        uint repayAmount
    ) external returns (uint); // For ERC20
    function liquidateBorrow(
        address borrower,
        uint repayAmount,
        address cTokenCollateral
    ) external returns (uint);

    function borrowBalanceCurrent(address account) external returns (uint);
    function redeemUnderlying(uint redeemAmount) external returns (uint);
    function exchangeRateCurrent() external returns (uint);

    function balanceOf(address owner) external view returns (uint256 balance);

    function isCToken() external view returns (bool);
    function underlying() external view returns (address);
    function borrowBalanceStored(address account) external view returns (uint);
    function exchangeRateStored() external view returns (uint);
}

interface CETHInterface {
    function mint() external payable;
    function repayBorrow() external payable;
    function repayBorrowBehalf(address borrower) external payable;
    function liquidateBorrow(
        address borrower,
        address cTokenCollateral
    ) external payable;
}

interface ComptrollerInterface {
    function enterMarkets(
        address[] calldata cTokens
    ) external returns (uint[] memory);
    function exitMarket(address cTokenAddress) external returns (uint);
    function getAssetsIn(
        address account
    ) external view returns (address[] memory);
    function getAccountLiquidity(
        address account
    ) external view returns (uint, uint, uint);
    function claimComp(address) external;
}

contract CompoundConnector is BaseConnector {
    using SafeERC20 for IERC20;

    /**
     * @dev Compound Comptroller
     */
    ComptrollerInterface internal immutable COMP_TROLLER;

    constructor(
        address _comp_troller,
        address _instaMemory,
        address _weth
    ) BaseConnector(_instaMemory, _weth) {
        COMP_TROLLER = ComptrollerInterface(_comp_troller);
    }

    /**
     * @dev Deposit ETH/ERC20_Token.
     * @notice Deposit a token to Compound for lending / collaterization.
     * @param token The address of the token to deposit. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param amt The amount of the token to deposit. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens deposited.
     */
    function deposit(
        address token,
        address cToken,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        enterMarket(cToken);
        if (token == ETH_ADDR) {
            _amt = _amt == type(uint).max ? address(this).balance : _amt;
            CETHInterface(cToken).mint{value: _amt}();
        } else {
            TokenInterface tokenContract = TokenInterface(token);
            _amt = _amt == type(uint).max
                ? tokenContract.balanceOf(address(this))
                : _amt;
            IERC20(address(tokenContract)).safeApprove(cToken, _amt);
            require(CTokenInterface(cToken).mint(_amt) == 0, "deposit-failed");
        }
        setUint(setId, _amt);
    }

    /**
     * @dev Withdraw ETH/ERC20_Token.
     * @notice Withdraw deposited token from Compound
     * @param token The address of the token to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param amt The amount of the token to withdraw. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens withdrawn.
     */
    function withdraw(
        address token,
        address cToken,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        CTokenInterface cTokenContract = CTokenInterface(cToken);
        if (_amt == type(uint).max) {
            TokenInterface tokenContract = TokenInterface(token);
            uint initialBal = token == ETH_ADDR
                ? address(this).balance
                : tokenContract.balanceOf(address(this));
            require(
                cTokenContract.redeem(
                    cTokenContract.balanceOf(address(this))
                ) == 0,
                "full-withdraw-failed"
            );
            uint finalBal = token == ETH_ADDR
                ? address(this).balance
                : tokenContract.balanceOf(address(this));
            _amt = finalBal - initialBal;
        } else {
            require(
                cTokenContract.redeemUnderlying(_amt) == 0,
                "withdraw-failed"
            );
        }
        setUint(setId, _amt);
    }

    /**
     * @dev Borrow ETH/ERC20_Token.
     * @notice Borrow a token using Compound
     * @param token The address of the token to borrow. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param amt The amount of the token to borrow.
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens borrowed.
     */
    function borrow(
        address token,
        address cToken,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        enterMarket(cToken);
        require(CTokenInterface(cToken).borrow(_amt) == 0, "borrow-failed");
        setUint(setId, _amt);
    }

    /**
     * @dev Payback borrowed ETH/ERC20_Token.
     * @notice Payback debt owed.
     * @param token The address of the token to payback. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param amt The amount of the token to payback. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens paid back.
     */
    function payback(
        address token,
        address cToken,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        CTokenInterface cTokenContract = CTokenInterface(cToken);
        _amt = _amt == type(uint).max
            ? cTokenContract.borrowBalanceCurrent(address(this))
            : _amt;

        if (token == ETH_ADDR) {
            require(address(this).balance >= _amt, "not-enough-eth");
            CETHInterface(cToken).repayBorrow{value: _amt}();
        } else {
            TokenInterface tokenContract = TokenInterface(token);
            require(
                tokenContract.balanceOf(address(this)) >= _amt,
                "not-enough-token"
            );
            IERC20(address(tokenContract)).safeApprove(cToken, _amt);
            require(cTokenContract.repayBorrow(_amt) == 0, "repay-failed.");
        }
        setUint(setId, _amt);
    }

    /**
     * @dev Deposit ETH/ERC20_Token.
     * @notice Same as depositRaw. The only difference is this method stores cToken amount in set ID.
     * @param token The address of the token to deposit. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param amt The amount of the token to deposit. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of cTokens received.
     */
    function depositCToken(
        address token,
        address cToken,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);

        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        enterMarket(cToken);

        CTokenInterface ctokenContract = CTokenInterface(cToken);
        uint initialBal = ctokenContract.balanceOf(address(this));

        if (token == ETH_ADDR) {
            _amt = _amt == type(uint).max ? address(this).balance : _amt;
            CETHInterface(cToken).mint{value: _amt}();
        } else {
            TokenInterface tokenContract = TokenInterface(token);
            _amt = _amt == type(uint).max
                ? tokenContract.balanceOf(address(this))
                : _amt;
            IERC20(address(tokenContract)).safeApprove(cToken, _amt);
            require(ctokenContract.mint(_amt) == 0, "deposit-ctoken-failed.");
        }

        uint _cAmt;

        {
            uint finalBal = ctokenContract.balanceOf(address(this));
            _cAmt = sub(finalBal, initialBal);

            setUint(setId, _cAmt);
        }
    }

    /**
     * @dev Withdraw CETH/CERC20_Token using cToken Amt.
     * @notice Same as withdrawRaw. The only difference is this method fetch cToken amount in get ID.
     * @param token The address of the token to withdraw. (For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cToken The address of the corresponding cToken.
     * @param cTokenAmt The amount of cTokens to withdraw
     * @param getId ID to retrieve cTokenAmt
     * @param setId ID stores the amount of tokens withdrawn.
     */
    function withdrawCToken(
        address token,
        address cToken,
        uint cTokenAmt,
        uint getId,
        uint setId
    ) public payable {
        uint _cAmt = getUint(getId, cTokenAmt);
        require(
            token != address(0) && cToken != address(0),
            "invalid token/ctoken address"
        );

        CTokenInterface cTokenContract = CTokenInterface(cToken);
        TokenInterface tokenContract = TokenInterface(token);
        _cAmt = _cAmt == type(uint).max
            ? cTokenContract.balanceOf(address(this))
            : _cAmt;

        uint withdrawAmt;
        {
            uint initialBal = token != ETH_ADDR
                ? tokenContract.balanceOf(address(this))
                : address(this).balance;
            require(cTokenContract.redeem(_cAmt) == 0, "redeem-failed");
            uint finalBal = token != ETH_ADDR
                ? tokenContract.balanceOf(address(this))
                : address(this).balance;

            withdrawAmt = sub(finalBal, initialBal);
        }

        setUint(setId, withdrawAmt);
    }

    /**
     * @dev Liquidate a position.
     * @notice Liquidate a position.
     * @param borrower Borrower's Address.
     * @param tokenToPay The address of the token to pay for liquidation.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param cTokenPay Corresponding cToken address.
     * @param tokenInReturn The address of the token to return for liquidation.
     * @param cTokenColl Corresponding cToken address.
     * @param amt The token amount to pay for liquidation.
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of paid for liquidation.
     */
    function liquidate(
        address borrower,
        address tokenToPay,
        address cTokenPay,
        address tokenInReturn,
        address cTokenColl,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) public payable {
        uint _amt = getUint(getId, amt);
        require(
            tokenToPay != address(0) && cTokenPay != address(0),
            "invalid token/ctoken address"
        );
        require(
            tokenInReturn != address(0) && cTokenColl != address(0),
            "invalid token/ctoken address"
        );

        CTokenInterface cTokenContract = CTokenInterface(cTokenPay);

        {
            (, , uint shortfal) = COMP_TROLLER.getAccountLiquidity(borrower);
            require(shortfal != 0, "account-cannot-be-liquidated");
            _amt = _amt == type(uint).max
                ? cTokenContract.borrowBalanceCurrent(borrower)
                : _amt;
        }

        if (tokenToPay == ETH_ADDR) {
            require(address(this).balance >= _amt, "not-enought-eth");
            CETHInterface(cTokenPay).liquidateBorrow{value: _amt}(
                borrower,
                cTokenColl
            );
        } else {
            TokenInterface tokenContract = TokenInterface(tokenToPay);
            require(
                tokenContract.balanceOf(address(this)) >= _amt,
                "not-enough-token"
            );
            IERC20(address(tokenContract)).safeApprove(cTokenPay, _amt);
            require(
                cTokenContract.liquidateBorrow(borrower, _amt, cTokenColl) == 0,
                "liquidate-failed"
            );
        }
        setUint(setId, _amt);
    }

    /**
     * @dev enter compound market
     */
    function enterMarket(address cToken) internal {
        address[] memory markets = COMP_TROLLER.getAssetsIn(address(this));
        bool isEntered = false;
        for (uint i = 0; i < markets.length; i++) {
            if (markets[i] == cToken) {
                isEntered = true;
            }
        }
        if (!isEntered) {
            address[] memory toEnter = new address[](1);
            toEnter[0] = cToken;
            COMP_TROLLER.enterMarkets(toEnter);
        }
    }
}
