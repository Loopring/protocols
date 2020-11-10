// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../iface/IModule.sol";
import "../iface/IWallet.sol";
import "../lib/AddressUtil.sol";
import "../lib/ERC20.sol";
import "../lib/MathUint.sol";
import "./Controller.sol";


/// @title BaseModule
/// @dev This contract implements some common functions that are likely
///      be useful for all modules.
///
/// @author Daniel Wang - <daniel@loopring.org>
abstract contract BaseModule is IModule
{
    using MathUint      for uint;
    using AddressUtil   for address;

    event Activated   (address wallet);
    event Deactivated (address wallet);

    SecurityStore  public immutable securityStore;
    WhitelistStore public immutable whitelistStore;
    QuotaStore     public immutable quotaStore;
    HashStore      public immutable hashStore;
    address        public immutable walletFactory;
    PriceOracle    public immutable priceOracle;
    address        public immutable feeCollector;

    modifier onlyWalletOwner(address wallet, address addr)
        virtual
    {
        require(IWallet(wallet).owner() == addr, "NOT_WALLET_OWNER");
        _;
    }

    modifier notWalletOwner(address wallet, address addr)
        virtual
    {
        require(IWallet(wallet).owner() != addr, "IS_WALLET_OWNER");
        _;
    }

    modifier eligibleWalletOwner(address addr)
    {
        require(addr != address(0) && !addr.isContract(), "INVALID_OWNER");
        _;
    }

    constructor(Controller _controller)
    {
        securityStore = _controller.securityStore();
        whitelistStore = _controller.whitelistStore();
        quotaStore = _controller.quotaStore();
        hashStore = _controller.hashStore();
        walletFactory = _controller.walletFactory();
        priceOracle = _controller.priceOracle();
        feeCollector = _controller.feeCollector();
    }

    function activate(address wallet) external override pure {}
    function bindableMethods() public override pure virtual returns (bytes4[] memory methods) {}

    // ===== internal & private methods =====

    function transactCall(
        address wallet,
        address to,
        uint    value,
        bytes   memory data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(1), to, value, data);
    }

    // Special case for transactCall to support transfers on "bad" ERC20 tokens
    function transactTokenTransfer(
        address wallet,
        address token,
        address to,
        uint    amount
        )
        internal
    {
        if (token == address(0)) {
            transactCall(wallet, to, amount, "");
            return;
        }

        bytes memory txData = abi.encodeWithSelector(
            ERC20.transfer.selector,
            to,
            amount
        );
        bytes memory returnData = transactCall(wallet, token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        bool success = returnData.length == 0 ? true :  abi.decode(returnData, (bool));
        require(success, "ERC20_TRANSFER_FAILED");
    }

    // Special case for transactCall to support approvals on "bad" ERC20 tokens
    function transactTokenApprove(
        address wallet,
        address token,
        address spender,
        uint    amount
        )
        internal
    {
        require(token != address(0), "INVALID_TOKEN");
        bytes memory txData = abi.encodeWithSelector(
            ERC20.approve.selector,
            spender,
            amount
        );
        bytes memory returnData = transactCall(wallet, token, 0, txData);
        // `transactCall` will revert if the call was unsuccessful.
        // The only extra check we have to do is verify if the return value (if there is any) is correct.
        bool success = returnData.length == 0 ? true :  abi.decode(returnData, (bool));
        require(success, "ERC20_APPROVE_FAILED");
    }

    function transactDelegateCall(
        address wallet,
        address to,
        uint    value,
        bytes   calldata data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(2), to, value, data);
    }

    function transactStaticCall(
        address wallet,
        address to,
        bytes   calldata data
        )
        internal
        returns (bytes memory)
    {
        return Wallet(wallet).transact(uint8(3), to, 0, data);
    }

    function reimburseGasFee(
        address     wallet,
        address     recipient,
        address     gasToken,
        uint        gasPrice,
        uint        gasAmount
        )
        internal
    {
        uint gasCost = gasAmount.mul(gasPrice);

        quotaStore.checkAndAddToSpent(
            wallet,
            gasToken,
            gasAmount,
            priceOracle
        );

        transactTokenTransfer(wallet, gasToken, recipient, gasCost);
    }
}
