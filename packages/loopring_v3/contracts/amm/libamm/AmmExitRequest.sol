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
        "PoolExit(address owner,bool toLayer2,uint256 poolAmountIn,uint256[] minAmountsOut,uint32[] storageIDs,uint256 validUntil)"
    );

    event Withdrawal(address owner, uint[] amountOuts);
    event PoolExitRequested(AmmData.PoolExit exit);
    event UnlockScheduled(address owner, uint timestamp);

    function unlock(AmmData.State storage S)
        internal
        returns (uint lockedUntil)
    {
        require(S.lockedUntil[msg.sender] == 0, "UNLOCKED_ALREADY");
        require(S.lockedSince[msg.sender] >= block.timestamp, "LOCK_PENDING");

        lockedUntil = block.timestamp + AmmData.LOCK_DELAY();

        S.lockedSince[msg.sender] = 0;
        S.lockedUntil[msg.sender] = lockedUntil;

        emit UnlockScheduled(msg.sender, lockedUntil);
    }

    function withdrawFromPool(
        AmmData.State storage S,
        uint[]       calldata amounts,
        bytes        calldata signature, // signature from Exchange operator
        uint                  validUntil
        )
        public
        returns (uint[] memory amountOuts)
    {
        uint size = S.tokens.length;
        require(amounts.length == size + 1, "INVALID_DATA");

        _proxcessExchangeWithdrawalApprovedWithdrawals(S);

        bool approvedByOperator = _checkOperatorApproval(
            S, amounts, signature, validUntil
        );

        amountOuts = new uint[](size + 1);
        amountOuts[0] = _withdrawToken(
            S, address(this), amounts[0], approvedByOperator
        );

        for (uint i = 0; i < size; i++) {
            amountOuts[i + 1] = _withdrawToken(
                S, S.tokens[i].addr, amounts[i + 1], approvedByOperator
            );
        }

        emit Withdrawal(msg.sender, amountOuts);
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
        require(toLayer2 || S.layer1ExitEnabled, "EXIT_TO_LAYER1_DISABLED");

        // To make the the available liqudity tokens cannot suddenly change
        // we keep track of when onchain exits (which need to be processed) are pending.
        require(S.isExiting[msg.sender] == false, "ALREADY_EXITING");
        S.isExiting[msg.sender] = true;

        AmmData.PoolExit memory exit = AmmData.PoolExit({
            owner: msg.sender,
            toLayer2: toLayer2,
            poolAmountIn: poolAmountIn,
            minAmountsOut: minAmountsOut,
            storageIDs: new uint32[](0),
            validUntil: 0xffffffff
        });

        // Approve the exit
        bytes32 txHash = hashPoolExit(S.domainSeparator, exit);
        S.approvedTx[txHash] = block.timestamp;

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
                    exit.toLayer2,
                    exit.poolAmountIn,
                    keccak256(abi.encodePacked(exit.minAmountsOut)),
                    keccak256(abi.encodePacked(exit.storageIDs)),
                    exit.validUntil
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

    function _withdrawToken(
        AmmData.State storage S,
        address               token,
        uint                  amount,
        bool                  approvedByOperator
        )
        private
        returns (uint withdrawn)
    {
        uint available = approvedByOperator ?
            S.userBalance[token][msg.sender] :
            S.availableBalance(token, msg.sender);

        withdrawn = (amount > available) ? available : amount;

        if (withdrawn > 0) {
            S.removeUserBalance(token, msg.sender, withdrawn);
            AmmUtil.tranferOut(token, withdrawn, msg.sender);
        }
    }

    // Withdraw any outstanding balances for the pool account on the exchange
    function _proxcessExchangeWithdrawalApprovedWithdrawals(AmmData.State storage S)
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
