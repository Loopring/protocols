// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.8.17;
pragma experimental ABIEncoderV2;

import "./base_connector.sol";

interface IUniswapV2Router02 {
    function factory() external pure returns (address);

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB);
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function quote(
        uint amountA,
        uint reserveA,
        uint reserveB
    ) external pure returns (uint amountB);
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) external pure returns (uint amountOut);
    function getAmountIn(
        uint amountOut,
        uint reserveIn,
        uint reserveOut
    ) external pure returns (uint amountIn);
    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
    function getAmountsIn(
        uint amountOut,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

contract UniswapConnector is BaseConnector {
    IUniswapV2Router02 internal constant ROUTER =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
    constructor(address _instaMemory) BaseConnector(_instaMemory) {}

    function deposit(
        address tokenA,
        address tokenB,
        uint256 amtA,
        uint256 unitAmt,
        uint256 slippage,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint _amt = getUint(getId, amtA);

        (, , uint _uniAmt) = _addLiquidity(
            tokenA,
            tokenB,
            _amt,
            unitAmt,
            slippage
        );
        setUint(setId, _uniAmt);
    }

    /**
     * @dev Withdraw Liquidity.
     * @notice Withdraw Liquidity from a Uniswap v2 pool.
     * @param tokenA The address of token A.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param tokenB The address of token B.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param uniAmt The amount of pool tokens to withdraw.
     * @param unitAmtA The unit amount of amtA/uniAmt with slippage.
     * @param unitAmtB The unit amount of amtB/uniAmt with slippage.
     * @param getId ID to retrieve uniAmt.
     * @param setIds Array of IDs to store the amount tokens received.
     */
    function withdraw(
        address tokenA,
        address tokenB,
        uint256 uniAmt,
        uint256 unitAmtA,
        uint256 unitAmtB,
        uint256 getId,
        uint256[] calldata setIds
    ) external payable {
        uint _amt = getUint(getId, uniAmt);

        (uint _amtA, uint _amtB, ) = _removeLiquidity(
            tokenA,
            tokenB,
            _amt,
            unitAmtA,
            unitAmtB
        );

        setUint(setIds[0], _amtA);
        setUint(setIds[1], _amtB);
    }

    /**
     * @dev Buy ETH/ERC20_Token.
     * @notice Buy a token using a Uniswap v2
     * @param buyAddr The address of the token to buy.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param sellAddr The address of the token to sell.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param buyAmt The amount of tokens to buy.
     * @param unitAmt The unit amount of sellAmt/buyAmt with slippage.
     * @param getId ID to retrieve buyAmt.
     * @param setId ID to store the amount of tokens sold.
     */
    function buy(
        address buyAddr,
        address sellAddr,
        uint256 buyAmt,
        uint256 unitAmt,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint _buyAmt = getUint(getId, buyAmt);
        (TokenInterface _buyAddr, TokenInterface _sellAddr) = changeEthAddress(
            buyAddr,
            sellAddr
        );
        address[] memory paths = getPaths(
            address(_buyAddr),
            address(_sellAddr)
        );

        uint _slippageAmt = convert18ToDec(
            _sellAddr.decimals(),
            wmul(unitAmt, convertTo18(_buyAddr.decimals(), _buyAmt))
        );

        checkPair(paths);
        uint _expectedAmt = getExpectedSellAmt(paths, _buyAmt);
        require(_slippageAmt >= _expectedAmt, "Too much slippage");

        bool isEth = address(_sellAddr) == WETH_ADDR;
        convertEthToWeth(isEth, _sellAddr, _expectedAmt);
        _sellAddr.approve(address(ROUTER), _expectedAmt);

        uint _sellAmt = ROUTER.swapTokensForExactTokens(
            _buyAmt,
            _expectedAmt,
            paths,
            address(this),
            block.timestamp + 1
        )[0];

        isEth = address(_buyAddr) == WETH_ADDR;
        convertWethToEth(isEth, _buyAddr, _buyAmt);

        setUint(setId, _sellAmt);
    }

    /**
     * @dev Sell ETH/ERC20_Token.
     * @notice Sell a token using a Uniswap v2
     * @param buyAddr The address of the token to buy.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param sellAddr The address of the token to sell.(For ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
     * @param sellAmt The amount of the token to sell.
     * @param unitAmt The unit amount of buyAmt/sellAmt with slippage.
     * @param getId ID to retrieve sellAmt.
     * @param setId ID stores the amount of token brought.
     */
    function sell(
        address buyAddr,
        address sellAddr,
        uint256 sellAmt,
        uint256 unitAmt,
        uint256 getId,
        uint256 setId
    ) external payable {
        uint _sellAmt = getUint(getId, sellAmt);
        (TokenInterface _buyAddr, TokenInterface _sellAddr) = changeEthAddress(
            buyAddr,
            sellAddr
        );
        address[] memory paths = getPaths(
            address(_buyAddr),
            address(_sellAddr)
        );

        if (_sellAmt == type(uint).max) {
            _sellAmt = sellAddr == ETH_ADDR
                ? address(this).balance
                : _sellAddr.balanceOf(address(this));
        }

        uint _slippageAmt = convert18ToDec(
            _buyAddr.decimals(),
            wmul(unitAmt, convertTo18(_sellAddr.decimals(), _sellAmt))
        );

        checkPair(paths);
        uint _expectedAmt = getExpectedBuyAmt(paths, _sellAmt);
        require(_slippageAmt <= _expectedAmt, "Too much slippage");

        bool isEth = address(_sellAddr) == WETH_ADDR;
        convertEthToWeth(isEth, _sellAddr, _sellAmt);
        _sellAddr.approve(address(ROUTER), _sellAmt);

        uint _buyAmt = ROUTER.swapExactTokensForTokens(
            _sellAmt,
            _expectedAmt,
            paths,
            address(this),
            block.timestamp + 1
        )[1];

        isEth = address(_buyAddr) == WETH_ADDR;
        convertWethToEth(isEth, _buyAddr, _buyAmt);

        setUint(setId, _buyAmt);
    }

    function getMinAmount(
        TokenInterface token,
        uint amt,
        uint slippage
    ) internal view returns (uint minAmt) {
        uint _amt18 = convertTo18(token.decimals(), amt);
        minAmt = wmul(_amt18, sub(WAD, slippage));
        minAmt = convert18ToDec(token.decimals(), minAmt);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint _amt,
        uint unitAmt,
        uint slippage
    ) internal returns (uint _amtA, uint _amtB, uint _liquidity) {
        (TokenInterface _tokenA, TokenInterface _tokenB) = changeEthAddress(
            tokenA,
            tokenB
        );

        _amtA = _amt == type(uint).max
            ? getTokenBal(TokenInterface(tokenA))
            : _amt;
        _amtB = convert18ToDec(
            _tokenB.decimals(),
            wmul(unitAmt, convertTo18(_tokenA.decimals(), _amtA))
        );

        bool isEth = address(_tokenA) == WETH_ADDR;
        convertEthToWeth(isEth, _tokenA, _amtA);

        isEth = address(_tokenB) == WETH_ADDR;
        convertEthToWeth(isEth, _tokenB, _amtB);

        _tokenA.approve(address(ROUTER), _amtA);
        _tokenA.approve(address(ROUTER), _amtB);

        uint minAmtA = getMinAmount(_tokenA, _amtA, slippage);
        uint minAmtB = getMinAmount(_tokenB, _amtB, slippage);
        (_amtA, _amtB, _liquidity) = ROUTER.addLiquidity(
            address(_tokenA),
            address(_tokenB),
            _amtA,
            _amtB,
            minAmtA,
            minAmtB,
            address(this),
            block.timestamp + 1
        );
    }

    function _removeLiquidity(
        address tokenA,
        address tokenB,
        uint _amt,
        uint unitAmtA,
        uint unitAmtB
    ) internal returns (uint _amtA, uint _amtB, uint _uniAmt) {
        (TokenInterface _tokenA, TokenInterface _tokenB) = changeEthAddress(
            tokenA,
            tokenB
        );
        address exchangeAddr = IUniswapV2Factory(ROUTER.factory()).getPair(
            address(_tokenA),
            address(_tokenB)
        );
        require(exchangeAddr != address(0), "pair-not-found.");

        TokenInterface uniToken = TokenInterface(exchangeAddr);
        _uniAmt = _amt == type(uint).max
            ? uniToken.balanceOf(address(this))
            : _amt;
        uniToken.approve(address(ROUTER), _uniAmt);

        {
            uint minAmtA = convert18ToDec(
                _tokenA.decimals(),
                wmul(unitAmtA, _uniAmt)
            );
            uint minAmtB = convert18ToDec(
                _tokenB.decimals(),
                wmul(unitAmtB, _uniAmt)
            );
            (_amtA, _amtB) = ROUTER.removeLiquidity(
                address(_tokenA),
                address(_tokenB),
                _uniAmt,
                minAmtA,
                minAmtB,
                address(this),
                block.timestamp + 1
            );
        }

        bool isEth = address(_tokenA) == WETH_ADDR;
        convertWethToEth(isEth, _tokenA, _amtA);

        isEth = address(_tokenB) == WETH_ADDR;
        convertWethToEth(isEth, _tokenB, _amtB);
    }

    function getExpectedBuyAmt(
        address[] memory paths,
        uint sellAmt
    ) internal view returns (uint buyAmt) {
        uint[] memory amts = ROUTER.getAmountsOut(sellAmt, paths);
        buyAmt = amts[1];
    }

    function getExpectedSellAmt(
        address[] memory paths,
        uint buyAmt
    ) internal view returns (uint sellAmt) {
        uint[] memory amts = ROUTER.getAmountsIn(buyAmt, paths);
        sellAmt = amts[0];
    }

    function checkPair(address[] memory paths) internal view {
        address pair = IUniswapV2Factory(ROUTER.factory()).getPair(
            paths[0],
            paths[1]
        );
        require(pair != address(0), "No-exchange-address");
    }

    function getPaths(
        address buyAddr,
        address sellAddr
    ) internal pure returns (address[] memory paths) {
        paths = new address[](2);
        paths[0] = address(sellAddr);
        paths[1] = address(buyAddr);
    }
}
