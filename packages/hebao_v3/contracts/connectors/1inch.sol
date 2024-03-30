// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base_connector.sol";

interface OneInchInterace {
    function swap(
        TokenInterface fromToken,
        TokenInterface toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        uint256 guaranteedAmount,
        address payable referrer,
        address[] calldata callAddresses,
        bytes calldata callDataConcat,
        uint256[] calldata starts,
        uint256[] calldata gasLimitsAndValues
    ) external payable returns (uint256 returnAmount);
}

struct OneInchData {
    TokenInterface sellToken;
    TokenInterface buyToken;
    uint _sellAmt;
    uint _buyAmt;
    uint unitAmt;
    bytes callData;
}

contract OneInchV5Connector is BaseConnector {
    using SafeERC20 for IERC20;

    address internal immutable ONEINCH_ADDR;

    constructor(
        address oneInch,
        address instaMemory,
        address weth
    ) BaseConnector(instaMemory, weth) {
        ONEINCH_ADDR = oneInch;
    }

    /**
     * @dev 1inch API swap handler
     * @param oneInchData - contains data returned from 1inch API. Struct defined in interfaces.sol
     * @param ethAmt - Eth to swap for .value()
     */
    function oneInchSwap(
        OneInchData memory oneInchData,
        uint ethAmt
    ) internal returns (uint buyAmt) {
        TokenInterface buyToken = oneInchData.buyToken;
        (uint _buyDec, uint _sellDec) = getTokensDec(
            buyToken,
            oneInchData.sellToken
        );
        uint _sellAmt18 = convertTo18(_sellDec, oneInchData._sellAmt);
        uint _slippageAmt = convert18ToDec(
            _buyDec,
            wmul(oneInchData.unitAmt, _sellAmt18)
        );

        uint initalBal = getTokenBal(buyToken);

        // solium-disable-next-line security/no-call-value
        (bool success, ) = ONEINCH_ADDR.call{value: ethAmt}(
            oneInchData.callData
        );
        if (!success) revert("1Inch-swap-failed");

        uint finalBal = getTokenBal(buyToken);

        buyAmt = sub(finalBal, initalBal);

        require(_slippageAmt <= buyAmt, "Too much slippage");
    }

    /**
     * @dev Gets the swapping data from 1inch's API.
     * @param oneInchData Struct with multiple swap data defined in interfaces.sol
     * @param setId Set token amount at this ID in `InstaMemory` Contract.
     */
    function _sell(
        OneInchData memory oneInchData,
        uint setId
    ) internal returns (OneInchData memory) {
        TokenInterface _sellAddr = oneInchData.sellToken;

        uint ethAmt;
        if (address(_sellAddr) == ETH_ADDR) {
            ethAmt = oneInchData._sellAmt;
        } else {
            IERC20(address(_sellAddr)).safeApprove(
                ONEINCH_ADDR,
                oneInchData._sellAmt
            );
        }

        oneInchData._buyAmt = oneInchSwap(oneInchData, ethAmt);
        setUint(setId, oneInchData._buyAmt);

        return oneInchData;
    }

    /**
     * @dev Sell ETH/ERC20_Token using 1Inch.
     * @notice Swap tokens from exchanges like kyber, 0x etc, with calculation done off-chain.
     * @param buyAddr The address of the token to buy.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param sellAddr The address of the token to sell.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param sellAmt The amount of the token to sell.
     * @param unitAmt The amount of buyAmt/sellAmt with slippage.
     * @param callData Data from 1inch API.
     * @param setId ID stores the amount of token brought.
     */
    function sell(
        address buyAddr,
        address sellAddr,
        uint sellAmt,
        uint unitAmt,
        bytes calldata callData,
        uint setId
    ) external payable {
        OneInchData memory oneInchData = OneInchData({
            buyToken: TokenInterface(buyAddr),
            sellToken: TokenInterface(sellAddr),
            unitAmt: unitAmt,
            callData: callData,
            _sellAmt: sellAmt,
            _buyAmt: 0
        });

        oneInchData = _sell(oneInchData, setId);
    }
}
