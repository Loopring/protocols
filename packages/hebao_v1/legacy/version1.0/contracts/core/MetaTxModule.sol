// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/AddressUtil.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/SignatureUtil.sol";

import "../../thirdparty/BytesUtil.sol";
import "../../thirdparty/ERC1271.sol";

import "../../iface/Wallet.sol";

import "../ControllerImpl.sol";

import "./BaseModule.sol";


/// @title MetaTxModule
/// @dev This is the base module for supporting meta-transactions.
///      A MetaTxModule will only relay transactions on itself, and the methods
///      relayed must as the target wallet address as its first argument, unless
///      the `extractWalletAddress` is overridden.
///
/// @author Daniel Wang - <daniel@loopring.org>
///
/// The design of this contract is inspired by Argent's contract codebase:
/// https://github.com/argentlabs/argent-contracts

abstract contract MetaTxModule is BaseModule
{
    using MathUint      for uint;
    using AddressUtil   for address;
    using SignatureUtil for bytes32;
    using BytesUtil     for bytes;

    struct WalletState
    {
        uint nonce;
        mapping (bytes32 => bool) metaTxHash;
    }

    struct GasSettings
    {
        address token;
        uint    price;
        uint    limit;
        uint    overhead;
        address recipient;
    }

    struct MetaTransaction
    {
        address wallet;
        address module;
        uint    value;
        bytes   data;
        uint    nonce;
        uint    validUntil;
        address gasToken;
        uint    gasPrice;
        uint    gasLimit;
        uint    gasOverhead;
        address feeRecipient;
    }

    bytes32 constant public METATRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(address wallet,address module,uint256 value,bytes data,uint256 nonce,uint256 validUntil,address gasToken,uint256 gasPrice,uint256 gasLimit,uint256 gasOverhead,address feeRecipient)"
    );

    bytes32      public DOMAIN_SEPARATOR;
    ControllerImpl public controller;

    mapping (address => WalletState) public wallets;

    event MetaTxExecuted(
        address indexed transactor,
        address indexed wallet,
        uint    nonce,
        bytes32 metaTxHash,
        uint    gasUsed,
        bool    success,
        bytes   returnData
    );

    modifier onlyFromMetaTx override
    {
        require(msg.sender == address(this), "NOT_FROM_THIS_MODULE");
        _;
    }

    constructor(ControllerImpl _controller)
        public
        BaseModule()
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("Loopring Wallet MetaTxModule", "1.0", address(this)));
        controller = _controller;
    }

    /* solium-disable-next-line */
    function quotaStore()
        internal
        view
        virtual
        returns (address)
    {
        return address(0);
    }

    function isWalletOwnerOrGuardian(address wallet, address addr)
        internal
        view
        returns (bool)
    {
        return Wallet(wallet).owner() == addr ||
            controller.securityStore().isGuardian(wallet, addr);
    }

    function isWalletOwnerOrGuardian(address wallet, address[] memory addrs)
        internal
        view
        returns (bool)
    {
        if (addrs.length == 0) return false;

        for (uint i = 0; i < addrs.length; i++) {
            if (!isWalletOwnerOrGuardian(wallet, addrs[i])) {
                return false;
            }
        }
        return true;
    }

    /// @dev Execute a signed meta transaction.
    ///      This method can be called by any relayer without restriction. The relayer
    ///      will pay for transaction gas in Ether and charge the wallet Ether or other
    ///      ERC20 tokens as fee. If gasPrice is set to 0, then the relayer won't charge
    ///      the wallet any fee.
    ///
    ///      Important! This function needs to be safe against re-entrancy by using
    ///      the 'Checks Effects Interactions' pattern! We do not use `nonReentrant`
    ///      because this function is used to call into the same contract.
    ///
    /// @param data The raw transaction to be performed on this module.
    /// @param nonce The nonce of this meta transaction. When nonce is 0, this module will
    ///              make sure the transaction's metaTxHash is unique; otherwise, the module
    ///              requires the nonce is greater than the last nonce used by the same
    ///              wallet, but not by more than `block.number * 2^128`.
    /// @param validUntil The expiry timestamp
    /// @param gasSetting A list that contains `gasToken` address, `gasPrice`, `gasLimit`,
    ///                   `gasOverhead` and `feeRecipient`. To pay fee in Ether, use address(0) as gasToken.
    ///                   To receive reimbursement at `msg.sender`, use address(0) as feeRecipient.
    /// @param signatures The signatures of the signers.
    /// @param signers The signers needed for the transaction.
    function executeMetaTx(
        bytes     memory data,
        uint      nonce,
        uint      validUntil,
        uint[5]   memory gasSetting, // [gasToken address][gasPrice][gasLimit][gasOverhead][feeRecipient]
        bytes[]   memory signatures,
        address[] memory signers
        )
        public
        payable
    {
        require(validUntil >= now, "EXPIRED");

        GasSettings memory gasSettings = GasSettings(
            address(gasSetting[0]),
            gasSetting[1],
            gasSetting[2],
            gasSetting[3],
            address(gasSetting[4])
        );
        require(gasSettings.limit > 0, "INVALID_GAS_LIMIT");
        require(gasSettings.recipient == controller.collectTo(), "INVALID_GAS_RECIPIENT");

        address wallet = extractWalletAddress(data);
        bytes32 metaTxHash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            hash(
                MetaTransaction(
                    wallet,
                    address(this),
                    msg.value,
                    data,
                    nonce,
                    validUntil,
                    gasSettings.token,
                    gasSettings.price,
                    gasSettings.limit,
                    gasSettings.overhead,
                    gasSettings.recipient
                )
            )
        );

        // Get the signers necessary for this meta transaction.
        require(checkSigners(wallet, data, signers), "METATX_UNAUTHORIZED");
        require(metaTxHash.verifySignatures(signers, signatures), "INVALID_SIGNATURES");

        // Mark the transaction as used before doing the call to guard against re-entrancy
        // (the only exploit possible here is that the transaction can be executed multiple times).
        saveExecutedMetaTx(wallet, nonce, metaTxHash);

        // Deposit msg.value to the wallet so it can be used from the wallet
        if (msg.value > 0) {
            wallet.sendETHAndVerify(msg.value, gasleft());
        }

        require(gasleft() >= (gasSettings.limit.mul(64) / 63).add(60000), "INSUFFICIENT_GAS");
        uint gasUsed = gasleft();
        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = address(this).call{gas: gasSettings.limit}(data);
        gasUsed = gasUsed - gasleft();
        // The gas amount measured could be a little bit higher because of the extra costs to do the call itself
        gasUsed = gasUsed < gasSettings.limit ? gasUsed : gasSettings.limit;

        emit MetaTxExecuted(msg.sender, wallet, nonce, metaTxHash, gasUsed, success, returnData);

        if (gasSettings.price != 0 && reimbursable(extractMethod(data))) {
            reimburseGasFee(wallet, gasSettings, gasUsed);
        }
    }

    /// @dev Returns the last nonce used by a wallet.
    /// @param wallet The wallet's address.
    /// @return Last nonce used.
    function lastNonce(address wallet)
        public
        view
        returns (uint)
    {
        return wallets[wallet].nonce;
    }

    /// @dev Collects tokens and ether owned by this module to a controlled address.
    /// @param tokens The list of tokens and ether to collect.
    function collectTokens(address[] calldata tokens)
        external
        nonReentrant
    {
        address to = controller.collectTo();

        for (uint i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) {
                uint amount = address(this).balance;
                to.sendETHAndVerify(amount, gasleft());
            } else {
                uint amount = ERC20(token).balanceOf(address(this));
                if (amount > 0) {
                    // Do not check the return value to support "bad" ERC20 tokens
                    ERC20(token).transfer(to, amount);
                }
            }
        }
    }

    // ---- internal functions -----

    /// @dev Validate the list of signers for the given meta transaction.
    ///      Additional validation of the signers can also be done inside this function.
    /// @param wallet The wallet address.
    /// @param method The method selector.
    /// @param data The call data.
    /// @param signers The list of addresses which have signed the meta transaction
    /// @return True if the list of signers are as expected, else False
    function verifySigners(
        address   wallet,
        bytes4    method,
        bytes     memory data,
        address[] memory signers
        )
        internal
        view
        virtual
        returns (bool);

    /// @dev Check if the specified signer is the only signer
    function isOnlySigner(address signer, address[] memory signers)
        internal
        pure
        virtual
        returns (bool)
    {
        return (signers.length == 1 && signers[0] == signer);
    }

    /* solium-disable-next-line */
    function reimbursable(bytes4 /*method*/)
        internal
        view
        virtual
        returns (bool)
    {
        return true;
    }

    /// @dev For all relayed method, the first parameter must be the wallet address.
    function extractWalletAddress(bytes memory data)
        internal
        view
        virtual
        returns (address wallet)
    {
        wallet = extractAddressFromCallData(data, 0);
    }

    /// @dev Returns the address stored in the call data
    ///      at the specified function parameter index.
    ///      Example: function bar(uint value, address signer, bytes data);
    ///               To extact `signer` use parameterIdx := 1
    function extractAddressFromCallData(
        bytes memory data,
        uint  parameterIdx
        )
        internal
        pure
        returns (address addr)
    {
        addr = data.toAddress(4 + 32 * parameterIdx + 12);
    }

    /// @dev Returns a read-only array with the addresses stored in the call data
    ///      at the specified function parameter index.
    ///      Example: function bar(address[] signers, uint value);
    ///               To extact `signers` use parameterIdx := 0
    ///      Example: function foo(address wallet, address[] signers, address[] contracts);
    ///               To extact `signers` use parameterIdx := 1
    ///               To extact `contracts` use parameterIdx := 2
    function extractAddressesFromCallData(
        bytes memory data,
        uint  parameterIdx
        )
        internal
        pure
        returns (address[] memory addresses)
    {
        // Find the offset of the function parameter in the call data
        uint dataOffset = data.toUint(4 + 32 * parameterIdx);
        // Make sure enough bytes are in data to store the complete array
        uint length = data.toUint(4 + dataOffset);
        require(data.length >= 4 + dataOffset + 32 * (1 + length), "INVALID_DATA");
        // Extract the signers by copying the pointer at the beginning of the array
        // An extra offset of 36 is applied: 32(length) + 4(sig)
        assembly { addresses := add(data, add(36, dataOffset)) }
    }

    function hash(MetaTransaction memory _tx)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                METATRANSACTION_TYPEHASH,
                _tx.wallet,
                _tx.module,
                _tx.value,
                keccak256(_tx.data),
                _tx.nonce,
                _tx.validUntil,
                _tx.gasToken,
                _tx.gasPrice,
                _tx.gasLimit,
                _tx.gasOverhead,
                _tx.feeRecipient
            )
        );
    }

    function extractMethod(bytes memory data)
        internal
        pure
        returns (bytes4 method)
    {
        return data.toBytes4(0);
    }

    function reimburseGasFee(
        address     wallet,
        GasSettings memory gasSettings,
        uint        gasUsed
        )
        private
    {
        uint gasCost = gasUsed.add(gasSettings.overhead).mul(gasSettings.price);
        updateQuota(wallet, gasSettings.token, gasCost);

        address feeRecipient = gasSettings.recipient;
        if (gasSettings.token == address(0)) {
            transactCall(wallet, feeRecipient, gasCost, "");
        } else {
            require(
                transactTokenTransfer(wallet, gasSettings.token, feeRecipient, gasCost),
                "TRANSFER_FAILED"
            );
        }
    }

    // ---- private functions -----

    function checkSigners(
        address   wallet,
        bytes     memory data,
        address[] memory signers
        )
        private
        view
        returns (bool)
    {
        bytes4 method = extractMethod(data);
        if (method == this.addModule.selector) {
            return isOnlySigner(Wallet(wallet).owner(), signers);
        } else {
            return verifySigners(wallet, method, data, signers);
        }
    }

    /// @dev Save the meta-transaction to history.
    ///      This method must throw if the transaction is not unique or the nonce is invalid.
    /// @param wallet The target wallet.
    /// @param nonce The nonce
    /// @param metaTxHash The signed hash of the transaction
    function saveExecutedMetaTx(
        address wallet,
        uint    nonce,
        bytes32 metaTxHash
        )
        private
    {
        if (nonce == 0) {
            require(!wallets[wallet].metaTxHash[metaTxHash], "INVALID_HASH");
            wallets[wallet].metaTxHash[metaTxHash] = true;
        } else {
            require(nonce > wallets[wallet].nonce, "NONCE_TOO_SMALL");
            require((nonce >> 128) <= (block.number), "NONCE_TOO_LARGE");
            wallets[wallet].nonce = nonce;
        }
    }

    function updateQuota(
        address wallet,
        address token,
        uint    amount
        )
        internal
    {
        if (amount > 0 && quotaStore() != address(0)) {
            uint value = controller.priceOracle().tokenValue(token, amount);
            QuotaStore(quotaStore()).checkAndAddToSpent(wallet, value);
        }
    }

    function tryToUpdateQuota(
        address wallet,
        address token,
        uint    amount
        )
        internal
        returns (bool)
    {
        if (quotaStore() != address(0)) {
            uint value = controller.priceOracle().tokenValue(token, amount);
            try QuotaStore(quotaStore()).checkAndAddToSpent(wallet, value) {
                return true;
            } catch Error(string memory /*reason*/) {
                return false;
            }
        } else {
            return true;
        }
    }
}
