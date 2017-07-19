/*

  Copyright 2017 Loopring Foundation.

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
pragma solidity ^0.4.11;

import "./StandardToken.sol";


/// @title Loopring Protocol Token.
/// For more information about this token sale, please visit https://loopring.org
/// @author:
///     Kongliang Zhong - <kongliang@loopring.org>
///     Daniel Wang - <daniel@loopring.org>
contract LoopringToken is StandardToken {
    string public constant NAME = "LoopringCoin";
    string public constant SYMBOL = "LRC";
    uint public constant DECIMALS = 18;

    /// During token sale, we use one consistent price: 5000 LRC/ETH.
    /// We split the entire token sale period into 10 phases, each
    /// phase has a different bonus setting as specified in `bonusPercentages`.
    /// The real price for phase i is `(1 + bonusPercentages[i]/100.0) * BASE_RATE`.
    /// The first phase or early-bird phase has a much higher bonus.
    uint8[10] public bonusPercentages = [
        20,
        16,
        14,
        12,
        10,
        8,
        6,
        4,
        2,
        0
    ];

    uint public constant NUM_OF_PHASE = 10;
  
    /// Each phase contains exactly 15250 Ethereum blocks, which is roughly 3 days,
    /// which makes this 10-phase sale period roughly 30 days.
    /// See https://www.ethereum.org/crowdsale#scheduling-a-call
    uint16 public constant BLOCKS_PER_PHASE = 10;

    /// This is where we hold ETH during this token sale. We will not transfer any Ether
    /// out of this address before we invocate the `close` function to finalize the sale. 
    /// This promise is not guanranteed by smart contract by can be verified with public
    /// Ethereum transactions data available on several blockchain browsers.
    /// This is the only address from which `start` and `close` can be invocated.
    ///
    /// Note: this will be initialized during the contract deployment.
    address public target;

    /// `firstblock` specifies from which block our token sale starts.
    /// This can only be modified once by the owner of `target` address.
    uint public firstblock = 0;

    /// Indicates whether unsold token have been issued. This part of LRC token
    /// is managed by the project team and is issued directly to `target`.
    bool public unsoldTokenIssued = false;

    /// Minimum amount of funds to be raised for the sale to succeed. 
    uint256 public constant GOAL = 0.01 ether;

    /// Maximum amount of fund to be raised, the sale ends on reaching this amount.
    uint256 public constant HARD_CAP = 0.1 ether;

    /// Maximum unsold ratio, this is hit when the mininum level of amount of fund is raised.
    uint public constant MAX_UNSOLD_RATIO = 675; // 67.5%

    /// Base exchange rate is set to 1 ETH = 5000 LRC.
    uint256 public constant BASE_RATE = 5000;

    /// A simple stat for emitting events.
    uint public totalEthReceived = 0;

    /// Issue event index starting from 0.
    uint public issueIndex = 0;

    /* 
     * EVENTS
     */

    /// Emitted only once after token sale starts.
    event SaleStarted();

    /// Emitted only once after token sale ended (all token issued).
    event SaleEnded();

    /// Emitted when a function is invocated by unauthorized addresses.
    event InvalidCaller(address caller);

    /// Emitted when a function is invocated without the specified preconditions.
    /// This event will not come alone with an exception.
    event InvalidState(bytes msg);

    /// Emitted for each sucuessful token purchase.
    event Issue(uint issueIndex, address addr, uint ethAmount, uint tokenAmount);

    /// Emitted if the token sale succeeded.
    event SaleSucceeded();

    /// Emitted if the token sale failed.
    /// When token sale failed, all Ether will be return to the original purchasing
    /// address with a minor deduction of transaction fee（gas)
    event SaleFailed();

    /*
     * MODIFIERS
     */

    modifier onlyOwner {
        if (target == msg.sender) {
            _;
        } else {
            InvalidCaller(msg.sender);
        }
    }

    modifier beforeStart {
        if (!saleStarted()) {
            _;
        } else {
            InvalidState("Sale has not started yet");
        }
    }

    modifier inProgress {
        if (saleStarted() && !saleEnded()) {
            _;
        } else {
            InvalidState("Sale is not in progress");
        }
    }

    modifier afterEnd {
        if (saleEnded()) {
            _;
        } else {
            InvalidState("Sale is not ended yet");
        }
    }

    /**
     * CONSTRUCTOR 
     * 
     * @dev Initialize the Loopring Token
     * @param _target The escrow account address, all ethers will
     * be sent to this address.
     * This address will be : 0x00073F7155459C9205010Cb3453a0f392a0C3210
     */
    function LoopringToken(address _target) {
        target = _target;
    }

    /*
     * PUBLIC FUNCTIONS
     */

    /// @dev Start the token sale.
    /// @param _firstblock The block from which the sale will start.
    function start(uint _firstblock) public onlyOwner beforeStart {
        if (_firstblock <= block.number) {
            // Must specify a block in the future.
            throw;
        }

        firstblock = _firstblock;
        SaleStarted();
    }

    /// @dev Triggers unsold tokens to be issued to `target` address.
    function close() public onlyOwner afterEnd {
        if (totalEthReceived < GOAL) {
            SaleFailed();
        } else {
            issueUnsoldToken();
            SaleSucceeded();
        }
    }

    /// @dev This default function allows token to be purchased by directly
    /// sending ether to this smart contract.
    function () payable {
        issueToken(msg.sender);
    }

    /// @dev Issue token based on Ether received.
    /// @param recipient Address that newly issued token will be sent to.
    function issueToken(address recipient) payable inProgress {
        uint tokens = computeTokenAmount(msg.value);
        totalEthReceived = totalEthReceived.add(msg.value);
        totalSupply = totalSupply.add(tokens);
        balances[recipient] = balances[recipient].add(tokens);

        Issue(
            issueIndex++,
            recipient,
            msg.value,
            tokens
        );

        if (!target.send(msg.value)) {
            throw;
        }
    }

    /*
     * INTERNAL FUNCTIONS
     */
  
    /// @dev Compute the amount of LRC token that can be purchased.
    /// @param ethAmount Amount of Ether to purchase LRC.
    /// @return Amount of LRC token to purchase
    function computeTokenAmount(uint ethAmount) internal returns (uint tokens) {
        uint phase = (block.number - firstblock).div(BLOCKS_PER_PHASE);

        // A safe check
        if (phase >= bonusPercentages.length) {
            phase = bonusPercentages.length - 1;
        }

        uint tokenBase = ethAmount.mul(BASE_RATE);
        uint tokenBonus = tokenBase.mul(bonusPercentages[phase]).div(100);

        tokens = tokenBase.add(tokenBonus);
    }

    /// @dev Issue unsold token to `target` address.
    /// The math is as follows:
    ///   +-------------------------------------------------------------+
    ///   |       Total Ethers Received        |                        |
    ///   +------------------------------------+  Unsold Token Portion  |
    ///   |   Lower Bound   |   Upper Bound    |                        |
    ///   +-------------------------------------------------------------+
    ///   |      50,000     |     60,000       |         67.5%          |
    ///   +-------------------------------------------------------------+
    ///   |      60,000     |     70,000       |         65.0%          |
    ///   +-------------------------------------------------------------+
    ///   |      70,000     |     80,000       |         62.5%          |
    ///   +-------------------------------------------------------------+
    ///   |      80,000     |     90,000       |         60.0%          |
    ///   +-------------------------------------------------------------+
    ///   |      90,000     |    100,000       |         57.5%          |
    ///   +-------------------------------------------------------------+
    ///   |     100,000     |    110,000       |         55.0%          |
    ///   +-------------------------------------------------------------+
    ///   |     110,000     |    120,000       |         52.5%          |
    ///   +-------------------------------------------------------------+
    ///   |     120,000     |                  |         50.0%          |
    ///   +-------------------------------------------------------------+
    function issueUnsoldToken() internal {
        if (unsoldTokenIssued) {
            InvalidState("Unsold token has been issued already");
        } else {
            // Add another safe guard 
            require(totalEthReceived >= GOAL);

            uint level = totalEthReceived.sub(GOAL).div(10000 ether);
            if (level > 7) {
                level = 7;
            }

            uint unsoldRatioInThousand = MAX_UNSOLD_RATIO - 25 * level;


            // Calculate the `unsoldToken` to be issued, the amount of `unsoldToken`
            // is based on the issued amount, that is the `totalSupply`, during 
            // the sale:
            //                   totalSupply
            //   unsoldToken = --------------- * r
            //                      1 - r
            uint unsoldToken = totalSupply.div(1000 - unsoldRatioInThousand).mul(unsoldRatioInThousand);

            // Adjust `totalSupply`.
            totalSupply = totalSupply.add(unsoldToken);
            // Issue `unsoldToken` to the target account.
            balances[target] = balances[target].add(unsoldToken);

            Issue(
                issueIndex++,
                target,
                0,
                unsoldToken
            );
            
            unsoldTokenIssued = true;
        }
    }

    /// @return true if sale has started, false otherwise.
    function saleStarted() constant returns (bool) {
        return (firstblock > 0 && block.number >= firstblock);
    }

    /// @return true if sale has ended, false otherwise.
    function saleEnded() constant returns (bool) {
        return firstblock > 0 && (saleDue() || hardCapReached());
    }

    /// @return true if sale is due when the last phase is finished.
    function saleDue() constant returns (bool) {
        return block.number >= firstblock + BLOCKS_PER_PHASE * NUM_OF_PHASE;
    }

    /// @return true if the hard cap is reached.
    function hardCapReached() constant returns (bool) {
        return totalEthReceived >= HARD_CAP;
    }
}

