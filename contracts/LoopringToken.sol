pragma solidity ^0.4.11;

import "./StandardToken.sol";

contract LoopringToken is StandardToken {

  string public constant name = "LoopringToken";
  string public constant symbol = "LRC";
  uint public constant decimals = 18;

  uint8[9] public rewardPercentages = [20, 16, 14, 12, 10, 8, 6, 4, 2];
  uint16 public constant blocksPerPhase = 15264;
  address public constant target = 0x249acd967f6eb5b8907e5c888cbd8a005d0b23f4;
  
  uint public firstblock = 0;
  bool public isTokensCreatedForOwner = false;
  uint public totalEthReceived = 0;

  event SaleStarted();
  event SaleEnded();
  event InvalidCaller(address caller);
  event InvalidState(bytes msg);
  event Issue(address addr, uint ethAmount, uint tokenAmount);
  event IcoSucceeded();
  event IcoFailed();

  modifier isOwner {
    if (target == msg.sender) {
      _;
    }
    else InvalidCaller(msg.sender);
  }

  modifier inProgress {
    if (firstblock > 0
        && block.number >= firstblock
        && !checkSaleEnded()) {
      _;
    } else InvalidState("sale not in progress."); 
  }

  modifier afterEnd {
    if (checkSaleEnded()) {
      _;
    }
    else InvalidState("sale not end yet.");
  }

  function start(uint _firstblock) public isOwner returns (uint) {
    if (firstblock > 0 || _firstblock <= block.number) {
      throw;
    }

    firstblock = _firstblock;
    SaleStarted();

    return firstblock;
  }

  function () payable {
    createTokens(msg.sender);
  }

  function createTokens(address recipient) payable inProgress {
    assert(msg.value >= 0.01 ether);

    uint tokens = computeTokenAmount(msg.value);
    totalEthReceived = totalEthReceived.add(msg.value);
    totalSupply = totalSupply.add(tokens);
    balances[recipient] = balances[recipient].add(tokens);

    Issue(recipient, msg.value, tokens);

    if (!target.send(msg.value)) {
      throw;
    }
  }

  function computeTokenAmount(uint ethAmount) internal returns (uint result) {
    uint tokenAmountBase = ethAmount.mul(5000);
    uint phase = (block.number - firstblock) / blocksPerPhase;
    if (phase >= rewardPercentages.length) {
      phase = rewardPercentages.length - 1;
    }
    uint tokenAmountReward = tokenAmountBase.mul(rewardPercentages[phase])/100;

    return tokenAmountBase.add(tokenAmountReward);
  }

  function endSale() isOwner afterEnd {
    if (totalEthReceived < 50000 ether) {
      IcoFailed();
    } else {
      createTokensForOwner();
      IcoSucceeded();
    }
  }

  function createTokensForOwner() internal {
    if (!isTokensCreatedForOwner) {
      uint level = totalEthReceived.sub(50000 ether) / 10000 ether;
      if (level > 10) {
        level = 10;
      }
      uint unSaledThousandth = 675 - 25*level;
      if (unSaledThousandth < 500) {
        unSaledThousandth = 500;
      }
      uint tokenAmount = totalSupply.mul(unSaledThousandth) / (1000 - unSaledThousandth);
      totalSupply = totalSupply.add(tokenAmount);
      balances[target] = balances[target].add(tokenAmount);

      Issue(target, 0, tokenAmount);
      isTokensCreatedForOwner = true;
    } else {
      InvalidState("tokens already created for owner.");
    }
  }

  function checkSaleEnded() constant returns (bool result) {
    if (block.number > (firstblock + blocksPerPhase * 10)) {
      SaleEnded();
      return true;
    }

    if (totalEthReceived >= 120000 ether) {
      SaleEnded();
      return true;
    }

    return false;
  }
}
