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
import "./HashUtil.sol";
import "./BytesLib.sol";

/// @title An Implementation to do settlement and clearing for 
///        small transaction amounts with a sidechain on Ethereum 
/// @author autumn84 - <yangli@loopring.org>,
contract AccountantImpl is IAccountant {

    using ERC20SafeTransfer for address;
    using BytesLib for bytes;

    uint256  public constant TOTAL_ACCOUNTANT_NUM     = 2;
    uint256  public constant MIN_ACCOUNTANT_NUM       = 1;

    mapping (uint256 => address) public accountantsMap;
    mapping (uint256 => uint256) public merkleRootMap;
    mapping (bytes32 => bool) public withdrawFlagMap;

    address toStore = 0x0;
    uint256 amountStore = 0;
    uint256 heightStore = 0;
    address tokenStore = 0x0;

    constructor(
        address[] _accountants
        )
        public
    {
        uint256 size = _accountants.length;
        require(size == TOTAL_ACCOUNTANT_NUM);
        for (uint256 i = 0; i < size; i++) {
            accountantsMap[i] = _accountants[i];
        }
    }

    function queryAccountant(uint256 seqNo) external view returns (address) {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL SEQUENCE NUMBER");
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
        // Now the sender who submits block infos may be anyone.
        //require(checkProcessor(msg.sender));
        require(checkSignatures(submitter, root, seqNos, oldAccountants, newAccountants, height, signatures));
               
        for(uint256 i = 0; i < seqNos.length; i++) {
            midifyAccountant(seqNos[i], oldAccountants[i], newAccountants[i], height);
        }
        addMerkleRoot(height, root);
    }

    function getPackage(
        address submitter,
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes signatures
        )
        external pure returns (bytes)
    {
        return HashUtil.toPackage(submitter, root, seqNos, oldAccountants, newAccountants, height);
    }

    function getHash(
        address submitter,
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] newAccountants,
        uint256 height,
        bytes signatures
        )
        external pure returns (bytes32)
    {
        return HashUtil.calcSubmitBlockHash(submitter, root, seqNos, oldAccountants, newAccountants, height);
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
        bytes32 plaintext = HashUtil.calcSubmitBlockHash(submitter, root, seqNos, oldAccountants, newAccountants, height);
        uint8 num = 0;
        for(uint256 i = 0; i < TOTAL_ACCOUNTANT_NUM; i++) {
            bytes memory signature;
            signature = signatures.slice(65*i, 65);
            if(signature[0] != 0) {
                require(HashUtil.verifySignature(accountantsMap[i], plaintext, signature));
                num++;
            }
        }
        require(num > MIN_ACCOUNTANT_NUM);
    }

    function parseSignatures(
        bytes signatures, uint8 flagNum) 
        external pure returns (bytes) 
    {
        for(uint256 i = 0; i < flagNum; i++) {
            bytes memory sig = signatures.slice(65*i, 65);
            return sig;
        }
    }

    function withdraw(
        uint256 height,
        bytes rawData,
        uint256[] pathProof
        )
        external
    {
        require(rawData.length > 74, "ILLEGAL LENGTH OF RAW_DATA!");

        bytes32 hash = keccak256(rawData);
        require(withdrawFlagMap[hash] != true);

        address token = bytesToAddress(rawData.slice(2, 20));
        tokenStore = token;
        uint256 amount = sliceUint(rawData, 22);
        amountStore = amount;
        require(amount > 0, "AMOUNT IS 0!");
        address to = bytesToAddress(rawData.slice(54, 20));
        toStore = to;
        require(msg.sender == to);

        heightStore = height;

        require(checkMerkleRoot(rawData, height, pathProof));

        require(
            token.safeTransfer(
                to,
                amount
            ),
            "TRANSFER FAILED"
        );

        withdrawFlagMap[hash] = true;

        emit Withdraw(
            msg.sender,
            token,
            amount
        );
    }

    function bytesToAddress (bytes bys) private pure returns (address addr) {
        assembly {
            addr := mload(add(bys,20))
        } 
    }

    function sliceUint(bytes bys, uint256 start)
    internal pure
    returns (uint256)
    {
        require(bys.length >= start + 32, "slicing out of range");
        uint256 x;
        assembly {
            x := mload(add(bys, add(0x20, start)))
        }
        return x;
    }

    function checkMerkleRoot(bytes rawData, uint256 height, uint256[] path_proof) internal view returns (bool) {
        uint256 root = merkleRootMap[height];
        require(root != 0);
        //TODO
        bytes32 currentHash = keccak256(rawData);
        bytes32 calcRoot = currentHash;
        for (uint256 i = 0; i < path_proof.length; i++) {
            calcRoot = keccak256(
                abi.encodePacked(
                    calcRoot,
                    path_proof[i]));
        }
        if(bytes32(root) == calcRoot) {
            return true;
        }
        return false;
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
        if(accountantsMap[seqNo] != newAccountant) {
            accountantsMap[seqNo] = newAccountant;
        }
        emit UpdateAccountant(seqNo, oldAccountant, newAccountant, height);
    }

    function addMerkleRoot(uint256 height, uint256 root) internal {
        require(height > 0 && root > 0);
        require(merkleRootMap[height] == 0);
        merkleRootMap[height] = root;
    }

    function checkProcessor(address processor) internal view returns (bool) {
        for(uint8 i = 0; i < TOTAL_ACCOUNTANT_NUM; i++) {
            if(accountantsMap[i] == processor) {
                return true;
            }
        }
        return false;
    }

    function checkNewAccountant(address newAccountant) internal view {
        uint8 num = 0;
        for(uint8 i = 0; i < TOTAL_ACCOUNTANT_NUM; i++) {
            if(accountantsMap[i] == newAccountant) {
                num++;
            }
        }
        assert(num == 1);
    }

}