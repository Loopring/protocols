// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../lib/SignatureUtil.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmStatus.sol";
import "./AmmUtil.sol";


/// @title AmmExitRequest
library AmmExitRequest
{
    using AmmStatus         for AmmData.State;
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;
    using SignatureUtil     for bytes32;

    bytes32 constant public WITHDRAW_TYPEHASH = keccak256(
        "Withdraw(address owner,uint256[] amounts,uint256 validUntil,uint256 nonce)"
    );

    bytes32 constant public POOLEXIT_TYPEHASH = keccak256(
        "PoolExit(address owner,uint256 poolAmountIn,uint256[] minAmountsOut,uint256 validUntil,bool exitToLayer2,burnFromLayer2,uint32 storageID)"
    );

    event PoolExitRequested(AmmData.PoolExit exit);

    function exitPool(
        AmmData.State storage S,
        uint                  poolAmountIn,
        uint96[]     calldata minAmountsOut,
        bool                  exitToLayer2,
        bool                  burnFromLayer2,
        uint32                storageID
        )
        public
    {
        require(minAmountsOut.length == S.tokens.length, "INVALID_DATA");
        require(burnFromLayer2 || storageID == 0, "INVALID_STORAGE_ID");

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut,
            validUntil: 0xffffffff,
            exitToLayer2: exitToLayer2,
            burnFromLayer2: burnFromLayer2,
            storageID: storageID
        });

        // Approve the exit
        bytes32 txHash = hashPoolExit(S.domainSeparator, exit);
        S.approvedTx[txHash] = block.timestamp;

        if (!burnFromLayer2) {
            AmmUtil.transferIn(address(this), poolAmountIn);
        }

        emit PoolExitRequested(exit);
    }

    function hashPoolExit(
        bytes32                 domainSeparator,
        AmmData.PoolExit memory exit
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLEXIT_TYPEHASH,
                    exit.owner,
                    exit.poolAmountIn,
                    keccak256(abi.encodePacked(exit.minAmountsOut)),
                    exit.validUntil,
                    exit.exitToLayer2,
                    exit.burnFromLayer2,
                    exit.storageID
                )
            )
        );
    }

    function _checkOperatorApproval(
        AmmData.State storage S,
        uint[]       calldata amounts,
        bytes        calldata signature, // signature from Exchange operator
        uint                  validUntil
        )
        private
        returns (bool)
    {
        // Check if we can withdraw without unlocking with an approval
        // from the operator.
        if (signature.length == 0) {
            require(validUntil == 0, "INVALID_VALUE");
            return false;
        }

        require(validUntil >= block.timestamp, 'SIGNATURE_EXPIRED');

        bytes32 withdrawHash = EIP712.hashPacked(
            S.domainSeparator,
            keccak256(
                abi.encode(
                    WITHDRAW_TYPEHASH,
                    msg.sender,
                    keccak256(abi.encodePacked(amounts)),
                    validUntil,
                    S.nonces[msg.sender]++
                )
            )
        );
        require(
            withdrawHash.verifySignature(S.exchange.owner(), signature),
            "INVALID_SIGNATURE"
        );
        return true;
    }

    // Withdraw any outstanding balances for the pool account on the exchange
    function _processTokenWithdrawalApprovedWithdrawals(AmmData.State storage S)
        private
    {
        uint size = S.tokens.length;
        address[] memory owners = new address[](size);
        address[] memory tokenAddresses = new address[](size);

        for (uint i = 0; i < size; i++) {
            owners[i] = address(this);
            tokenAddresses[i] = S.tokens[i].addr;
        }
        S.exchange.withdrawFromApprovedWithdrawals(owners, tokenAddresses);
    }
}
