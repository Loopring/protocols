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
pragma solidity 0.5.7;

/**
 * @title IBrokerDelegate
 * @author Zack Rubenstein
 */
interface IBrokerDelegate {

  /*
   * Set the allowance on the given token for the specified amount, assuming the 
   * balance attributed to the owner is sufficient.
   *
   * This gets called individually for each transfer required of the broker.
   * Loopring's RingSubmitter calls this and then performs a transfer on the
   * broker's token balance. If the tokens for the given owner address are
   * held in a different contract, they must be moved into the broker's possesion
   * in the execution of this function.
   *
   * owner - the owner of the order who's attributed funds are being requested
   * receivedToken - The token that was received (tokenB)
   * receivedAmount - The amount of the token that was received (amountB)
   * orderTokenRecipient - the tokenRecipient of the order (this is who received the receivedAmount)
   * requestedToken - The token who's approval is being requested (tokenS/feeToken)
   * requestedAmount - The requested amount to be transferred
   * requestedRecipient - The recipient of the requested funds
   * extraOrderData - The transferDataS field of the order
   * isFee - if this is for a fee. If this is true, receivedToken & receivedAmount will be 0 and 0x0
   */
  function brokerRequestAllowance(
    address owner, 
    address receivedToken,
    uint receivedAmount,
    address orderTokenRecipient,
    address requestedToken, 
    uint requestedAmount, 
    address requestedRecipient,
    bytes calldata extraOrderData,
    bool isFee
  ) external;

  /*
   * Get the available token balance controlled by the broker on behalf of an address (owner)
   */
  function brokerBalanceOf(address owner, address token) external view returns (uint);
}
