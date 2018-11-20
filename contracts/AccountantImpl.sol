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

/// @title An Implementation to do settlement and clearing for 
///        small transaction amounts with a sidechain on Ethereum 
/// @author autumn84 - <yangli@loopring.org>,
contract AccountantImpl is IAccountant {

    using ERC20SafeTransfer for address;

    uint256  public constant TOTAL_ACCOUNTANT_NUM     = 22;
    uint256  public constant MIN_ACCOUNTANT_NUM       = 15;

    uint256 public accountantsNum = 0;
    mapping (uint256 => address) public accountantsMap;
    mapping (uint256 => uint256) public merkleRootMap;

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

    function queryAccountant(uint256 seqNo) external returns (address) {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL SEQUENCE NUMBER");
        return accountantsMap[seqNo];
    }

    function submitBlock(
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] accountants,
        uint256 height,
        bytes signatures
        )
        external
    {
        require(checkProcessor(msg.sender));
        require(checkSignatures(root, seqNos, oldAccountants, accountants, height, signatures));
               
        for(uint256 i = 0; i < seqNos.length; i++) {
            midifyAccountant(seqNos[i], oldAccountants[i], accountants[i], height);
        }
        addMerkleRoot(height, root);
    }

    function checkSignatures(
        uint256 root,
        uint256[] seqNos,
        address[] oldAccountants,
        address[] accountants,
        uint256 height,
        bytes signatures) 
        internal view returns (bool) 
    {
        bytes32 plaintext = HashUtil.calcSubmitBlockHash(root, seqNos, oldAccountants, accountants, height);
        uint8 num = 0;
        for(uint256 i = 0; i < signatures.length; i++) {
            bytes memory signature;
            uint256 offset = 65*(1+i);
            assembly {
                signature := mload(add(signatures, offset))
            }
            if(signature[0] != 0) {
                require(HashUtil.verifySignature(accountantsMap[i], plaintext, signature));
                num++;
            }
        }
        require(num > MIN_ACCOUNTANT_NUM);
    }

    function withdraw(
        bytes rawData,
        uint256[] path_proof
        )
        external
    {
        address to = getTo(rawData);
        require(msg.sender == to);

        uint256 amount = getAmount(rawData);
        require(getTo(rawData) > 0);

        uint256 height = getHeight(rawData);
        require(checkMerkleRoot(rawData, height, path_proof));

        address token = getToken(rawData);

        require(
            token.safeTransfer(
                to,
                amount
            ),
            "TRANSFER FAILED"
        );

        emit Withdraw(
            msg.sender,
            token,
            amount
        );
    }

    function getTo(bytes rawData) internal pure returns(address) {
        address to = 0x0;
        //TODO
        return to;
    }

    function getAmount(bytes rawData) internal pure returns(uint256) {
        uint256 amount = 0;
        //TODO
        return amount;
    }

    function getHeight(bytes rawData) internal pure returns(uint256) {
        uint256 height = 0;
        //TODO
        return height;
    }

    function getToken(bytes rawData) internal pure returns(address) {
        address token;
        //TODO
        return token;
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

    function addMerkleRoot(uint256 root, uint256 height) internal {
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