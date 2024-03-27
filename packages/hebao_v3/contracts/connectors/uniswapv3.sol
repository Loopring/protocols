// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./base_connector.sol";

struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}

struct ExactInputParams {
    bytes path;
    address recipient;
    uint256 amountIn;
    uint256 amountOutMinimum;
}

struct ExactOutputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 amountOut;
    uint256 amountInMaximum;
    uint160 sqrtPriceLimitX96;
}

struct ExactOutputParams {
    bytes path;
    address recipient;
    uint256 amountOut;
    uint256 amountInMaximum;
}

/// @title Callback for IUniswapV3PoolActions#swap
/// @notice Any contract that calls IUniswapV3PoolActions#swap must implement this interface
interface IUniswapV3SwapCallback {
    /// @notice Called to `msg.sender` after executing a swap via IUniswapV3Pool#swap.
    /// @dev In the implementation you must pay the pool tokens owed for the swap.
    /// The caller of this method must be checked to be a UniswapV3Pool deployed by the canonical UniswapV3Factory.
    /// amount0Delta and amount1Delta can both be 0 if no tokens were swapped.
    /// @param amount0Delta The amount of token0 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token0 to the pool.
    /// @param amount1Delta The amount of token1 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token1 to the pool.
    /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#swap call
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
}

interface IV3SwapRouter is IUniswapV3SwapCallback {
    /// @notice Swaps `amountIn` of one token for as much as possible of another token
    /// @dev Setting `amountIn` to 0 will cause the contract to look up its own balance,
    /// and swap the entire amount, enabling contracts to send tokens before calling this function.
    /// @param params The parameters necessary for the swap, encoded as `ExactInputSingleParams` in calldata
    /// @return amountOut The amount of the received token
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);

    /// @notice Swaps `amountIn` of one token for as much as possible of another along the specified path
    /// @dev Setting `amountIn` to 0 will cause the contract to look up its own balance,
    /// and swap the entire amount, enabling contracts to send tokens before calling this function.
    /// @param params The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata
    /// @return amountOut The amount of the received token
    function exactInput(
        ExactInputParams calldata params
    ) external payable returns (uint256 amountOut);

    /// @notice Swaps as little as possible of one token for `amountOut` of another token
    /// that may remain in the router after the swap.
    /// @param params The parameters necessary for the swap, encoded as `ExactOutputSingleParams` in calldata
    /// @return amountIn The amount of the input token
    function exactOutputSingle(
        ExactOutputSingleParams calldata params
    ) external payable returns (uint256 amountIn);

    /// @notice Swaps as little as possible of one token for `amountOut` of another along the specified path (reversed)
    /// that may remain in the router after the swap.
    /// @param params The parameters necessary for the multi-hop swap, encoded as `ExactOutputParams` in calldata
    /// @return amountIn The amount of the input token
    function exactOutput(
        ExactOutputParams calldata params
    ) external payable returns (uint256 amountIn);
}

interface IApproveAndCall {}

/// @title Multicall interface
/// @notice Enables calling multiple methods in a single call to the contract
interface IMulticall {}

/// @title MulticallExtended interface
/// @notice Enables calling multiple methods in a single call to the contract with optional validation
interface IMulticallExtended is IMulticall {}

/// @title Self Permit
/// @notice Functionality to call permit on any EIP-2612-compliant token for use in the route
interface ISelfPermit {}

/// @title Router token swapping functionality
/// @notice Functions for swapping tokens via Uniswap V2
interface IV2SwapRouter {}

interface ISwapRouter02 is
    IV2SwapRouter,
    IV3SwapRouter,
    IApproveAndCall,
    IMulticallExtended,
    ISelfPermit
{}

contract UniswapV3Connector is BaseConnector {
    using SafeERC20 for IERC20;

    /**
     * @dev uniswap v3 Swap Router
     */
    ISwapRouter02 internal immutable SWAP_ROUTER;

    constructor(
        address swapRouterAddr,
        address instaMemory,
        address wethAddr
    ) BaseConnector(instaMemory, wethAddr) {
        SWAP_ROUTER = ISwapRouter02(swapRouterAddr);
    }

    struct BuyInfo {
        address buyAddr; //token to be bought
        address sellAddr; //token to be sold
        uint24 fee; //pool fees for buyAddr-sellAddr token pair
        uint256 unitAmt; //The unit amount of sellAmt/buyAmt with slippage
        uint256 buyAmt; //amount of token to be bought
    }

    struct SellInfo {
        address buyAddr; //token to be bought
        address sellAddr; //token to be sold
        uint24 fee; //pool fees for buyAddr-sellAddr token pair
        uint256 unitAmt; //The unit amount of sellAmt/buyAmt with slippage
        uint256 sellAmt; //amount of token to be bought
    }

    /**
     * @dev Buy Function
     * @notice Swap token(sellAddr) with token(buyAddr), buy token with minimum sell token
     * @param buyData Data input for the buy action
     * @param getId Id to get buyAmt
     * @param setId Id to store sellAmt
     */
    function _buy(
        BuyInfo memory buyData,
        uint256 getId,
        uint256 setId
    ) internal {
        uint256 _buyAmt = getUint(getId, buyData.buyAmt);

        (TokenInterface _buyAddr, TokenInterface _sellAddr) = changeEthAddress(
            buyData.buyAddr,
            buyData.sellAddr
        );

        uint256 _slippageAmt = convert18ToDec(
            _sellAddr.decimals(),
            wmul(buyData.unitAmt, convertTo18(_buyAddr.decimals(), _buyAmt))
        );
        bool isEth = address(buyData.sellAddr) == ETH_ADDR;
        convertEthToWeth(isEth, _sellAddr, _slippageAmt);
        IERC20(address(_sellAddr)).safeApprove(
            address(SWAP_ROUTER),
            _slippageAmt
        );

        ExactOutputSingleParams memory params = ExactOutputSingleParams({
            tokenIn: address(_sellAddr),
            tokenOut: address(_buyAddr),
            fee: buyData.fee,
            recipient: address(this),
            amountOut: _buyAmt,
            amountInMaximum: _slippageAmt, //require(_sellAmt <= amountInMaximum)
            sqrtPriceLimitX96: 0
        });

        uint256 _sellAmt = SWAP_ROUTER.exactOutputSingle(params);
        require(_slippageAmt >= _sellAmt, "Too much slippage");

        if (_slippageAmt > _sellAmt) {
            convertEthToWeth(isEth, _sellAddr, _slippageAmt - _sellAmt);
            IERC20(address(_sellAddr)).safeApprove(address(SWAP_ROUTER), 0);
        }
        isEth = address(buyData.buyAddr) == ETH_ADDR;
        convertWethToEth(isEth, _buyAddr, _buyAmt);

        setUint(setId, _sellAmt);
    }

    /**
     * @dev Sell Function
     * @notice Swap token(sellAddr) with token(buyAddr), to get max buy tokens
     * @param sellData Data input for the sell action
     * @param getId Id to get buyAmt
     * @param setId Id to store sellAmt
     */
    function _sell(
        SellInfo memory sellData,
        uint256 getId,
        uint256 setId
    ) internal {
        uint256 _sellAmt = getUint(getId, sellData.sellAmt);
        (TokenInterface _buyAddr, TokenInterface _sellAddr) = changeEthAddress(
            sellData.buyAddr,
            sellData.sellAddr
        );

        if (_sellAmt == type(uint256).max) {
            _sellAmt = sellData.sellAddr == ETH_ADDR
                ? address(this).balance
                : _sellAddr.balanceOf(address(this));
        }

        uint256 _slippageAmt = convert18ToDec(
            _buyAddr.decimals(),
            wmul(sellData.unitAmt, convertTo18(_sellAddr.decimals(), _sellAmt))
        );

        bool isEth = address(sellData.sellAddr) == ETH_ADDR;
        convertEthToWeth(isEth, _sellAddr, _sellAmt);
        IERC20(address(_sellAddr)).safeApprove(address(SWAP_ROUTER), _sellAmt);
        ExactInputSingleParams memory params = ExactInputSingleParams({
            tokenIn: address(_sellAddr),
            tokenOut: address(_buyAddr),
            fee: sellData.fee,
            recipient: address(this),
            amountIn: _sellAmt,
            amountOutMinimum: _slippageAmt, //require(_buyAmt >= amountOutMinimum)
            sqrtPriceLimitX96: 0
        });

        uint256 _buyAmt = SWAP_ROUTER.exactInputSingle(params);
        require(_slippageAmt <= _buyAmt, "Too much slippage");

        isEth = address(sellData.buyAddr) == ETH_ADDR;
        convertWethToEth(isEth, _buyAddr, _buyAmt);

        setUint(setId, _buyAmt);
    }

    /**
     * @dev Buy Function
     * @notice Swap token(sellAddr) with token(buyAddr), buy token with minimum sell token
     * @param _buyAddr token to be bought
     * @param _sellAddr token to be sold
     * @param _fee pool fees for buyAddr-sellAddr token pair
     * @param _unitAmt The unit amount of sellAmt/buyAmt with slippage
     * @param _buyAmt amount of token to be bought
     * @param _getId Id to get buyAmt
     * @param _setId Id to store sellAmt
     */
    function buy(
        address _buyAddr,
        address _sellAddr,
        uint24 _fee,
        uint256 _unitAmt,
        uint256 _buyAmt,
        uint256 _getId,
        uint256 _setId
    ) external payable {
        _buy(
            BuyInfo({
                buyAddr: _buyAddr,
                sellAddr: _sellAddr,
                fee: _fee,
                unitAmt: _unitAmt,
                buyAmt: _buyAmt
            }),
            _getId,
            _setId
        );
    }

    /**
     * @dev Sell Function
     * @notice Swap token(sellAddr) with token(buyAddr), buy token with minimum sell token
     * @param _buyAddr token to be bought
     * @param _sellAddr token to be sold
     * @param _fee pool fees for buyAddr-sellAddr token pair
     * @param _unitAmt The unit amount of buyAmt/sellAmt with slippage
     * @param _sellAmt amount of token to be sold
     * @param _getId Id to get sellAmt
     * @param _setId Id to store buyAmt
     */
    function sell(
        address _buyAddr,
        address _sellAddr,
        uint24 _fee,
        uint256 _unitAmt,
        uint256 _sellAmt,
        uint256 _getId,
        uint256 _setId
    ) external payable {
        _sell(
            SellInfo({
                buyAddr: _buyAddr,
                sellAddr: _sellAddr,
                fee: _fee,
                unitAmt: _unitAmt,
                sellAmt: _sellAmt
            }),
            _getId,
            _setId
        );
    }
}
