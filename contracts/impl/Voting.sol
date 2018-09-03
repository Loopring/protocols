pragma solidity ^0.4.24; 

import "../lib/ERC20.sol";

contract Voting {
  /* 
  The key of the mapping is candidate name stored as type bytes32 and value is
  an unsigned integer which used to store the vote count
  */
  mapping (bytes32 => uint256) public votesReceived;

  mapping (address => bool) public voteFlag;
  
  address lrcAddress = 0xEF68e7C694F40c8202821eDF525dE3782458639f;

  bytes32[] public candidateList;

  constructor(bytes32[] candidateNames) public {
    candidateList = candidateNames;
  }

  function totalVotesFor(bytes32 candidate) public view returns (uint256) {
    require(validCandidate(candidate));

    return votesReceived[candidate];
  }

  function voteForCandidate(bytes32 candidate) public {
    require(validCandidate(candidate));
    require(voteFlag[msg.sender] != true);

    uint256 balance = ERC20(lrcAddress).balanceOf(msg.sender);
    votesReceived[candidate] += balance;
    voteFlag[msg.sender] == true;
  }

  function validCandidate(bytes32 candidate) public view returns (bool) {
    for(uint i = 0; i < candidateList.length; i++) {
      if (candidateList[i] == candidate) {
        return true;
      }
    }
    
    return false;
  }

  // This function returns the list of candidates.
  function getCandidateList() public view returns (bytes32[]) {
    return candidateList;
  }
}
