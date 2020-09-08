// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../core/iface/IExchangeV3.sol";
import "../../lib/Claimable.sol";
import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ReentrancyGuard.sol";
import "../../lib/SignatureUtil.sol";


/// @title Fast withdrawal agent implementation.
///        With the help of liquidity providers (LPs), exchange operators can convert any
///        normal withdrawals into fast withdrawals. This design, however, requires LPs
///        to trust the exchange operators for providing real user withdrawal information.
///
///        LPs can send transactions to tranfer Ether/tokens to exchange users with valid
///        FastWithdrawalApprovals. These users can also send overriding transactions with
///        the same FastWithdrawalApprovals using a higher gas price to further accelerate
///        the incoming transfers.
///
///        Users that want to make use of this functionality have to authorize this contract
///        as their agent.
///
/// @author Brecht Devos - <brecht@loopring.org>
/// @author Kongliang Zhong - <kongliang@loopring.org>
/// @author Daniel Wang - <daniel@loopring.org>
contract FastWithdrawalAgent is ReentrancyGuard
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using SignatureUtil     for bytes32;

    enum Status {
        SUCCEEDED,
        FRONTRUN,
        EXPIRED,
        TOO_LATE
    }

    event Processed(
        address exchange,
        address from,
        address to,
        address token,
        uint96  amount,
        address provider,
        address transactor,
        Status  status
    );

    struct FastWithdrawalApproval
    {
        address exchange;
        address from;                   // The owner of the account
        address to;                     // The address that will receive the tokens withdrawn
        address token;
        uint96  amount;
        uint32  storageID;
        uint64  validUntil; // most significant 32 bits as block height, least significant 32 bits as block time
        address provider;
        bytes   signature; // provider's signature
    }

    bytes32 constant public FASTWITHDRAWAL_APPROVAL_TYPEHASH = keccak256(
        "FastWithdrawalApproval(address exchange,address from,address to,address token,uint96 amount,uint32 storageID,uint64 validUntil)"
    );

    bytes32 public DOMAIN_SEPARATOR;

    constructor()
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalAgent", "1.0", address(this)));
    }

    function execute(FastWithdrawalApproval memory fwa)
        external
        nonReentrant
        payable
    {
        Status status = execute_(fwa);
        emit Processed(
            fwa.exchange,
            fwa.from,
            fwa.to,
            fwa.token,
            fwa.amount,
            fwa.provider,
            msg.sender,
            status
        );

        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    function execute(FastWithdrawalApproval[] memory fwas)
        external
        nonReentrant
        payable
    {
        Status status;
        for (uint i = 0; i < fwas.length; i++) {
            status = execute_(fwas[i]);
            emit Processed(
                fwas[i].exchange,
                fwas[i].from,
                fwas[i].to,
                fwas[i].token,
                fwas[i].amount,
                fwas[i].provider,
                msg.sender,
                status
            );
        }
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    // -- Internal --

    function execute_(FastWithdrawalApproval memory fwa)
        internal
        returns (Status)
    {
        require(
            fwa.exchange != address(0) &&
            fwa.from != address(0) &&
            fwa.to != address(0) &&
            fwa.amount != 0,
            "INVALID_WITHDRAWAL"
        );

        // Compute the hash
        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encodePacked(
                    FASTWITHDRAWAL_APPROVAL_TYPEHASH,
                    fwa.exchange,
                    fwa.from,
                    fwa.to,
                    fwa.token,
                    fwa.amount,
                    fwa.storageID,
                    fwa.validUntil
                )
            )
        );

        // Check the signature
        require(hash.verifySignature(fwa.provider, fwa.signature ), "INVALID_SIGNATURE");
        require(checkValidUntil(fwa.validUntil), "FASTWITHDRAWAL_APPROVAL_EXPIRED");

        try IExchangeV3(fwa.exchange).setWithdrawalRecipient(
            fwa.from,
            fwa.to,
            fwa.token,
            fwa.amount,
            fwa.storageID,
            fwa.provider
        ) {} catch {
            return Status.TOO_LATE;
        }
        // Transfer the tokens immediately to the requested address
        // using funds from the liquidity provider (`msg.sender`).
        transfer(
            fwa.provider,
            fwa.to,
            fwa.token,
            fwa.amount
        );

        return Status.SUCCEEDED;
    }

    function transfer(
        address from,
        address to,
        address token,
        uint    amount
        )
        internal
    {
        if (amount > 0) {
            if (token == address(0)) {
                to.sendETHAndVerify(amount, gasleft()); // ETH
            } else {
                token.safeTransferFromAndVerify(from, to, amount);  // ERC20 token
            }
        }
    }

    function checkValidUntil(uint64 validUntil)
        internal
        view
        returns (bool)
    {
        return (validUntil & 0xFFFFFFFF) >= block.timestamp ||
            (validUntil >> 32) >= block.number;
    }
}
