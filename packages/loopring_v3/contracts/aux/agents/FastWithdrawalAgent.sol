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


/// @title Fast withdrawal agent implementation. The fast withdrawal request reduces to
///        a normal onchain withdrawal request after a specified time limit has exceeded.
///
///        Fast withdrawals are a way for the owner to provide instant withdrawals for
///        users with the help of a liquidity provider and conditional transfers.
///
///        A fast withdrawal requires the non-trustless cooperation of 2 parties:
///        - A liquidity provider which provides funds to users immediately onchain
///        - The operator which will make sure the user has sufficient funds offchain
///          so that the liquidity provider can be paid back offchain using a conditional transfer.
///          The operator also needs to process those conditional transfers so that the
///          liquidity provider receives its funds back in its own account where it
///          again has full custody over it.
///
///        However, there is a special case when the fast withdrawal reduces to a standard
///        withdrawal and the fee is paid onchain. In this case the withdrawal can be
///        done completely trustless, no cooperation with the owner is needed.
///
///        We require the fast withdrawals to be executed by the liquidity provider (as msg.sender)
///        so that the liquidity provider can impose its own rules on how its funds are spent. This will
///        inevitably need to be done in close cooperation with the operator, or by the operator
///        itself using a smart contract where the liquidity provider enforces who, how
///        and even if their funds can be used to facilitate the fast withdrawals.
///
///        Any one can call `execute` with the approvals from liquidity providers to provide users
///        immediately with funds onchain. This allows the security of the funds to be handled
///        by any EOA or smart contract.
///
///        Fast withdrawal recipients (the users) can even create duplicate `execute` transactions
///        with higher gas price to accelerate pending fast withdrawal transactions using their own
///        funds. Therefore, Loopring's implementation of fast withdrawals involves two seperate
///        steps, one by he liquidity provider, one by the user himself (or anyone who are willing
///        to help the user).
///
///        Users that want to make use of this functionality have to
///        authorize this contract as their agent.
///
/// @author Brecht Devos - <brecht@loopring.org>
contract FastWithdrawalAgent is ReentrancyGuard
{
    using AddressUtil       for address;
    using AddressUtil       for address payable;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using SignatureUtil     for bytes32;

    enum Status {
        SUCCEEDED,
        FRONTRUN,
        EXPIRED,
        TOO_LATE
    }

    event Processed(bytes32 hash, Status status);

    struct FastWithdrawalApproval
    {
        address exchange;
        address from;                   // The owner of the account
        address to;                     // The address that will receive the tokens withdrawn
        address token;
        uint96  amount;
        uint32  storageID;
        int     validUntil; // seconds since epoch or block (if < 0)
        address provider;
        bytes   signature; // provider's signature
    }

    bytes32 constant public FASTWITHDRAWAL_APPROVAL_TYPEHASH = keccak256(
        "FastWithdrawalApproval(address exchange,address from,address to,address token,uint96 amount,uint32 storageID,int256 validUntil)"
    );

    bytes32 public DOMAIN_SEPARATOR;

    mapping(bytes32 => bool) consumedApprovals;

    constructor()
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalAgent", "1.0", address(this)));
    }

    function execute(FastWithdrawalApproval memory fwa)
        external
        nonReentrant
        payable
    {
        execute_(fwa);
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    function execute(FastWithdrawalApproval[] memory fwas)
        external
        nonReentrant
        payable
    {
        for (uint i = 0; i < fwas.length; i++) {
            execute_(fwas[i]);
        }
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    // -- Internal --

    function execute_(FastWithdrawalApproval memory fwa)
        internal
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

        if (consumedApprovals[hash]) {
            emit Processed(hash, Status.FRONTRUN);
            return;
        }

        consumedApprovals[hash] = true;

        // Return if expired.
        if (fwa.validUntil >= 0) {
            if (block.timestamp < uint(fwa.validUntil)) {
                emit Processed(hash, Status.EXPIRED);
                return;
            }
        } else {
            if (block.number < uint(-fwa.validUntil)) {
                emit Processed(hash, Status.EXPIRED);
                return;
            }
        }

        IExchangeV3 exchange = IExchangeV3(fwa.exchange);

        address recipient = exchange.getWithdrawalRecipient(
            fwa.from,
            fwa.to,
            fwa.token,
            fwa.amount,
            fwa.storageID
        );

        if (recipient != address(0)) {
            emit Processed(hash, Status.TOO_LATE);
            return;
        }

        exchange.setWithdrawalRecipient(
            fwa.from,
            fwa.to,
            fwa.token,
            fwa.amount,
            fwa.storageID,
            fwa.provider
        );

        // Transfer the tokens immediately to the requested address
        // using funds from the liquidity provider (`msg.sender`).
        transfer(
            fwa.provider,
            fwa.to,
            fwa.token,
            fwa.amount
        );

        emit Processed(hash, Status.SUCCEEDED);
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
}
