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
    mapping (uint256 => bytes32) public merkleRootMap;
    mapping (bytes32 => bool) public withdrawFlagMap;

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
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes32 root,
        address submitter,
        bytes signatures
        )
        external
    {
        require((seqNos.length == oldAccountants.length && seqNos.length == newAccountants.length), "PARAMETERS NOT MATCH");
        require(checkSignatures(seqNos, oldAccountants, newAccountants, height, root, submitter, signatures), "SIGNATURE VIRIFY NOT PASS");
               
        for(uint256 i = 0; i < seqNos.length; i++) {
            midifyAccountant(seqNos[i], oldAccountants[i], newAccountants[i], height);
        }

        addMerkleRoot(height, root);
    }


    function withdraw(
        uint256 height,
        bytes rawData,
        bytes pathProof
        )
        external
    {
        require(rawData.length >= 32*3, "ILLEGAL LENGTH OF RAW_DATA!");
        require((rawData.length % 32) == 0, "ILLEGAL LENGTH OF RAW_DATA!");

        bytes32 hash = keccak256(rawData);
        require(withdrawFlagMap[hash] != true, "ALREADY WITHDRAW!");

        address token = BytesLib.toAddress(rawData, 12);

        uint256 amount = BytesLib.toUint(rawData, 32);
        require(amount > 0, "AMOUNT IS 0!");

        address to = BytesLib.toAddress(rawData, 76);
        require(msg.sender == to, "ILLEGAL WITHDRAW USER!");

        require(checkMerkleRoot(hash, height, pathProof), "CHECK MERKLE ROOT FAILED!");

        require(
            token.safeTransfer(
                to,
                amount
            ),
            "TRANSFER FAILED!"
        );

        withdrawFlagMap[hash] = true;

        emit LogWithdraw(
            msg.sender,
            token,
            amount
        );
    }

    function calcRoot(bytes rawData, bytes32 pathProof) external pure returns (bytes32) {
        bytes32 hash = keccak256(rawData);
        return keccak256(abi.encodePacked(hash, pathProof));
    }

    function queryAccountant(uint256 seqNo) external view returns (address) {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL ACCOUNTANT NUMBER!");
        return accountantsMap[seqNo];
    }



    function queryMerkleRoot(uint256 height) external view returns (bytes32) {
        return merkleRootMap[height];
    }

    function getHash(
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes32 root,
        address submitter
        )
        external pure returns (bytes32)
    {
        return HashUtilLib.calcSubmitBlockHash(seqNos, oldAccountants, newAccountants, height, root, submitter);
    }

    function checkSignatures(
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes32 root,
        address submitter,
        bytes signatures) 
        internal view returns (bool) 
    {
        require(signatures.length == 65*TOTAL_ACCOUNTANT_NUM, "ILLEGAL SIGNATURE NUM!");
        bytes32 plaintext = HashUtilLib.calcSubmitBlockHash(seqNos, oldAccountants, newAccountants, height, root, submitter);
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

    function checkMerkleRoot(bytes32 hash, uint256 height, bytes path_proof) internal view returns (bool) {
        bytes32 rootHash = merkleRootMap[height];
        require(rootHash != 0, "NO ROOTHASH!");

        bytes32 currentHash = hash;
        bytes32 calcRootHash = currentHash;
        for (uint256 i = 0; i < path_proof.length; i+=32) {
            calcRootHash = keccak256(
                abi.encodePacked(
                    calcRootHash,
                    path_proof.slice(i*32, 32)));
        }
        if(rootHash == calcRootHash) {
            return true;
        }
        return false;
    }

    function getMerkleRoot(bytes rawData, bytes path_proof) internal pure returns (bytes32) {
        bytes32 calcRootHash = keccak256(rawData);
        for (uint256 i = 0; i < path_proof.length;  i+=32) {
            calcRootHash = keccak256(
                abi.encodePacked(
                    calcRootHash,
                    path_proof.slice(i*32, 32)));
        }
        return calcRootHash;
    }

    function midifyAccountant(
        uint256 seqNo,
        address oldAccountant,
        address newAccountant,
        uint256 height
        )
        internal
    {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL SEQUENCE NO!");
        require(accountantsMap[seqNo] == oldAccountant, "ILLEGAL OLD ACCOUNTANT!");
        require(newAccountant != 0x0, "ILLEGAL NEW ACCOUNTANT");
        require(checkNewAccountant(newAccountant), "ACCOUNTANT HAS ALREADY EXISTED!");
        if(accountantsMap[seqNo] != newAccountant) {
            accountantsMap[seqNo] = newAccountant;
        }
        emit LogUpdateAccountant(seqNo, oldAccountant, newAccountant, height);
    }

    function addMerkleRoot(uint256 height, bytes32 rootHash) internal {
        require(height > 0 && rootHash > 0);
        require(merkleRootMap[height] == 0, "ROOT HASH HAS ALREADY EXISTED!");
        merkleRootMap[height] = rootHash;
        emit LogAddRootHash(height, rootHash);
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