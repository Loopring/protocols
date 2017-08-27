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
pragma solidity ^0.4.11;

import '../SafeMath.sol';
import './Token.sol';

/// @title Mid-Team Holding Incentive Program
/// @author Daniel Wang - <daniel@loopring.org>, Kongliang Zhong - <kongliang@loopring.org>.
/// For more information, please visit https://loopring.org.
contract LRCMidTermHoldingContract {
    using SafeMath for uint;

    // During the first 90 days of deployment, this contract opens for deposit of LRC
    // in exchange of ETH.
    uint public constant DEPOSIT_WINDOW                 = 60 days;

    // For each address, its LRC can only be withdrawn between 180 and 270 days after LRC deposit,
    // which means:
    //    1) LRC are locked during the first 180 days,
    //    2) LRC will be sold to the `owner` with the specified `RATE` 270 days after the deposit.
    uint public constant WITHDRAWAL_DELAY               = 180 days;
    uint public constant WITHDRAWAL_WINDOW              = 90  days;

    uint public constant MAX_LRC_DEPOSIT_PER_ADDRESS    = 150000 ether; // = 20 ETH * 7500

    // 7500 LRC for 1 ETH. This is the best token sale rate ever.
    uint public constant RATE       = 7500; 

    address public lrcTokenAddress  = 0x0;
    address public owner            = 0x0;

    // Some stats
    uint public lrcReceived         = 0;
    uint public lrcSent             = 0;
    uint public ethReceived         = 0;
    uint public ethSent             = 0;

    uint public depositStartTime    = 0;
    uint public depositStopTime     = 0;

    bool public closed              = false;

    struct Record {
        uint lrcAmount;
        uint timestamp;
    }

    mapping (address => Record) records;
    
    /* 
     * EVENTS
     */
    /// Emitted for each sucuessful deposit.
    uint public depositId = 0;
    event Deposit(uint _depositId, address _addr, uint _ethAmount, uint _lrcAmount);

    /// Emitted for each sucuessful withdrawal.
    uint public withdrawId = 0;
    event Withdrawal(uint _withdrawId, address _addr, uint _ethAmount, uint _lrcAmount);

    /// Emitted when this contract is closed.
    event Closed(uint _ethAmount, uint _lrcAmount);

    /// Emitted when ETH are drained.
    event Drained(uint _ethAmount);

    
    /// CONSTRUCTOR 
    /// @dev Initialize and start the contract.
    /// @param _lrcTokenAddress LRC ERC20 token address
    /// @param _owner Owner of this contract
    function LRCMidTermHoldingContract(address _lrcTokenAddress, address _owner) {
        require(_lrcTokenAddress != 0x0);
        require(_owner != 0x0);

        lrcTokenAddress = _lrcTokenAddress;
        owner = _owner;

        depositStartTime = now;
        depositStopTime  = now + DEPOSIT_WINDOW;
    }

    /*
     * PUBLIC FUNCTIONS
     */

    /// @dev Get back ETH to `owner`.
    /// @param ethAmount Amount of ETH to drain back to owner
    function drain(uint ethAmount) public payable {
        require(!closed);
        require(msg.sender == owner);
        
        uint amount = ethAmount.min256(this.balance);
        require(amount > 0);
        require(owner.send(amount));

        Drained(amount);
    }

    /// @dev Get all ETH and LRC back to `owner`.
    function close() public payable {
        require(!closed);
        require(msg.sender == owner);
        require(now > depositStopTime + WITHDRAWAL_DELAY + WITHDRAWAL_WINDOW); 

        uint ethAmount = this.balance;
        if (ethAmount > 0) {
          require(owner.send(ethAmount));
        }

        var lrcToken = Token(lrcTokenAddress);
        uint lrcAmount = lrcToken.balanceOf(address(this));
        if (lrcAmount > 0) {
          require(lrcToken.transfer(owner, lrcAmount));
        }

        closed = true;
        Closed(ethAmount, lrcAmount);
    }

    /// @dev This default function allows simple usage.
    function () payable {
        if (msg.sender == owner) {
           require(!closed);
        } else if (now <= depositStopTime) {
            depositLRC();
        } else if (now > depositStopTime){
            withdrawLRC();
        }
    }

  
    /// @dev Deposit LRC for ETH.
    /// If user send x ETH, this method will try to transfer `x * 100 * 6500` LRC from
    /// the user's address and send `x * 100` ETH to the user.
    function depositLRC() payable {
        require(!closed && msg.sender != owner);
        require(now <= depositStopTime);
        require(msg.value == 0);

        var record = records[msg.sender];
        var lrcToken = Token(lrcTokenAddress);

        uint lrcAmount = this.balance.mul(RATE)
            .min256(lrcToken.balanceOf(msg.sender))
            .min256(lrcToken.allowance(msg.sender, address(this)))
            .min256(MAX_LRC_DEPOSIT_PER_ADDRESS - record.lrcAmount);

        uint ethAmount = lrcAmount.div(RATE);
        lrcAmount = ethAmount.mul(RATE);

        require(lrcAmount > 0 && ethAmount > 0);

        record.lrcAmount += lrcAmount;
        record.timestamp = now;
        records[msg.sender] = record;

        lrcReceived += lrcAmount;
        ethSent += ethAmount;

        require(lrcToken.transferFrom(msg.sender, address(this), lrcAmount));
        require(msg.sender.send(ethAmount));

        Deposit(
             depositId++,
             msg.sender,
             ethAmount,
             lrcAmount
        );      
    }

    /// @dev Withdrawal LRC with ETH transfer.
    function withdrawLRC() payable {
        require(!closed && msg.sender != owner);
        require(now > depositStopTime);
        require(msg.value > 0);

        var record = records[msg.sender];
        require(now >= record.timestamp + WITHDRAWAL_DELAY);
        require(now <= record.timestamp + WITHDRAWAL_DELAY + WITHDRAWAL_WINDOW);

        uint ethAmount = msg.value.min256(record.lrcAmount.div(RATE));
        uint lrcAmount = ethAmount.mul(RATE);

        record.lrcAmount -= lrcAmount;
        if (record.lrcAmount == 0) {
            delete records[msg.sender];
        } else {
            records[msg.sender] = record;
        }

        lrcSent += lrcAmount;
        ethReceived += ethAmount;

        require(Token(lrcTokenAddress).transfer(msg.sender, lrcAmount));

        uint ethRefund = msg.value - ethAmount;
        if (ethRefund > 0) {
            require(msg.sender.send(ethRefund));
        }

        Withdrawal(
             withdrawId++,
             msg.sender,
             ethAmount,
             lrcAmount
        ); 
    }
}

