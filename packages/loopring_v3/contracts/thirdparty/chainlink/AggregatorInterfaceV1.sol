pragma solidity ^0.5.11;

interface AggregatorInterfaceV1 {
  function currentAnswer() external view returns (int256);
  function updatedTimestamp() external view returns (uint256);
  function latestRound() external view returns (uint256);
  function getAnswer(uint256 id) external view returns (int256);
  function getUpdatedTimestamp(uint256 id) external view returns (uint256);

  event AnswerUpdated(int256 indexed current, uint256 indexed answerId, uint256 timestamp);
  event NewRound(uint256 indexed number, address indexed startedBy);
}
