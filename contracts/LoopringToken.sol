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
  uint public constant ethGoalPerPhase = 20000 ether;
  //address public target = 0xaea169db31cdd2375bafc08fdb2b56e437edafc6;
  address public target = 0x249acd967f6eb5b8907e5c888cbd8a005d0b23f4;
  uint public firstblock = 0;
  uint public targetInitBalance;
  bool public isTokensCreatedForOwner = false;

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
    targetInitBalance = target.balance;
    SaleStarted();

    return firstblock;
  }

  function () payable {
    createTokens(msg.sender);
  }

  function createTokens(address recipient) payable afterStart beforeEnd {
    assert(msg.value >= 0.01 ether);

    var numFunders = funders.length;
    Funder f = funders[numFunders++];
    f.addr = msg.sender;
    f.amount = msg.value;

    uint tokens = computeTokenAmount(msg.value);
    totalSupply = totalSupply.add(tokens);
    balances[recipient] = balances[recipient].add(tokens);

    Issue(recipient, tokens);
    Issue(target, msg.value);

    if (!target.send(msg.value)) {
      throw;
    }
  }

  function computeTokenAmount(uint ethAmount) constant returns (uint result) {
    uint ethBalance = target.balance.sub(targetInitBalance);
    uint quotBefore = ethBalance / ethGoalPerPhase;
    if (quotBefore >= (phases.length - 1)) {
      return ethAmount.mul(phases[phases.length - 1]);
    }

    uint quotAfter = (ethBalance +  ethAmount) / ethGoalPerPhase;
    if (quotBefore == quotAfter) {
      return ethAmount.mul(phases[quotBefore]);
    } else {
      uint edgeNumber = quotAfter.mul(ethGoalPerPhase);
      uint preNumber = edgeNumber.sub(ethBalance);
      uint tailNumber = ethAmount.sub(preNumber);
      assert(preNumber > 0);
      assert(tailNumber > 0);
      return preNumber.mul(phases[quotBefore]).add(tailNumber.mul(phases[quotAfter]));
    }
  }

  function end() isOwner afterEnd {
    uint ethBalance = target.balance.sub(targetInitBalance);
    if (ethBalance <= 50000) {
      IcoFailed();
    } else {
      createTokensForOwner();
      IcoSucceeded();
    }
  }

  function refund() isOwner afterEnd {
    uint ethBalance = target.balance.sub(targetInitBalance);
    if (ethBalance <= 50000) {
      for (uint i = 0; i < funders.length; i++) {
        uint amount = funders[i].amount;
        funders[i].amount = 0;
        funders[i].addr = 0;
        funders[i].addr.transfer(amount);
      }
    }
  }

  function createTokensForOwner() public isOwner afterEnd {
    if (!isTokensCreatedForOwner) {
      uint tokenAmount = tokenAmountForOwner();
      totalSupply = totalSupply.add(tokenAmount);
      balances[target] = balances[target].add(tokenAmount);

      Issue(target, tokenAmount);
      isTokensCreatedForOwner = true;
    } else {
      InvalidState("tokens already created for owner.");
    }
  }

  function tokenAmountForOwner() constant returns (uint result) {
    uint ethBalance = target.balance.sub(targetInitBalance);

    assert(ethBalance > 50000 ether);
    uint tokenSaled =  0;

    for (uint i = 0; i < phases.length; i++) {
      if (ethBalance < ethGoalPerPhase * (i + 1)) {
        uint _ethAmount = ethBalance - ethGoalPerPhase * i;
        tokenSaled = tokenSaled.add(_ethAmount.mul(phases[i]));
        break;
      } else {
        tokenSaled = tokenSaled.add(ethGoalPerPhase.mul(phases[i]));
      }
    }

    if (ethBalance > ethGoalPerPhase * phases.length) {
      uint _ethAmountTail = ethBalance - ethGoalPerPhase * phases.length;
      tokenSaled = tokenSaled.add(_ethAmountTail.mul(phases[phases.length - 1]));
    }

    uint idx = (ethBalance - 50000 ether) / (10000 ether);
    if (idx >= saleAmountPerThousand.length) {
      idx = saleAmountPerThousand.length - 1;
    }
    uint16 saleThousandth = saleAmountPerThousand[idx];

    uint tokenAmount = tokenSaled.mul(1000 - saleThousandth) / saleThousandth;
    
    return tokenAmount;
  }

  function destroy() payable isOwner afterEnd {
    suicide(target);
  }

  function checkSaleEnded() constant returns (bool result) {
    if (block.number > targetBlocksHeight) {
      SaleEnded();
      return true;
    }

    uint ethBalance = target.balance.sub(targetInitBalance);
    if (ethBalance >= ethGoalPerPhase * phases.length) {
      SaleEnded();
      return true;
    }

    return false;
  }
}
