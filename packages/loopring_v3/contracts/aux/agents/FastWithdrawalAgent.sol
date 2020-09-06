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
///        The liquidity provider can call `executeFastWithdrawals` to provide users
///        immediately with funds onchain. This allows the security of the funds to be handled
///        by any EOA or smart contract.
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
        ACCELERATED,
        FRONTRUN,
        TOO_LATE,
        UNKNOWN_FAILURE
    }

    event Processed(bytes32 hash, Status status);

    struct FastWithdrawal
    {
        address exchange;
        address from;                   // The owner of the account
        address to;                     // The address that will receive the tokens withdrawn
        address token;
        uint96  amount;
        uint32  storageID;

        address provider;
        int     validUntil; // seconds since epoch or block (if < 0)
        bytes   signature; // provider's signature
    }

    bytes32 constant public FASTWITHDRAWAL_TYPEHASH = keccak256(
        "FastWithdrawal(address exchange,address from,address to,address token,uint96 amount,uint32 storageID,address provider,int256 validUntil)"
    );

    bytes32 public DOMAIN_SEPARATOR;

    constructor()
    {
        DOMAIN_SEPARATOR = EIP712.hash(EIP712.Domain("FastWithdrawalAgent", "1.0", address(this)));
    }

    function executeFastWithdrawals(FastWithdrawal memory fastWithdrawal)
        external
        nonReentrant
        payable
    {
        executeFastWithdrawal_(fastWithdrawal);
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    function executeFastWithdrawals(FastWithdrawal[] memory fastWithdrawals)
        external
        nonReentrant
        payable
    {
        for (uint i = 0; i < fastWithdrawals.length; i++) {
            executeFastWithdrawal_(fastWithdrawals[i]);
        }
        msg.sender.sendETHAndVerify(address(this).balance, gasleft());
    }

    // -- Internal --

    function executeFastWithdrawal_(FastWithdrawal memory fastWithdrawal)
        internal
    {
        require(
            fastWithdrawal.exchange != address(0) &&
            fastWithdrawal.from != address(0) &&
            fastWithdrawal.to != address(0),
            "INVALID_WITHDRAWAL"
        );
        // Compute the hash
        bytes32 hash = EIP712.hashPacked(
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encodePacked(
                    FASTWITHDRAWAL_TYPEHASH,
                    fastWithdrawal.exchange,
                    fastWithdrawal.from,
                    fastWithdrawal.to,
                    fastWithdrawal.token,
                    fastWithdrawal.amount,
                    fastWithdrawal.storageID,
                    fastWithdrawal.provider,
                    fastWithdrawal.validUntil
                )
            )
        );

        // Check the signature
        require(
            hash.verifySignature(
                fastWithdrawal.provider,
                fastWithdrawal.signature
            ),
            "INVALID_SIGNATURE"
        );

        if (fastWithdrawal.validUntil >= 0) {
            if (block.timestamp < uint(fastWithdrawal.validUntil)) {
                emit Processed(hash, Status.TOO_LATE);
                return;
            }
        } else {
            if (block.number < uint(-fastWithdrawal.validUntil)) {
                emit Processed(hash, Status.TOO_LATE);
                return;
            }
        }

        IExchangeV3 exchange = IExchangeV3(fastWithdrawal.exchange);

        address recipient = exchange.getWithdrawalRecipient(
            fastWithdrawal.from,
            fastWithdrawal.to,
            fastWithdrawal.token,
            fastWithdrawal.amount,
            fastWithdrawal.storageID
        );

        if (recipient == fastWithdrawal.provider) {
            emit Processed(hash, Status.ACCELERATED);
            return;
        } else if (recipient == fastWithdrawal.to) {
            emit Processed(hash, Status.FRONTRUN);
            return;
        } else if (recipient != address(0)) {
            emit Processed(hash, Status.UNKNOWN_FAILURE);
            return;
        }

        exchange.setWithdrawalRecipient(
            fastWithdrawal.from,
            fastWithdrawal.to,
            fastWithdrawal.token,
            fastWithdrawal.amount,
            fastWithdrawal.storageID,
            fastWithdrawal.provider
        );

        // Transfer the tokens immediately to the requested address
        // using funds from the liquidity provider (`msg.sender`).
        transfer(
            fastWithdrawal.provider,
            fastWithdrawal.to,
            fastWithdrawal.token,
            fastWithdrawal.amount
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
