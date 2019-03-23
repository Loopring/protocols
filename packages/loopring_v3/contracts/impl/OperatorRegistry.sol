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
pragma solidity 0.5.2;

import "../iface/IOperatorRegistry.sol";

import "../lib/BurnableERC20.sol";
import "../lib/ERC20SafeTransfer.sol";
import "../lib/MathUint.sol";
import "../lib/NoDefaultFunc.sol";


/// @title An Implementation of IOperatorRegistry.
/// @author Brecht Devos - <brecht@loopring.org>,
contract OperatorRegistry is IOperatorRegistry, NoDefaultFunc
{
    using MathUint          for uint;
    using ERC20SafeTransfer for address;

    uint   public constant STAKE_AMOUNT_IN_LRC                          = 100000 ether;
    uint32 public constant MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW         = 1 days;

    struct Operator
    {
        address payable owner;
        uint32 ID;
        uint32 activeOperatorIdx;
        uint   amountStaked;
        uint32 unregisterTimestamp;
    }

    struct State
    {
        address owner;
        bool closedOperatorRegistering;

        uint numActiveOperators;
        uint totalNumOperators;
        mapping (uint => Operator) operators;
        mapping (uint32 => uint32) activeOperators;          // list idx -> operatorID
    }

    address public lrcAddress                = address(0x0);

    State[] private states;

    constructor(
        address _lrcAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");
        lrcAddress = _lrcAddress;
    }

    function createNewState(
        address owner,
        bool closedOperatorRegistering
        )
        external
    {
        // TODO: Only allow the exchange contract to call this

        State memory memoryState = State(
            owner,
            closedOperatorRegistering,
            0,
            0
        );
        states.push(memoryState);
    }

    function registerOperator(
        uint32 stateID
        )
        external
    {
        State storage state = getState(stateID);

        if(state.closedOperatorRegistering) {
            require(msg.sender == state.owner, "UNAUTHORIZED");
        }

        // Move the LRC to this contract
        require(
            lrcAddress.safeTransferFrom(
                msg.sender,
                address(this),
                STAKE_AMOUNT_IN_LRC
            ),
            "TRANSFER_FAILURE"
        );

        // Add the operator
        Operator memory operator = Operator(
            msg.sender,
            uint32(state.totalNumOperators++),
            uint32(state.numActiveOperators++),
            STAKE_AMOUNT_IN_LRC,
            0
        );
        state.operators[operator.ID] = operator;
        state.activeOperators[operator.activeOperatorIdx] = operator.ID;

        uint maxNumOperators = 2 ** 32;
        require(state.totalNumOperators <= maxNumOperators, "TOO_MANY_OPERATORS");
        require(state.numActiveOperators <= maxNumOperators, "TOO_MANY_ACTIVE_OPERATORS");

        emit OperatorRegistered(operator.owner, operator.ID);
    }

    function unregisterOperator(
        uint32 stateID,
        uint32 operatorID
        )
        external
    {
        State storage state = getState(stateID);

        require(operatorID < state.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = state.operators[operatorID];
        require(msg.sender == operator.owner, "UNAUTHORIZED");

        unregisterOperatorInternal(stateID, operatorID);
    }

    function unregisterOperatorInternal(
        uint32 stateID,
        uint32 operatorID
        )
        internal
    {
        State storage state = getState(stateID);

        require(operatorID < state.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = state.operators[operatorID];
        require(operator.unregisterTimestamp == 0, "OPERATOR_UNREGISTERED_ALREADY");

        // Set the timestamp so we know when the operator is allowed to withdraw his staked LRC
        // (the operator could still have unproven blocks)
        operator.unregisterTimestamp = uint32(now);

        // Move the last operator to the slot of the operator we're unregistering
        require(state.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");
        uint32 movedOperatorID = uint32(state.numActiveOperators - 1);
        Operator storage movedOperator = state.operators[movedOperatorID];
        state.activeOperators[operator.activeOperatorIdx] = movedOperatorID;
        movedOperator.activeOperatorIdx = operator.activeOperatorIdx;

        // Reduce the length of the array of active operators
        state.numActiveOperators--;

        emit OperatorUnregistered(operator.owner, operator.ID);
    }

    function ejectOperator(
        uint32 stateID,
        uint32 operatorID
        )
        external
    {
        // TODO: Only allow the exchange contract to call this

        State storage state = getState(stateID);

        // Get the operator of the block we're reverting
        Operator storage operator = state.operators[operatorID];

        // Burn the LRC staked by the operator
        // It's possible the operator already withdrew his stake
        // if it takes a long time before someone calls this function
        if(operator.amountStaked > 0) {
            require(BurnableERC20(lrcAddress).burn(operator.amountStaked), "BURN_FAILURE");
            operator.amountStaked = 0;
        }

        // Unregister the operator (if still registered)
        if (operator.unregisterTimestamp == 0) {
            unregisterOperatorInternal(stateID, operatorID);
        }
    }

    function getActiveOperatorID(
        uint32 stateID
        )
        external
        view
        returns (uint32)
    {
        State storage state = getState(stateID);
        require(state.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");

        // Use a previous blockhash as the source of randomness
        // Keep the operator the same for 4 blocks
        uint blockNumber = block.number - 1;
        bytes32 hash = blockhash(blockNumber - (blockNumber % 4));
        uint randomOperatorIdx = (uint(hash) % state.numActiveOperators);

        return state.activeOperators[uint32(randomOperatorIdx)];
    }

    function getOperatorOwner(
        uint32 stateID,
        uint32 operatorID
        )
        external
        view
        returns (address payable owner)
    {
        State storage state = getState(stateID);
        require(operatorID < state.totalNumOperators, "INVALID_OPERATOR_ID");
        return state.operators[operatorID].owner;
    }

    function isOperatorRegistered(
        uint32 stateID,
        uint32 operatorID
        )
        external
        view
        returns (bool)
    {
        State storage state = getState(stateID);
        require(operatorID < state.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = state.operators[operatorID];
        return operator.unregisterTimestamp == 0;
    }

    function getNumActiveOperators(
        uint32 stateID
        )
        external
        view
        returns (uint)
    {
        State storage state = getState(stateID);
        return state.numActiveOperators;
    }

    function getActiveOperatorAt(
        uint32 stateID,
        uint32 index
        )
        external
        view
        returns (address owner, uint32 operatorID)
    {
        State storage state = getState(stateID);
        Operator storage operator = state.operators[state.activeOperators[index]];
        owner = operator.owner;
        operatorID = operator.ID;
    }

    function withdrawOperatorStake(
        uint32 stateID,
        uint32 operatorID
        )
        external
    {
        State storage state = getState(stateID);

        require(operatorID < state.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = state.operators[operatorID];

        require(operator.unregisterTimestamp > 0, "OPERATOR_STILL_REGISTERED");
        require(operator.amountStaked > 0, "WITHDRAWN_ALREADY");
        require(
            now > operator.unregisterTimestamp + MIN_TIME_UNTIL_OPERATOR_CAN_WITHDRAW,
            "TOO_EARLY_TO_WITHDRAW"
        );

        uint amount = operator.amountStaked;
        // Make sure it cannot be withdrawn again
        operator.amountStaked = 0;

        require(
            lrcAddress.safeTransfer(
                operator.owner,
                amount
            ),
            "TRANSFER_FAILURE"
        );
    }

    function getState(
        uint32 stateID
        )
        internal
        view
        returns (State storage state)
    {
        require(stateID < states.length, "INVALID_STATE_ID");
        state = states[stateID];
    }
}
