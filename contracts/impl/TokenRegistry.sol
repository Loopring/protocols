/*

  Copyright 2017 Loopring Project Ltd (Loopring Foundation).

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
pragma solidity 0.5.2;

import "../iface/ITokenRegistry.sol";

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";

import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";

import "../lib/MerkleTree.sol";


/// @title An Implementation of ITokenRegistry.
/// @author Brecht Devos - <brecht@loopring.org>,
contract TokenRegistry is ITokenRegistry, NoDefaultFunc {
    using MathUint          for uint;
    using ERC20SafeTransfer for address;
    using MerkleTree        for MerkleTree.Data;

    event NewBurnRateBlock(uint blockIdx, bytes32 merkleRoot);
    event TokenRegistered(address tokenAddress, uint16 tokenID);

    struct Token {
        address tokenAddress;
        uint8 tier;
        uint32 tierValidUntil;
    }

    struct BurnRateBlock {
        bytes32 merkleRoot;
        uint32 validUntil;
    }

    address public lrcAddress = address(0x0);

    MerkleTree.Data burnRateMerkleTree;

    BurnRateBlock[] public burnRateBlocks;

    Token[] public tokens;
    mapping (address => uint16) public tokenToTokenID;

    constructor(
        address _lrcAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), ZERO_ADDRESS);
        lrcAddress = _lrcAddress;

        BurnRateBlock memory noTokensBlock = BurnRateBlock(
            0x0,
            0xFFFFFFFF
        );
        burnRateBlocks.push(noTokensBlock);

        // Register ETH
        // registerTokenInternal(address(0x0));
    }

    function registerToken(
        address tokenAddress
        )
        external
    {
        require(tokenToTokenID[tokenAddress] == 0, "ALREADY_REGISTERED");

        // Pay the fee
        burn(msg.sender, TOKEN_REGISTRATION_FEE_IN_LRC);

        Token memory token = Token(
            tokenAddress,
            4,
            0
        );
        tokens.push(token);
        uint16 tokenID = uint16(tokens.length);
        tokenToTokenID[tokenAddress] = tokenID;
        emit TokenRegistered(tokenAddress, tokenID - 1);

        uint16 burnRate = getBurnRate(tokenID - 1);
        (, uint offset) = burnRateMerkleTree.Insert(burnRate);
        assert(offset == tokenID - 1);
        createNewBurnRateBlock();
    }

    function getTokenTier(
        uint24 tokenID
        )
        public
        view
        returns (uint8 tier)
    {
        Token storage token = tokens[tokenID];
        // Fall back to lowest tier
        tier = (now > token.tierValidUntil) ? 4 : token.tier;
    }

    function getBurnRate(
        uint24 tokenID
        )
        public
        view
        returns (uint16 burnRate)
    {
        uint tier = getTokenTier(tokenID);
        if (tier == 1) {
            burnRate = BURNRATE_TIER1;
        } else if (tier == 2) {
            burnRate = BURNRATE_TIER2;
        } else if (tier == 3) {
            burnRate = BURNRATE_TIER3;
        } else {
            burnRate = BURNRATE_TIER4;
        }
    }

    function updateBurnRate(
        uint24 tokenID
        )
        external
    {
        require(tokenID < tokens.length, "INVALID_TOKENID");

        uint16 burnRate = getBurnRate(tokenID);
        // TODO: MAKE THIS WORK
        burnRateMerkleTree.Update(tokenID, burnRate);

        // Create a new block if necessary
        createNewBurnRateBlock();
    }

    function createNewBurnRateBlock()
        internal
    {
        bytes32 newRoot = bytes32(burnRateMerkleTree.GetRoot());
        BurnRateBlock storage currentBlock = burnRateBlocks[burnRateBlocks.length - 1];
        if (newRoot == currentBlock.merkleRoot) {
            // No need for a new block
            return;
        }

        // Allow the use of older blocks for 1 hour
        currentBlock.validUntil = uint32(now + OLD_BURNRATE_ROOT_VALID_IN_SECONDS);

        // Create the new block
        BurnRateBlock memory newBlock = BurnRateBlock(
            bytes32(newRoot),
            0xFFFFFFFF              // The last block is valid forever (until a new block is added)
        );
        burnRateBlocks.push(newBlock);

        emit NewBurnRateBlock(burnRateBlocks.length - 1, bytes32(newRoot));
    }

    function getTokenID(
        address tokenAddress
        )
        external
        view
        returns (uint16)
    {
        require(tokenToTokenID[tokenAddress] != 0, "TOKEN_NOT_REGISTERED");
        return tokenToTokenID[tokenAddress] - 1;
    }

    function getTokenAddress(
        uint16 tokenID
        )
        external
        view
        returns (address)
    {
        require(tokenID < tokens.length, "INVALID_TOKENID");
        return tokens[tokenID].tokenAddress;
    }

    function getBurnRateMerkleRoot(
        uint burnRateBlockIdx
        )
        external
        view
        returns (bytes32, uint32)
    {
        BurnRateBlock storage specifiedBlock = burnRateBlocks[burnRateBlockIdx];
        return (specifiedBlock.merkleRoot, specifiedBlock.validUntil);
    }

    function getBurnRateRoot()
        external
        view
        returns (bytes32)
    {
        return bytes32(burnRateMerkleTree.GetRoot());
    }

    function getBurnRateBlockIdx()
        external
        view
        returns (uint)
    {
        return burnRateBlocks.length - 1;
    }

    function burn(
        address from,
        uint amount
        )
        internal
    {
        require(
            BurnableERC20(lrcAddress).burnFrom(
                from,
                amount
            ),
            BURN_FAILURE
        );
    }
}
