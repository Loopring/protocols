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

    uint public constant MAX_ACCOUNT_TREE_DEPTH = 16;

    function initializeGenesisBlock(
        ExchangeData.State storage S,
        uint    _id,
        address _loopringAddress,
        address payable _operator,
        bool    _rollupMode,
        bytes32 _genesisMerkleRoot,
        uint    _genesisAccountTreeDepth,
        bytes32 _domainSeperator
        )
        external
    {
        require(0 != _id, "INVALID_ID");
        require(address(0) != _loopringAddress, "ZERO_ADDRESS");
        require(address(0) != _operator, "ZERO_ADDRESS");
        require(_genesisMerkleRoot != 0, "ZERO_GENESIS_MERKLE_ROOT");
        require(
            _genesisAccountTreeDepth != 0 &&
            _genesisAccountTreeDepth <= MAX_ACCOUNT_TREE_DEPTH,
            "INVALID_GENESIS_ACCOUNT_TREE_DEPTH"
        );

        require(S.id == 0, "INITIALIZED_ALREADY");

        S.id = _id;
        S.exchangeCreationTimestamp = now;
        S.operator = _operator;
        S.rollupMode = _rollupMode;
        S.maxAgeDepositUntilWithdrawable = ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND();
        S.emptyMerkleRoot = _genesisMerkleRoot;
        S.accountTreeDepth = _genesisAccountTreeDepth;
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

    function increaseAccountCapacity(
        ExchangeData.State storage S
        )
        external
    {
        require(S.accountTreeDepth < MAX_ACCOUNT_TREE_DEPTH, "MAX_TREE_SIZE_REACHED");
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