// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../agents/FastWithdrawalAgent.sol";
import "../../lib/OwnerManagable.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/SignatureUtil.sol";
import "../../lib/TransferUtil.sol";


/// @title Basic contract storing funds for a liquidity provider.
/// @author Brecht Devos - <brecht@loopring.org>
contract FastWithdrawalLiquidityProvider is ReentrancyGuard, OwnerManagable
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;
    using TransferUtil      for address;

    struct FastWithdrawalApproval
    {
        address exchange;
        address from;
        address to;
        address token;
        uint96  amount;
        uint32  storageID;
        uint64  validUntil; // most significant 32 bits as block height, least significant 32 bits as block time
        address signer;
        bytes   signature;  // signer's signature
    }

    bytes32 constant public FASTWITHDRAWAL_APPROVAL_TYPEHASH = keccak256(
        "FastWithdrawalApproval(address exchange,address from,address to,address token,uint96 amount,uint32 storageID,uint64 validUntil)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;

    FastWithdrawalAgent public immutable agent;

    constructor(FastWithdrawalAgent _agent)
    {
        agent = _agent;
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalLiquidityProvider", "1.0", address(this)));
    }

    // Execute the fast withdrawals.
    // Full approvals are posted onchain so they can be used by anyone to speed up the
    // withdrawal by calling , but the approvals are not validated when done by the
    // owner or one of the managers.
    function execute(FastWithdrawalApproval[] calldata approvals)
        external
        nonReentrant
    {
        // Prepare the data and validate the approvals when necessary
        FastWithdrawalAgent.Withdrawal[] memory withdrawals =
            new FastWithdrawalAgent.Withdrawal[](approvals.length);

        bool skipApprovalCheck = isManager(msg.sender);
        for (uint i = 0; i < approvals.length; i++) {
            require(skipApprovalCheck || isApprovalValid(approvals[i]), "PROHIBITED");
            withdrawals[i] = translate(approvals[i]);
        }

        // Calculate how much ETH we need to send to the agent contract.
        // We could also send the full ETH balance each time, but that'll need
        // an additional transfer to send funds back, which may actually be more efficient.
        uint value = 0;
        for (uint i = 0; i < withdrawals.length; i++) {
            if (withdrawals[i].token == address(0)) {
                value = value.add(withdrawals[i].amount);
            }
        }
        // Execute all the fast withdrawals
        agent.executeFastWithdrawals{value: value}(withdrawals);
    }

    // Allows the LP to transfer funds back out of this contract.
    function drain(
        address to,
        address token,
        uint    amount
        )
        external
        nonReentrant
        onlyOwner
    {
        token.transferOut(to, amount);
    }

    // Allows the LP to enable the necessary ERC20 approvals
    function approve(
        address token,
        address spender,
        uint    amount
        )
        external
        nonReentrant
        onlyOwner
    {
        require(ERC20(token).approve(spender, amount), "APPROVAL_FAILED");
    }

    function isApprovalValid(
        FastWithdrawalApproval calldata approval
        )
        internal
        view
        returns (bool)
    {
        // Compute the hash
        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encodePacked(
                    FASTWITHDRAWAL_APPROVAL_TYPEHASH,
                    approval.exchange,
                    approval.from,
                    approval.to,
                    approval.token,
                    approval.amount,
                    approval.storageID,
                    approval.validUntil
                )
            )
        );

        return hash.verifySignature(approval.signer, approval.signature) &&
            checkValidUntil(approval.validUntil) &&
            isManager(approval.signer);
    }

    receive() payable external {}

    // -- Internal --

    function checkValidUntil(uint64 validUntil)
        internal
        view
        returns (bool)
    {
        return (validUntil & 0xFFFFFFFF) >= block.timestamp ||
            (validUntil >> 32) >= block.number;
    }

    function translate(FastWithdrawalApproval calldata approval)
        internal
        pure
        returns (FastWithdrawalAgent.Withdrawal memory)
    {
        return FastWithdrawalAgent.Withdrawal({
            exchange: approval.exchange,
            from: approval.from,
            to: approval.to,
            token: approval.token,
            amount: approval.amount,
            storageID: approval.storageID
        });
    }
}