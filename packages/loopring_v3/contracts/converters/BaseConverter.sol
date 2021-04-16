// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;

import "../core/iface/IExchangeV3.sol";
import "../lib/Claimable.sol";
import "../lib/Drainable.sol";
import "../lib/ERC20.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/LPToken.sol";


/// @author Brecht Devos - <brecht@loopring.org>
abstract contract BaseConverter is LPToken, Claimable, Drainable
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    event ConversionSuccess (uint amountIn, uint amountOut);
    event ConversionFailed  (string reason);

    IExchangeV3        public  immutable exchange;
    IDepositContract   public  immutable depositContract;

    bool               public  initialized;

    address            public  tokenIn;
    address            public  tokenOut;

    bool               public  failed;

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    constructor(
        IExchangeV3 _exchange
        )
    {
        exchange = _exchange;
        depositContract = _exchange.getDepositContract();
    }

    function initialize(
        string memory _name,
        string memory _symbol,
        uint8         _decimals,
        address       _tokenIn,
        address       _tokenOut
        )
        external
    {
        require(!initialized, "ALREADY_INITIALIZED");
        initializeToken(_name, _symbol, _decimals);

        tokenIn = _tokenIn;
        tokenOut = _tokenOut;

        initialized = true;
    }

    function deposit(
        uint96          amountIn,
        uint96          minAmountOut,
        bytes  calldata customData
        )
        external
        payable
        onlyFromExchangeOwner
    {
        require(totalSupply == 0, "SUPPLY_NON_ZERO");

        // Converter specific logic, which can fail
        try BaseConverter(this).convertExternal(amountIn, minAmountOut, customData)
            returns (uint amountOut) {
            failed = false;
            emit ConversionSuccess(amountIn, amountOut);
        } catch Error(string memory reason) {
            failed = true;
            emit ConversionFailed(reason);
        } catch {
            failed = true;
            emit ConversionFailed("unknown");
        }

        // Mint pool tokens representing each user's share in the pool, with 1:1 ratio
        _mint(address(this), amountIn);

        // Repay the fmint deposit used to give user's their share on L2
        _repay(address(this), amountIn);
    }

    function withdraw(
        address to,
        uint96  poolAmount,
        uint96  repayAmount
        )
        public
    {
        // Token to withdraw
        address token = failed ? tokenIn : tokenOut;

        // Current balance in the contract
        uint balance = 0;
        if (token == address(0)) {
            balance = address(this).balance;
        } else {
            balance = ERC20(token).balanceOf(address(this));
        }

        // Share to withdraw
        uint amount = balance.mul(poolAmount) / totalSupply;

        // Burn pool tokens
        _burn(msg.sender, poolAmount);

        // Use to repay fmint deposit directly if requested
        if (repayAmount > 0) {
            _repay(token, repayAmount);
        }

        // Send remaining amount to `to`
        uint amountToSend = amount.sub(repayAmount);
        if (token == address(0)) {
            to.sendETHAndVerify(amountToSend, gasleft());   // ETH
        } else {
            token.safeTransferAndVerify(to, amountToSend);  // ERC20 token
        }
    }

    // Wrapper around `convert` which enforces only self calls.
    function convertExternal(
        uint96 amountIn,
        uint96 minAmountOut,
        bytes  calldata customData
        )
        external
        virtual
        returns (uint amountOut)
    {
        require(msg.sender == address(this), "UNAUTHORIZED");
        amountOut = convert(amountIn, minAmountOut, customData);
    }

    receive() external payable {}

    function _repay(address token, uint96  amount)
        private
    {
        uint ethValue = (token == address(0)) ? amount : 0;
        IExchangeV3(exchange).repayMintDeposit{value: ethValue}(
            address(this),
            token,
            amount,
            new bytes(0)
        );
    }

    // Function to approve tokens so this doesn't have to be done every time the conversion is done
    function approveTokens()
        public
        virtual
    {
        if (tokenIn != address(0)) {
            ERC20(tokenIn).approve(address(depositContract), type(uint256).max);
        }
        if (tokenOut != address(0)) {
            ERC20(tokenOut).approve(address(depositContract), type(uint256).max);
        }
        ERC20(address(this)).approve(address(depositContract), type(uint256).max);
    }

    function canDrain(address drainer, address /* token */)
        public
        override
        view
        returns (bool)
    {
        return drainer == owner && totalSupply == 0;
    }

    // Converer specific logic
    function convert(
        uint96          amountIn,
        uint96          minAmountOut,
        bytes  calldata customData
        )
        internal
        virtual
        returns (uint amountOut);
}
