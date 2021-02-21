// SPDX-License-Identifier: Apache-2.0
// Copyright 2017 Loopring Technology Limited.
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "../../../lib/MathUint.sol";
import "../../iface/ExchangeData.sol";
import "../../iface/IAgentRegistry.sol";
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
        address _loopringAddr,
        bytes32 _genesisMerkleRoot,
        bytes32 _domainSeparator
        )
        public
    {
        require(address(0) != _loopringAddr, "INVALID_LOOPRING_ADDRESS");
        require(_genesisMerkleRoot != 0, "INVALID_GENESIS_MERKLE_ROOT");

        S.maxAgeDepositUntilWithdrawable = ExchangeData.MAX_AGE_DEPOSIT_UNTIL_WITHDRAWABLE_UPPERBOUND;
        S.DOMAIN_SEPARATOR = _domainSeparator;

        ILoopringV3 loopring = ILoopringV3(_loopringAddr);
        S.loopring = loopring;

        S.blockVerifier = IBlockVerifier(loopring.blockVerifierAddress());

        S.merkleRoot = _genesisMerkleRoot;
        S.blocks[0] = ExchangeData.BlockInfo(uint32(block.timestamp), bytes28(0));
        S.numBlocks = 1;

        // Get the protocol fees for this exchange
        S.protocolFeeData.syncedAt = uint32(0);
        S.protocolFeeData.takerFeeBips = S.loopring.protocolTakerFeeBips();
        S.protocolFeeData.makerFeeBips = S.loopring.protocolMakerFeeBips();
        S.protocolFeeData.previousTakerFeeBips = S.protocolFeeData.takerFeeBips;
        S.protocolFeeData.previousMakerFeeBips = S.protocolFeeData.makerFeeBips;

        // Call these after the main state has been set up
        S.registerToken(address(0));
        S.registerToken(loopring.lrcAddress());
    }
}