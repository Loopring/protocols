// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "./AmmCommon.sol";
import "./AmmStatus.sol";
import "./AmmData.sol";
import "../../../lib/EIP712.sol";
import "../../../lib/ERC20SafeTransfer.sol";
import "../../../lib/MathUint.sol";
import "../../../lib/MathUint96.sol";
import "../../../thirdparty/SafeCast.sol";
import "../../../lib/SignatureUtil.sol";


/// @title AmmExitRequest
library AmmExitRequest
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;
    using AmmStatus         for AmmData.State;

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,bool toLayer2,uint256 poolAmountIn,uint256[] minAmountsOut,uint32[] storageIDs,uint256 validUntil)"
    );

    bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
        "Withdraw(address owner,uint256 poolAmount,uint256[] amounts,uint256 validUntil,uint256 nonce)"
    );

    function setLockedUntil(
        AmmData.State storage S,
        uint                  timestamp
        )
        public
    {
        if (timestamp > 0) {
            require(timestamp >= block.timestamp + AmmData.MIN_TIME_TO_UNLOCK(), "TOO_SOON");
        }
        S.lockedUntil[msg.sender] = timestamp;
    }

    function withdraw(
        AmmData.State storage S,
        uint                  poolAmount,
        uint[]       calldata amounts,
        uint                  validUntil,
        bytes        calldata signature
        )
        public
        returns (uint[] memory withdrawn)
    {
        require(amounts.length == S.tokens.length, "INVALID_DATA");

        // Check if we can withdraw without unlocking
        if (signature.length > 0) {
            require(validUntil >= block.timestamp, 'SIGNATURE_EXPIRED');
            bytes32 withdrawHash = EIP712.hashPacked(
                S.domainSeperator,
                keccak256(
                    abi.encode(
                        WITHDRAW_TYPEHASH,
                        msg.sender,
                        poolAmount,
                        keccak256(abi.encodePacked(amounts)),
                        validUntil,
                        S.nonces[msg.sender]++
                    )
                )
            );
            require(withdrawHash.verifySignature(S.exchange.owner(), signature), "INVALID_SIGNATURE");
        }

        // Withdraw any outstanding balances for the pool account on the exchange
        address[] memory owners = new address[](S.tokens.length);
        address[] memory tokenAddresses = new address[](S.tokens.length);

        for (uint i = 0; i < S.tokens.length; i++) {
            owners[i] = address(this);
            tokenAddresses[i] = S.tokens[i].addr;
        }
        S.exchange.withdrawFromApprovedWithdrawals(owners, tokenAddresses);

        // Withdraw
        withdrawn = new uint[](S.tokens.length + 1);
        // for (uint i = 0; i < S.tokens.length + 1; i++) {
        //     uint amount = (i < S.tokens.length) ? amounts[i] : poolAmount;
        //     address token = (i < S.tokens.length) ? S.tokens[i].addr : address(this);
        //     uint available = (signature.length > 0) ? S.lockedBalance[token][msg.sender] : S.availableBalance(token, msg.sender);
        //     if (amount > available) {
        //         withdrawn[i] = available;
        //     } else {
        //         withdrawn[i] = amount;
        //     }
        //     if (withdrawn[i] > 0) {
        //         S.lockedBalance[token][msg.sender] = S.lockedBalance[token][msg.sender].sub(withdrawn[i]);
        //         // TODO
        //         AmmCommon.tranferOut(token, withdrawn[i], msg.sender);
        //     }
        // }
    }

    function exitPool(
        AmmData.State storage S,
        uint                  poolAmountIn,
        uint96[]     calldata minAmountsOut,
        bool                  toLayer2
        )
        public
    {
        require(minAmountsOut.length == S.tokens.length, "INVALID_DATA");

        // To make the the available liqudity tokens cannot suddenly change
        // we keep track of when onchain exits (which need to be processed) are pending.
        require(S.isExiting[msg.sender] == false, "ALREADY_EXITING");
        S.isExiting[msg.sender] = true;

        // Approve the exit
        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            toLayer2: toLayer2,
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut,
            storageIDs: new uint32[](0),
            validUntil: 0xffffffff
        });
        bytes32 txHash = hashPoolExit(S.domainSeperator, exit);
        S.approvedTx[txHash] = block.timestamp;
    }

    function hashPoolExit(
        bytes32 _domainSeperator,
        AmmData.PoolExit memory exit
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            _domainSeperator,
            keccak256(
                abi.encode(
                    POOLEXIT_TYPEHASH,
                    exit.owner,
                    exit.toLayer2,
                    exit.poolAmountIn,
                    keccak256(abi.encodePacked(exit.minAmountsOut)),
                    keccak256(abi.encodePacked(exit.storageIDs)),
                    exit.validUntil
                )
            )
        );
    }
}
