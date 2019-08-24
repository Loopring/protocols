/*
 * Copyright 2019 Dolomite
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
pragma solidity 0.5.7;

import { IBrokerDelegate } from "../iface/IBrokerDelegate.sol";
import { ERC20 } from "../lib/ERC20.sol"; 

contract DummyBrokerDelegate is IBrokerDelegate {

  function brokerRequestAllowance(
    address owner, 
    address tokenAddress, 
    uint amount, 
    bytes memory extraOrderData,
    bool isFee
  ) public {
    address payable payableTokenAddress = address(uint160(tokenAddress));
    ERC20 token = ERC20(payableTokenAddress);
    token.approve(msg.sender, amount);
  }

  function brokerBalanceOf(address owner, address tokenAddress) public view returns (uint) {
    address payable payableTokenAddress = address(uint160(tokenAddress));
    ERC20 token = ERC20(payableTokenAddress);
    return token.balanceOf(address(this));
  }
}
