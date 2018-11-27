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
pragma solidity 0.4.24;

import "./IAccountant.sol";
import "./ERC20SafeTransfer.sol";
import "./HashUtilLib.sol";
import "./BytesLib.sol";

/// @title An Implementation to do settlement and clearing for 
///        small transaction amounts with a sidechain on Ethereum 
/// @author autumn84 - <yangli@loopring.org>,
contract AccountantImpl is IAccountant {

    using ERC20SafeTransfer for address;
    using BytesLib for bytes;

    // In test environment, only using 4 nodes;
    // In product environment, 22 nodes should be used at least.
    uint256  public constant TOTAL_ACCOUNTANT_NUM     = 1;
    uint256  public constant MIN_ACCOUNTANT_NUM       = 1;

    mapping (uint256 => address) public accountantsMap;
    mapping (uint256 => uint256) public merkleRootMap;
    mapping (bytes32 => bool) public withdrawFlagMap;

    address toStore = 0x0;
    uint256 amountStore = 0;
    uint256 heightStore = 0;
    address tokenStore = 0x0;

    constructor(
        address[] accountants
        )
        public
    {
        uint256 size = accountants.length;
        require(size == TOTAL_ACCOUNTANT_NUM);
        for (uint256 i = 0; i < size; i++) {
            accountantsMap[i] = accountants[i];
        }
    }

    function submitBlock(
        address submitter,
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes signatures
        )
        external
    {
        require((seqNos.length == oldAccountants.length && seqNos.length == newAccountants.length), "PARAMETERS NOT MATCH");
        require(checkSignatures(submitter, root, seqNos, oldAccountants, newAccountants, height, signatures), "VIRIFY NOT PASS");
               
        for(uint256 i = 0; i < seqNos.length; i++) {
            midifyAccountant(seqNos[i], oldAccountants[i], newAccountants[i], height);
        }

        addMerkleRoot(height, root);
    }


    function withdraw(
        uint256 height,
        bytes rawData,
        uint256[] pathProof
        )
        external
    {
        require(rawData.length >= 74, "ILLEGAL LENGTH OF RAW_DATA!");

        bytes32 hash = keccak256(rawData);
        require(withdrawFlagMap[hash] != true);

        address token = BytesLib.toAddress(rawData, 2);
        tokenStore = token;
        uint256 amount = BytesLib.toUint(rawData, 22);
        amountStore = amount;
        require(amount > 0, "AMOUNT IS 0!");
        address to = BytesLib.toAddress(rawData, 54);
        toStore = to;

        require(msg.sender == to, "ILLEGAL WITHDRAW USER!");

        heightStore = height;

        require(checkMerkleRoot(rawData, height, pathProof), "CHECK MERKLE ROOT FAILED!");

        require(
            token.safeTransfer(
                to,
                amount
            ),
            "TRANSFER FAILED!"
        );

        withdrawFlagMap[hash] = true;

        emit Withdraw(
            msg.sender,
            token,
            amount
        );
    }

    function queryAccountant(uint256 seqNo) external view returns (address) {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL ACCOUNTANT NUMBER!");
        return accountantsMap[seqNo];
    }

    function queryMerkleRoot(uint256 height) external view returns (uint256) {
        return merkleRootMap[height];
    }

    function queryHeight() external view returns (uint256) {
        return heightStore;
    }

    function queryToken() external view returns (address) {
        return tokenStore;
    }

    function queryTo() external view returns (address) {
        return toStore;
    }

    function queryAmount() external view returns (uint256) {
        return amountStore;
    }

    function getHash(
        address submitter,
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height
        )
        external pure returns (bytes32)
    {
        return HashUtilLib.calcSubmitBlockHash(submitter, root, seqNos, oldAccountants, newAccountants, height);
    }

    function checkSignatures(
        address submitter,
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes signatures) 
        internal view returns (bool) 
    {
        require(signatures.length == 65*TOTAL_ACCOUNTANT_NUM, "ILLEGAL SIGNATURE NUM!");
        bytes32 plaintext = HashUtilLib.calcSubmitBlockHash(submitter, root, seqNos, oldAccountants, newAccountants, height);
        uint8 num = 0;
        for(uint256 i = 0; i < TOTAL_ACCOUNTANT_NUM; i++) {
            bytes memory signature;
            signature = signatures.slice(65*i, 65);
            if(signature[0] != 0) {
                if (HashUtilLib.verifySignature(accountantsMap[i], plaintext, signature)) {
                    num++;
                }
            }
        }
        require(num >= MIN_ACCOUNTANT_NUM, "SIGN NOT ENOUGH!");
        return true;
    }

    function checkMerkleRoot(bytes rawData, uint256 height, uint256[] path_proof) internal view returns (bool) {
        uint256 rootHash = merkleRootMap[height];
        require(rootHash != 0);
        //TODO
        bytes32 currentHash = keccak256(rawData);
        bytes32 calcRootHash = currentHash;
        for (uint256 i = 0; i < path_proof.length; i++) {
            calcRootHash = keccak256(
                abi.encodePacked(
                    calcRootHash,
                    path_proof[i]));
        }
        if(bytes32(rootHash) == calcRootHash) {
            return true;
        }
        return false;
    }

    function getMerkleRoot(bytes rawData, uint256[] path_proof) internal view returns (uint256) {
        bytes32 calcRootHash = keccak256(rawData);
        for (uint256 i = 0; i < path_proof.length; i++) {
            calcRootHash = keccak256(
                abi.encodePacked(
                    calcRootHash,
                    path_proof[i]));
        }
        return uint256(calcRootHash);
    }

    function midifyAccountant(
        uint256 seqNo,
        address oldAccountant,
        address newAccountant,
        uint256 height
        )
        internal
    {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL SEQUENCE NO.");
        require(accountantsMap[seqNo] == oldAccountant, "ILLEGAL OLD ACCOUNTANT");
        require(newAccountant != 0x0, "ILLEGAL NEW ACCOUNTANT");
        require(checkNewAccountant(newAccountant), "ACCOUNTANT HAS ALREADY EXISTED");
        if(accountantsMap[seqNo] != newAccountant) {
            accountantsMap[seqNo] = newAccountant;
        }
        emit UpdateAccountant(seqNo, oldAccountant, newAccountant, height);
    }

    function addMerkleRoot(uint256 height, uint256 rootHash) internal {
        require(height > 0 && rootHash > 0);
        require(merkleRootMap[height] == 0, "ROOT HASH HAS ALREADY EXISTED");
        merkleRootMap[height] = rootHash;
        emit AddRootHash(height, rootHash);
    }

    function checkNewAccountant(address newAccountant) internal view returns (bool) {
        uint8 num = 0;
        for(uint8 i = 0; i < TOTAL_ACCOUNTANT_NUM; i++) {
            if(accountantsMap[i] == newAccountant) {
                num++;
            }
        }
        if (num != 0) {
            return false;
        }
        return true;
    }

}