pragma solidity ^0.4.11;

import "./StandardToken.sol";

contract LoopringToken is StandardToken {

  string public constant name = "LoopringToken";
  string public constant symbol = "LRC";
  uint public constant decimals = 18;

  uint16[5] public saleAmountPerThousand = [400, 425, 450, 475, 500];
  uint16[5] public phases = [6000, 5750, 5500, 5250, 5000];
  uint public constant blocksPerDay = 5082;
  uint public constant targetBlocksHeight = 5082 * 30; // 30 days.
  uint public constant ethGoalPerPhase = 20000;
  address public target = 0xaea169db31cdd2375bafc08fdb2b56e437edafc6;
  uint public firstblock = 0;
  uint public deadlineSecs = 0;
  bool public isTokensSendedToTarget = false;
  
  Funder[] public funders;

  struct Funder {
    address addr;
    uint amount;
  }

  event SaleStarted();
  event SaleEnded();
  event InvalidCaller(address caller);
  event InvalidState(bytes msg);
  event Issue(address addr, uint value);
  event PrtEthBalance(address addr, uint value);
  event IcoSucceeded();
  event IcoFailed();

  modifier isOwner {
    if (target == msg.sender) {
        _;
    }
    else InvalidCaller(msg.sender);
  }

  modifier afterStart {
    if (firstblock > 0) {
        _;
    }
    else InvalidState("sale not start yet");
  }

  modifier beforeStart {
    if (firstblock == 0) {
        _;
    }
    else InvalidState("sale already started.");
  }

  modifier beforeEnd {
    if (!checkSaleEnded()) {
      _;
    }
    else InvalidState("sale ended.");
  }

  modifier afterEnd {
    if (checkSaleEnded()) {
      _;
    }
    else InvalidState("sale not end yet.");
  }

  function start(uint _firstblock) public isOwner beforeStart returns (uint) {
    if (firstblock > 0 || _firstblock <= block.number) {
      throw;
    }
    firstblock = _firstblock;
    deadlineSecs = now + 30 * 1 days;
    SaleStarted();
    return firstblock;
  }

  function () payable {
    createTokens(msg.sender);
  }

  function createTokens(address recipient) payable afterStart beforeEnd {
    if (msg.value == 0) {
      throw;
    }

    var numFunders = funders.length;
    Funder f = funders[numFunders++];
    f.addr = msg.sender;
    f.amount = msg.value;

    uint tokens = computeTokenAmount(msg.value); 
    totalSupply = totalSupply.add(tokens);
    transferFrom(target, recipient, tokens);
    Issue(recipient, tokens);
    Issue(target, msg.value);
    
    if (!target.send(msg.value)) {
      throw;
    }
  }

  function end() payable isOwner afterEnd {
    uint ethBalance = target.balance;
    if (ethBalance <= 50000) {
      IcoFailed();
    } else {
      createTokensForOwner();
      IcoSucceeded();
    }
  }

  function refund() payable isOwner afterEnd {
    uint ethBalance = target.balance;
    if (ethBalance <= 50000) {
      for (uint i = 0; i < funders.length; i++) {
        if (funders[i].addr.send(funders[i].amount)) {
          funders[i].addr = 0;
          funders[i].amount = 0;
        } 
      }
    }
  }
  
  function createTokensForOwner() public payable isOwner afterEnd {
    uint ethBalance = target.balance;
    uint tokenSaled = 0;

    for (uint i = 0; i < phases.length; i++) {
      if (ethBalance < ethGoalPerPhase * (i + 1)) {
        uint _ethAmount = ethBalance - ethGoalPerPhase * i;
        if (_ethAmount > 0) {
          tokenSaled = tokenSaled.add(_ethAmount.mul(phases[i]));
        }
      } else {
        tokenSaled = tokenSaled.add(ethGoalPerPhase.mul(phases[i]));
      }
    }

    uint idx = (tokenSaled - 50000) / 10000;
    if (idx >= saleAmountPerThousand.length) {
      idx = saleAmountPerThousand.length - 1;
    }

    uint tokenAmount = tokenSaled.mul((1000 - saleAmountPerThousand[idx])/1000);
    transfer(target, tokenAmount);
  }

  function destroy() payable isOwner afterEnd {
    suicide(target);
  }

  function computeTokenAmount(uint ethAmount) constant returns (uint result) {
    uint ethBalance = target.balance;
    uint quotBefore = ethBalance / ethGoalPerPhase;
    uint quotAfter = (ethBalance +  ethAmount) / ethGoalPerPhase;
    if (quotBefore == quotAfter) {
      return ethAmount.mul(phases[quotBefore]);
    } else {
      uint edgeNumber = quotAfter.mul(ethGoalPerPhase);
      uint preNumber = edgeNumber - ethBalance;
      uint tailNumber = ethBalance + ethAmount - edgeNumber;
      assert(preNumber > 0);
      assert(tailNumber > 0);
      return preNumber.mul(phases[quotBefore]).add(tailNumber.mul(phases[quotAfter]));
    }
  }

  function checkSaleEnded() constant returns (bool result) {
    if (block.number > targetBlocksHeight) {
      SaleEnded();
      return true;
    }

    uint ethBalance = target.balance;
    if (ethBalance >= ethGoalPerPhase * phases.length) {
      SaleEnded();
      return true;
    }
    
    return false;
  }
}
