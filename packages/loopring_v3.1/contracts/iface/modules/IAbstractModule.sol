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
pragma solidity ^0.5.11;
pragma experimental ABIEncoderV2;

import "../IExchangeModule.sol";
import "../IExchangeOwnable.sol";


/// @title  IAbstractModule
/// @author Brecht Devos - <brecht@loopring.org>
contract IAbstractModule is IExchangeModule, IExchangeOwnable
{
    ILoopringV3 public loopring;

    uint32 public exchangeId;
    bool   public onchainDataAvailability;

    IVerificationKeyProvider public vkProvider;

    /// @dev Commits a new block to the virtual blockchain without the proof.
    ///      This function is only callable by the exchange operator.
    ///
    /// @param blockSize The number of onchain or offchain requests/settlements
    ///        that have been processed in this block
    /// @param blockVersion The circuit version to use for verifying the block
    /// @param data The data for this block
    /// @param auxiliaryData Block specific data that is only used to help process the block on-chain.
    ///                      It is not used as input for the circuits and it is not necessary for data-availability.
    /// @param offchainData Arbitrary data, mainly for off-chain data-availability, i.e.,
    ///        the multihash of the IPFS file that contains the block data.
    function commitBlock(
        uint32 blockSize,
        uint16 blockVersion,
        bytes  calldata data,
        bytes  calldata auxiliaryData,
        bytes  calldata offchainData
        )
        external;
}
