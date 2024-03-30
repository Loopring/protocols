// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./base_connector.sol";

interface AaveInterface {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    function repayWithATokens(
        address asset,
        uint256 amount,
        uint256 interestRateMode
    ) external returns (uint256);

    function setUserUseReserveAsCollateral(
        address asset,
        bool useAsCollateral
    ) external;

    function swapBorrowRateMode(
        address asset,
        uint256 interestRateMode
    ) external;

    function setUserEMode(uint8 categoryId) external;
}

interface AavePoolProviderInterface {
    function getPool() external view returns (address);
}

interface AaveDataProviderInterface {
    function getReserveTokensAddresses(
        address _asset
    )
        external
        view
        returns (
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress
        );

    function getUserReserveData(
        address _asset,
        address _user
    )
        external
        view
        returns (
            uint256 currentATokenBalance,
            uint256 currentStableDebt,
            uint256 currentVariableDebt,
            uint256 principalStableDebt,
            uint256 scaledVariableDebt,
            uint256 stableBorrowRate,
            uint256 liquidityRate,
            uint40 stableRateLastUpdated,
            bool usageAsCollateralEnabled
        );

    function getReserveEModeCategory(
        address asset
    ) external view returns (uint256);
}

contract AaveV3Connector is BaseConnector {
    using SafeERC20 for IERC20;

    /**
     * @dev Aave Pool Provider
     */
    AavePoolProviderInterface internal immutable AAVE_PROVIDER;

    /**
     * @dev Aave Pool Data Provider
     */
    AaveDataProviderInterface internal immutable AAVE_DATA;

    /**
     * @dev Aave Referral Code
     */
    uint16 internal constant REFERRAL_CODE = 3228;

    constructor(
        address aaveProvider,
        address aaveData,
        address instaMemory,
        address weth
    ) BaseConnector(instaMemory, weth) {
        AAVE_PROVIDER = AavePoolProviderInterface(aaveProvider);
        AAVE_DATA = AaveDataProviderInterface(aaveData);
    }

    /**
     * @dev Checks if collateral is enabled for an asset
     * @param token token address of the asset.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     */

    function getIsColl(address token) internal view returns (bool isCol) {
        (, , , , , , , , isCol) = AAVE_DATA.getUserReserveData(
            token,
            address(this)
        );
    }

    /**
     * @dev Get total debt balance & fee for an asset
     * @param token token address of the debt.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param rateMode Borrow rate mode (Stable = 1, Variable = 2)
     */
    function getPaybackBalance(
        address token,
        uint256 rateMode
    ) internal view returns (uint256) {
        (, uint256 stableDebt, uint256 variableDebt, , , , , , ) = AAVE_DATA
            .getUserReserveData(token, address(this));
        return rateMode == 1 ? stableDebt : variableDebt;
    }

    /**
     * @dev Deposit ETH/ERC20_Token.
     * @notice Deposit a token to Aave v3 for lending / collaterization.
     * @param token The address of the token to deposit.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt The amount of the token to deposit. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens deposited.
     */
    function deposit(
        address token,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(AAVE_PROVIDER.getPool());

        bool isEth = token == ETH_ADDR;
        address _token = isEth ? WETH_ADDR : token;

        TokenInterface tokenContract = TokenInterface(_token);

        if (isEth) {
            _amt = _amt == type(uint256).max ? address(this).balance : _amt;
            convertEthToWeth(isEth, tokenContract, _amt);
        } else {
            _amt = _amt == type(uint256).max
                ? tokenContract.balanceOf(address(this))
                : _amt;
        }

        IERC20(address(tokenContract)).safeApprove(address(aave), _amt);

        aave.supply(_token, _amt, address(this), REFERRAL_CODE);

        if (!getIsColl(_token)) {
            aave.setUserUseReserveAsCollateral(_token, true);
        }

        setUint(setId, _amt);
    }

    /**
     * @dev Withdraw ETH/ERC20_Token.
     * @notice Withdraw deposited token from Aave v3
     * @param token The address of the token to withdraw.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt The amount of the token to withdraw. (For max: `uint256(-1)`)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens withdrawn.
     */
    function withdraw(
        address token,
        uint256 amt,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(AAVE_PROVIDER.getPool());
        bool isEth = token == ETH_ADDR;
        address _token = isEth ? WETH_ADDR : token;

        TokenInterface tokenContract = TokenInterface(_token);

        uint256 initialBal = tokenContract.balanceOf(address(this));
        aave.withdraw(_token, _amt, address(this));
        uint256 finalBal = tokenContract.balanceOf(address(this));

        _amt = sub(finalBal, initialBal);

        convertWethToEth(isEth, tokenContract, _amt);

        setUint(setId, _amt);
    }

    /**
     * @dev Borrow ETH/ERC20_Token.
     * @notice Borrow a token using Aave v3
     * @param token The address of the token to borrow.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt The amount of the token to borrow.
     * @param rateMode The type of debt. (For Stable: 1, Variable: 2)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens borrowed.
     */
    function borrow(
        address token,
        uint256 amt,
        uint256 rateMode,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(AAVE_PROVIDER.getPool());

        bool isEth = token == ETH_ADDR;
        address _token = isEth ? WETH_ADDR : token;

        aave.borrow(_token, _amt, rateMode, REFERRAL_CODE, address(this));
        convertWethToEth(isEth, TokenInterface(_token), _amt);

        setUint(setId, _amt);
    }

    /**
     * @dev Payback borrowed ETH/ERC20_Token.
     * @notice Payback debt owed.
     * @param token The address of the token to payback.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param amt The amount of the token to payback. (For max: `uint256(-1)`)
     * @param rateMode The type of debt paying back. (For Stable: 1, Variable: 2)
     * @param getId ID to retrieve amt.
     * @param setId ID stores the amount of tokens paid back.
     */
    function payback(
        address token,
        uint256 amt,
        uint256 rateMode,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint256 _amt = getUint(getId, amt);

        AaveInterface aave = AaveInterface(AAVE_PROVIDER.getPool());

        bool isEth = token == ETH_ADDR;
        address _token = isEth ? WETH_ADDR : token;

        TokenInterface tokenContract = TokenInterface(_token);

        _amt = _amt == type(uint256).max
            ? getPaybackBalance(_token, rateMode)
            : _amt;

        if (isEth) convertEthToWeth(isEth, tokenContract, _amt);

        IERC20(address(tokenContract)).safeApprove(address(aave), _amt);

        aave.repay(_token, _amt, rateMode, address(this));

        setUint(setId, _amt);
    }
}
