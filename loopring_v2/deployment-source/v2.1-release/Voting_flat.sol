pragma solidity 0.5.0;

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



/// @title ERC20 Token Interface
/// @dev see https://github.com/ethereum/EIPs/issues/20
/// @author Daniel Wang - <daniel@loopring.org>
contract ERC20 {
    function totalSupply()
        public
        view
        returns (uint256);

    function balanceOf(
        address who
        )
        public
        view
        returns (uint256);

    function allowance(
        address owner,
        address spender
        )
        public
        view
        returns (uint256);

    function transfer(
        address to,
        uint256 value
        )
        public
        returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
        )
        public
        returns (bool);

    function approve(
        address spender,
        uint256 value
        )
        public
        returns (bool);
}

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



/// @title Errors
contract Errors {
    string constant ZERO_VALUE                 = "ZERO_VALUE";
    string constant ZERO_ADDRESS               = "ZERO_ADDRESS";
    string constant INVALID_VALUE              = "INVALID_VALUE";
    string constant INVALID_ADDRESS            = "INVALID_ADDRESS";
    string constant INVALID_SIZE               = "INVALID_SIZE";
    string constant INVALID_SIG                = "INVALID_SIG";
    string constant INVALID_STATE              = "INVALID_STATE";
    string constant NOT_FOUND                  = "NOT_FOUND";
    string constant ALREADY_EXIST              = "ALREADY_EXIST";
    string constant REENTRY                    = "REENTRY";
    string constant UNAUTHORIZED               = "UNAUTHORIZED";
    string constant UNIMPLEMENTED              = "UNIMPLEMENTED";
    string constant UNSUPPORTED                = "UNSUPPORTED";
    string constant TRANSFER_FAILURE           = "TRANSFER_FAILURE";
    string constant WITHDRAWAL_FAILURE         = "WITHDRAWAL_FAILURE";
    string constant BURN_FAILURE               = "BURN_FAILURE";
    string constant BURN_RATE_FROZEN           = "BURN_RATE_FROZEN";
    string constant BURN_RATE_MINIMIZED        = "BURN_RATE_MINIMIZED";
    string constant UNAUTHORIZED_ONCHAIN_ORDER = "UNAUTHORIZED_ONCHAIN_ORDER";
    string constant INVALID_CANDIDATE          = "INVALID_CANDIDATE";
    string constant ALREADY_VOTED              = "ALREADY_VOTED";
    string constant NOT_OWNER                  = "NOT_OWNER";
}



contract Voting is Errors {
    /*
    The key of the mapping is candidate name stored as type bytes32 and value is
    an unsigned integer which used to store the vote count
    */
    mapping (bytes32 => uint256) public votesReceived;

    mapping (address => bool) public voteFlag;

    address lrcAddress = 0xEF68e7C694F40c8202821eDF525dE3782458639f;

    bytes32[] public candidateList;

    constructor(
        bytes32[] memory candidateNames
        )
        public
    {
        candidateList = candidateNames;
    }

    function totalVotesFor(
        bytes32 candidate
        )
        public
        view
        returns (uint256)
    {
        require(validCandidate(candidate), INVALID_CANDIDATE);

        return votesReceived[candidate];
    }

    function voteForCandidate(
        bytes32 candidate
        )
        public
    {
        require(validCandidate(candidate), INVALID_CANDIDATE);
        require(voteFlag[msg.sender] != true, ALREADY_VOTED);

        uint256 balance = ERC20(lrcAddress).balanceOf(msg.sender);
        votesReceived[candidate] += balance;
        voteFlag[msg.sender] = true;
    }

    function validCandidate(
        bytes32 candidate
        )
        public
        view
        returns (bool)
    {
        for(uint i = 0; i < candidateList.length; i++) {
            if (candidateList[i] == candidate) {
                return true;
            }
        }

        return false;
    }

    // This function returns the list of candidates.
    function getCandidateList()
        public
        view
        returns (bytes32[] memory)
    {
        return candidateList;
    }
}
