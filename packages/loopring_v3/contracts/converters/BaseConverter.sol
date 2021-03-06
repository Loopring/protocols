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
import "../lib/LPERC20.sol";


/// @author Brecht Devos - <brecht@loopring.org>
abstract contract BaseConverter is LPERC20, Claimable, Drainable
{
    using AddressUtil       for address;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;

    event Deposit (bool success, string reason);

    IExchangeV3        public  immutable exchange;
    IDepositContract   public  immutable depositContract;

    address            public  immutable tokenIn;
    address            public  immutable tokenOut;

    bool               public  failed;

    modifier onlyFromExchangeOwner()
    {
        require(msg.sender == exchange.owner(), "UNAUTHORIZED");
        _;
    }

    constructor(
        IExchangeV3      _exchange,
        address          _tokenIn,
        address          _tokenOut,
        string    memory _name,
        string    memory _symbol,
        uint8            _decimals
        )
        LPERC20(_name, _symbol, _decimals)
    {
        exchange = _exchange;
        depositContract = _exchange.getDepositContract();
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
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
        require(totalSupply == 0);

        // Converter specific logic, which can fail
        try BaseConverter(this).convertExternal(amountIn, minAmountOut, customData) {
            failed = false;
            emit Deposit(true, "");
        } catch Error(string memory reason) {
            emit Deposit(false, reason);
            failed = true;
        } catch {
            failed = true;
            emit Deposit(false, "unknown");
        }

        _mint(address(this), amountIn);

        _repay(address(this), amountIn);
    }

    function withdraw(
        address from,
        address to,
        uint96  poolAmount,
        uint96  repayAmount
        )
        public
    {
        require(from == msg.sender || from == address(this), "UNAUTHORIZED");

        address token = failed ? tokenIn : tokenOut;

        uint balance = 0;
        if (token == address(0)) {
            balance = address(this).balance;
        } else {
            balance = ERC20(token).balanceOf(address(this));
        }
        uint amount = balance.mul(poolAmount) / totalSupply;

        _burn(from, poolAmount);

        if (repayAmount > 0) {
            _repay(token, repayAmount);
        }

        uint amountToSend = amount.sub(repayAmount);
        if (token == address(0)) {
            to.sendETHAndVerify(amountToSend, gasleft());   // ETH
        } else {
            token.safeTransferAndVerify(to, amountToSend);  // ERC20 token
        }
    }

    function convertExternal(
        uint96 amountIn,
        uint96 minAmountOut,
        bytes  calldata customData
        )
        external
        virtual
    {
        require(msg.sender == address(this), "UNAUTHORIZED");
        convert(amountIn, minAmountOut, customData);
    }

    receive()
        external
        payable
    {}

    function _repay(
        address token,
        uint96  amount
        )
        private
    {
        // Repay
        if (token != address(0)) {
            ERC20(token).approve(address(depositContract), amount);
        }
        uint repayValue = (token == address(0)) ? amount : 0;
        IExchangeV3(exchange).repayFlashMint{value: repayValue}(
            address(this),
            token,
            amount,
            new bytes(0)
        );
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
        virtual;
}
