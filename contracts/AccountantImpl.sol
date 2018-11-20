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
        uint256 hight,
        bytes signatures
        )
        external
    {
        for(uint256 i = 0; i < seqNos.length; i++) {
            midifyAccountant(seqNos[i], oldAccountants[i], accountants[i], hight);
        }
        addMerkleRoot(hight, root);
    }

    function midifyAccountant(
        uint256 seqNo,
        address oldAccountant,
        address accountant,
        uint256 hight
        )
        internal
    {
        require(seqNo < TOTAL_ACCOUNTANT_NUM, "ILLEGAL SEQUENCE NO.");
        require(accountantsMap[seqNo] == oldAccountant, "ILLEGAL OLD ACCOUNTANT");
        require(accountant != 0x0, "ILLEGAL NEW ACCOUNTANT");
        if(accountantsMap[seqNo] != accountant) {
            accountantsMap[seqNo] = accountant;
        }
        emit UpdateAccountant(seqNo, oldAccountant, accountant, hight);
    }

    function addMerkleRoot(uint256 root, uint256 hight) internal {
        require(hight > 0 && root > 0);
        require(merkleRootMap[hight] == 0);
        merkleRootMap[hight] = root;
    }

    function withdraw(
        address to,
        address token,
        uint256 amount,
        uint256[] path_proof
        )
        external
    {
        require(msg.sender == to);
        require(amount > 0);
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

}