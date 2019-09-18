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
pragma experimental ABIEncoderV2;

import { IBrokerDelegate } from "../iface/IBrokerDelegate.sol";
import { Data } from "../impl/Data.sol";
import { ERC20 } from "../lib/ERC20.sol"; 

contract DummyBrokerDelegate is IBrokerDelegate {
  event OnOrderFillReport(Data.BrokerInterceptorReport report);

  function brokerRequestAllowance(Data.BrokerApprovalRequest memory request) public returns (bool) {
    ERC20 tokenS = ERC20(request.tokenS);
    tokenS.approve(msg.sender, request.totalRequestedAmountS);

    if (request.totalRequestedFeeAmount > 0) {
      ERC20 feeToken = ERC20(request.feeToken);
      feeToken.approve(msg.sender, request.totalRequestedFeeAmount);
    }

    return true;
  }

  function onOrderFillReport(Data.BrokerInterceptorReport memory fillReport) public {
    emit OnOrderFillReport(fillReport);
  }

  function brokerBalanceOf(address owner, address tokenAddress) public view returns (uint) {
    address payable payableTokenAddress = address(uint160(tokenAddress));
    ERC20 token = ERC20(payableTokenAddress);
    return token.balanceOf(address(this));
  }
}
