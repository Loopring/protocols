pragma solidity ^0.4.11;

import "./StandardToken.sol";

/**
   @title Loopring Protocol Token.
   For more information about this token sale, please visit https://loopring.org
   foundation@loopring.org
*/
contract LoopringToken is StandardToken {

  string public constant name = "LoopringCoin";
  string public constant symbol = "LRC";
  uint public constant decimals = 18;

  /*
    During token sale, we use one consistent price: 5000LRC/ETH.
    We splict the entire token sale period into 10 phases, each
    phase has a different bonus setting as specified in `bonusPercentages`.
    The real price for phase i is `(1 + bonusPercentages[i]/100.0) * 5000LRC/ETH`.

    The first phase or early-bird phase has a much higher bonus.
  */
  uint8[10] public bonusPercentages = [20, 16, 14, 12, 10, 8, 6, 4, 2, 0];

  /*
    Each phase contains exactly 15250 Ethereum blocks, which is roughly 3 days,
    which makes this 10-phase sale period roughly 30 days.
    See https://www.ethereum.org/crowdsale#scheduling-a-call
  */
  uint16 public constant blocksPerPhase = 15250;

  /*
    This is where we hold ETH during this token sale. We will not transfer any Ether
    out of this address before we invocate the `close` function to finalize the sale. 
    This promise is not guanranteed by smart contract by can be verified with public
    Ethereum transactions data available on several blockchain browsers.

    This is the only address from which `start` and `close` can be invocated.

    TODO(dongw): this address will change!!!
  */
  address public constant target = 0x249acd967f6eb5b8907e5c888cbd8a005d0b23f4;

  /*
    `firstblock` specifies from which block our token sale starts.
    This can only be modified once by the owner of `target` address.
  */
  uint public firstblock = 0;

  /*
    Indicates whether unsold token have been issued. This part of LRC token
    is managed by the project team and is issued directly to `target`.
  */

  bool public unsoldTokenIssued = false;

  /*
    A simple stat for emitting events.
  */
  uint public totalEthReceived = 0;

  // EVENTS -----------------------------------------------

  /*
    Emitted only once after token sale starts.
  */
  event SaleStarted();

  /*
    Emitted only once after token sale ended (all token issued).
  */
  event SaleEnded();

  /*
    Emitted when a function is invocated by unauthorized addresses.
  */
  event InvalidCaller(address caller);

  /*
    Emitted when a function is invocated without the specified preconditions.
    This event will not come alone with an exception.
  */
  event InvalidState(bytes msg);

  /*
    Emitted for each sucuessful token purchase.
  */
  event Issue(address addr, uint ethAmount, uint tokenAmount);

  /*
    Emitted if the token sale succeeded.
  */
  event SaleSucceeded();

  /*
    Emitted if the token sale failed.
    When token sale failed, all Ether will be return to the original purchasing
    address with a minor deduction of transaction fee（gas)
  */
  event SaleFailed();

  // MODIFIERS --------------------------------------------

  modifier isOwner {
    if (target == msg.sender) {
      _;
    }
    else InvalidCaller(msg.sender);
  }

  modifier beforeStart {
    if (!saleStarted()) {
      _;
    }
    else InvalidState("Sale not started yet");
  }

  modifier inProgress {
    if (saleStarted() && !saleEnded()) {
      _;
    } else InvalidState("Sale not in progress");
  }

  modifier afterEnd {
    if (saleEnded()) {
      _;
    }
    else InvalidState("Sale not ended yet");
  }

  // PUBLIC FUNCTIONS -------------------------------------

  /**
     Start the token sale by specifying the starting block.
  */
  function start(uint _firstblock) public isOwner beforeStart {
    if (_firstblock <= block.number) {
      // Must specified a block in the future.
      throw;
    }

    firstblock = _firstblock;
    SaleStarted();
  }

  /**
     Triggers unsold tokens to be issued to `target` address.
  */
  function close() public isOwner afterEnd {
    if (totalEthReceived < 50000 ether) {
      SaleFailed();
    } else {
      issueUnsoldToken();
      SaleSucceeded();
    }
  }

  /**
     This default function allows token to be purchased by directly
     sending ether to this smart contract.
  */
  function () payable {
    issueToken(msg.sender);
  }

  // INTERNAL FUNCTIONS -----------------------------------

  function issueToken(address recipient) payable inProgress {
    // We only accept minimum purchase of 0.01 ETH.
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

  function computeTokenAmount(uint ethAmount) returns (uint tokens) {
    uint phase = (block.number - firstblock).div(blocksPerPhase);

    // A safe check
    if (phase >= bonusPercentages.length) {
      phase = bonusPercentages.length - 1;
    }

    uint tokenBase = ethAmount.mul(5000 /* base price */);
    uint tokenBonus = tokenBase.mul(bonusPercentages[phase]).div(100);

    tokens = tokenBase.add(tokenBonus);
  }

  /**
     Issue unsold token to `target` address.
     The math is as follows:
     if totalEthReceived >= 50K but < 60K, the unsold part is 67.5% of all token;
     if totalEthReceived >= 60K but < 70K, the unsold part is 65.0% of all token;
     if totalEthReceived >= 70K but < 80K, the unsold part is 62.5% of all token;
     if totalEthReceived >= 80K but < 90K, the unsold part is 60.0% of all token;
     if totalEthReceived >= 90K but < 100K, the unsold part is 57.5% of all token;
     if totalEthReceived >= 100K but < 110K, the unsold part is 55.0% of all token;
     if totalEthReceived >= 110K but < 120K, the unsold part is 52.5% of all token;
     if totalEthReceived >= 120K, the unsold part is 50.0% of all token;
  */
  function issueUnsoldToken() {
    if(unsoldTokenIssued) {
      InvalidState("Unsold token issued already");
    } else {
      uint level = totalEthReceived.sub(50000 ether).div(10000 ether);
      if (level > 7) {
        level = 7;
      }

      uint unsoldRatioInThousand = 675 - 25 * level;
      uint unsoldToken = totalSupply.div(1000 - unsoldRatioInThousand).mul(unsoldRatioInThousand);

      totalSupply = totalSupply.add(unsoldToken);
      balances[target] = balances[target].add(unsoldToken);

      Issue(target, 0, unsoldToken);
      unsoldTokenIssued = true;
    }
  }

  function saleStarted() constant returns (bool) {
    return (firstblock > 0 && block.number >= firstblock);
  }

  function saleEnded() constant returns (bool) {
    return firstblock > 0 &&
      ((block.number >= firstblock + blocksPerPhase * 10 /* num of phases */)
       ||(totalEthReceived >= 120000 ether /* upper bound */));
  }
}
