// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../lib/EIP712.sol";
import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/MathUint96.sol";
import "../../thirdparty/SafeCast.sol";
import "./AmmData.sol";
import "./AmmUtil.sol";


/// @title AmmJoinRequest
library AmmJoinRequest
{
    using ERC20SafeTransfer for address;
    using MathUint          for uint;
    using MathUint96        for uint96;
    using SafeCast          for uint;

    bytes32 constant public POOLJOIN_TYPEHASH = keccak256(
        "PoolJoin(address owner,bool fromLayer2,uint256 minPoolAmountOut,uint256[] maxAmountsIn,uint32[] storageIDs,uint256 validUntil)"
    );

    event Deposit(address owner, uint96[] amounts);
    event PoolJoinRequested(AmmData.PoolJoin join);

    function depositToPool(
        AmmData.State storage S,
        uint96[]     calldata amounts
        )
        public
    {
        uint size = S.tokens.length;
        require(amounts.length == size + 1, "INVALID_DATA");

        // TODO(daniel): fiture this out:
        /*
        An exit depends on how many liquidity tokens the user has locked up, so we need
        this to keep the locked up balance the same while we are processing the exit.
        Otherwise the user may have done an exit with poolAmount == 100, but only
        locked up 50. Then we are processing the exit, create a block + proof, but
        in the meantime the user could have deposited additional tokens which would
        make how we process the block invalid. We also cannot just partially process
        the exit when additional funds are available, because then we could censor
        exits and lock up user funds in the pool.

        We also cannot check how many liquidity tokens the user has when calling
        exitPool and reserve them (we could check the balance, but that doesn't mean
         they will still be there when we actually process it). This could also suddenly
          change how we need to process a block while we could already have been
          building a block. Scenario:

        A user requests an offchain exit with `poolAmount == 100
        We see that the user indeed has 100 liquidity tokens locked up so we start
        to process it.
        The user now calls exitPool to force the operator to do the exit.
        Onchain we see that the user has 100 liquidity tokens, but if we would
        reserve them for the onchain request the offchain request we are already
        processing will be rendered invalid.
        So what we want to do here is still do the offchain request that we are
        already doing, and then process the onchain request with any remaining
        liquidity tokens that are still locked up. But the remaining locked amount
        needs to remain the same, otherwise the processing of the onchain request
        is not deterministic.
        */
        if (S.isExiting[msg.sender]) {
            // This could suddenly change the amount of liquidity tokens available, which
            // could change how the operator needs to process the exit.
            require(amounts[0] == 0, "CANNOT_DEPOSIT_LIQUIDITY_TOKENS_WHILE_EXITING");
        }

        S.lockedUntil[msg.sender] = 0;

        // Deposit pool tokens
        _depositToken(S, address(this), amounts[0]);

        // Deposit AMM tokens
        for (uint i = 0; i < size; i++) {
            _depositToken(S, S.tokens[i].addr, amounts[i + 1]);
        }

        emit Deposit(msg.sender, amounts);
    }

    function joinPool(
        AmmData.State storage S,
        uint                  minPoolAmountOut,
        uint96[]     calldata maxAmountsIn,
        bool                  fromLayer2,
        uint96                fee,
        uint                  validUntil
        )
        public
        returns(AmmData.PoolJoin memory join)
    {
        require(fee == 0, "DISABLED_FOR_NOW");

        uint size =  S.tokens.length;
        require(maxAmountsIn.length == size, "INVALID_DATA");

        for (uint i = 0; i < size; i++) {
            require(maxAmountsIn[i] > 0, "INVALID_JOIN_AMOUNT");
        }

        // Don't check the available funds here, if the operator isn't sure the funds
        // are locked this transaction can simply be dropped.

        join = AmmData.PoolJoin({
            owner: msg.sender,
            fromLayer2: fromLayer2,
            minPoolAmountOut: minPoolAmountOut,
            maxAmountsIn: maxAmountsIn,
            storageIDs: new uint32[](0),
            validUntil: validUntil,
            fee: fee
        });

        // Approve the join
        bytes32 txHash = hashPoolJoin(S.domainSeparator, join);
        S.approvedTx[txHash] = 0xffffffff;

        emit PoolJoinRequested(join);
    }

    function hashPoolJoin(
        bytes32                 domainSeparator,
        AmmData.PoolJoin memory join
        )
        internal
        pure
        returns (bytes32)
    {
        return EIP712.hashPacked(
            domainSeparator,
            keccak256(
                abi.encode(
                    POOLJOIN_TYPEHASH,
                    join.owner,
                    join.fromLayer2,
                    join.minPoolAmountOut,
                    keccak256(abi.encodePacked(join.maxAmountsIn)),
                    keccak256(abi.encodePacked(join.storageIDs)),
                    join.validUntil
                )
            )
        );
    }

    function _depositToken(
        AmmData.State storage S,
        address               token,
        uint                  amount
        )
        private
    {
        if (token == address(0)) {
            require(msg.value == amount, "INVALID_ETH_DEPOSIT");
        } else if (amount > 0) {
            token.safeTransferFromAndVerify(msg.sender, address(this), amount);
        }

        if (amount > 0) {
            S.lockedBalance[token][msg.sender] = S.lockedBalance[token][msg.sender].add(amount);
            S.totalLockedBalance[token] = S.totalLockedBalance[token].add(amount);
        }
    }
}
