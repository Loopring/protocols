// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.6.10;
pragma experimental ABIEncoderV2;

import "../../lib/MathUint.sol";
import "../../lib/Poseidon.sol";

import "../../iface/ExchangeData.sol";
import "../../iface/IBlockVerifier.sol";
import "../../iface/ILoopringV3.sol";

import "./ExchangeTokens.sol";


/// @title ExchangeGenesis.
/// @author Daniel Wang  - <daniel@loopring.org>
/// @author Brecht Devos - <brecht@loopring.org>
library ExchangeGenesis
{
    using ExchangeTokens    for ExchangeData.State;

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address _loopringAddress,
        address payable _operator,
        bool    _rollupMode,
        bytes32 _emptyMerkleRoot,
        uint    _accountTreeDepth,
        bytes32 _domainSeperator
        )
        external
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(_emptyMerkleRoot != 0, "ZERO_GENESIS_MERKLE_ROOT");
        require(_accountTreeDepth != 0, "ZERO_GENESIS_MERKLE_ROOT");
        require(S.id == 0, "INITIALIZED_ALREADY");

        S.id = _id;
        S.exchangeCreationTimestamp = now;
        S.operator = _operator;
        S.rollupMode = _rollupMode;
        S.maxAgeDepositUntilWithdrawable = ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND();
        S.emptyMerkleRoot = _emptyMerkleRoot;
        S.accountTreeDepth = _accountTreeDepth;
        S.DOMAIN_SEPARATOR = _domainSeperator;

        ILoopringV3 loopring = ILoopringV3(_loopringAddress);
        S.loopring = loopring;
        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());

        S.merkleRoot = S.emptyMerkleRoot;
        S.blocks.push(ExchangeData.BlockInfo(bytes32(0)));

        // Get the protocol fees for this exchange
        S.protocolFeeData.syncedAt = uint32(0);
        S.protocolFeeData.takerFeeBips = S.loopring.maxProtocolTakerFeeBips();
        S.protocolFeeData.makerFeeBips = S.loopring.maxProtocolMakerFeeBips();
        S.protocolFeeData.previousTakerFeeBips = S.protocolFeeData.takerFeeBips;
        S.protocolFeeData.previousMakerFeeBips = S.protocolFeeData.makerFeeBips;

        // Call these after the main state has been set up
        S.registerToken(address(0));
        S.registerToken(loopring.lrcAddress());
    }

    function growMerkleTree(
        ExchangeData.State storage S
        )
        external
    {
        // TODO(daniel): also checks verification keys are there.
        require(S.accountTreeDepth < 16, "MAX_TREE_SIZE_REACHED");
        S.accountTreeDepth += 1;

        S.merkleRoot = hashImpl(
            S.merkleRoot, S.emptyMerkleRoot, S.emptyMerkleRoot, S.emptyMerkleRoot
        );

        S.emptyMerkleRoot = hashImpl(
            S.emptyMerkleRoot, S.emptyMerkleRoot, S.emptyMerkleRoot, S.emptyMerkleRoot
        );
    }

    function hashImpl(
        bytes32 t0,
        bytes32 t1,
        bytes32 t2,
        bytes32 t3
        )
        private
        pure
        returns (bytes32)
    {
        Poseidon.HashInputs5 memory inputs = Poseidon.HashInputs5(
            uint(t0), uint(t1), uint(t2), uint(t3), 0
        );
        return bytes32(Poseidon.hash_t5f6p52(
            inputs,
            ExchangeData.SNARK_SCALAR_FIELD()
        ));
    }

}