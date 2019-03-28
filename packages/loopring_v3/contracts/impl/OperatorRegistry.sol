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
    uint16 public constant NUM_BLOCKS_OPERATOR_ACTIVE                   = 4;

    struct Operator
    {
        address payable owner;
        uint32 ID;
        uint32 activeOperatorIdx;
        uint   amountStaked;
        uint32 unregisterTimestamp;
    }

    struct Realm
    {
        address owner;
        bool closedOperatorRegistering;

        uint numActiveOperators;
        uint totalNumOperators;
        mapping (uint => Operator) operators;
        mapping (uint32 => uint32) activeOperators;          // list idx -> operatorID
    }

    address public lrcAddress                = address(0x0);

    Realm[] private realms;

    constructor(
        address _lrcAddress
        )
        public
    {
        require(_lrcAddress != address(0x0), "ZERO_ADDRESS");
        lrcAddress = _lrcAddress;
    }

    function createRealm(
        address owner,
        bool closedOperatorRegistering
        )
        external
    {
        // TODO: Only allow the exchange contract to call this

        realms.push(
            Realm(
                owner,
                closedOperatorRegistering,
                0,
                0
            )
        );
    }

    function registerOperator(
        uint32 realmID
        )
        external
    {
        Realm storage realm = getRealm(realmID);

        if(realm.closedOperatorRegistering) {
            require(msg.sender == realm.owner, "UNAUTHORIZED");
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
            uint32(realm.totalNumOperators++),
            uint32(realm.numActiveOperators++),
            STAKE_AMOUNT_IN_LRC,
            0
        );
        realm.operators[operator.ID] = operator;
        realm.activeOperators[operator.activeOperatorIdx] = operator.ID;

        uint maxNumOperators = 2 ** 32;
        require(realm.totalNumOperators <= maxNumOperators, "TOO_MANY_OPERATORS");
        require(realm.numActiveOperators <= maxNumOperators, "TOO_MANY_ACTIVE_OPERATORS");

        emit OperatorRegistered(operator.owner, operator.ID);
    }

    function unregisterOperator(
        uint32 realmID,
        uint32 operatorID
        )
        external
    {
        Realm storage realm = getRealm(realmID);

        require(operatorID < realm.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = realm.operators[operatorID];
        require(msg.sender == operator.owner, "UNAUTHORIZED");

        unregisterOperatorInternal(realmID, operatorID);
    }

    function unregisterOperatorInternal(
        uint32 realmID,
        uint32 operatorID
        )
        internal
    {
        Realm storage realm = getRealm(realmID);

        require(operatorID < realm.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = realm.operators[operatorID];
        require(operator.unregisterTimestamp == 0, "OPERATOR_UNREGISTERED_ALREADY");

        // Set the timestamp so we know when the operator is allowed to withdraw his staked LRC
        // (the operator could still have unproven blocks)
        operator.unregisterTimestamp = uint32(now);

        // Move the last operator to the slot of the operator we're unregistering
        require(realm.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");
        uint32 movedOperatorID = uint32(realm.numActiveOperators - 1);
        Operator storage movedOperator = realm.operators[movedOperatorID];
        realm.activeOperators[operator.activeOperatorIdx] = movedOperatorID;
        movedOperator.activeOperatorIdx = operator.activeOperatorIdx;

        // Reduce the length of the array of active operators
        realm.numActiveOperators--;

        emit OperatorUnregistered(operator.owner, operator.ID);
    }

    function ejectOperator(
        uint32 realmID,
        uint32 operatorID
        )
        external
    {
        // TODO: Only allow the exchange contract to call this

        Realm storage realm = getRealm(realmID);

        // Get the operator of the block we're reverting
        Operator storage operator = realm.operators[operatorID];

        // Burn the LRC staked by the operator
        // It's possible the operator already withdrew his stake
        // if it takes a long time before someone calls this function
        if(operator.amountStaked > 0) {
            require(BurnableERC20(lrcAddress).burn(operator.amountStaked), "BURN_FAILURE");
            operator.amountStaked = 0;
        }

        // Unregister the operator (if still registered)
        if (operator.unregisterTimestamp == 0) {
            unregisterOperatorInternal(realmID, operatorID);
        }
    }

    function getActiveOperatorID(
        uint32 realmID
        )
        external
        view
        returns (uint32)
    {
        Realm storage realm = getRealm(realmID);
        require(realm.numActiveOperators > 0, "NO_ACTIVE_OPERATORS");

        // Use a previous blockhash as the source of randomness
        // Keep the operator the same for NUM_BLOCKS_OPERATOR_ACTIVE blocks
        uint blockNumber = block.number - 1;
        bytes32 hash = blockhash(blockNumber - (blockNumber % NUM_BLOCKS_OPERATOR_ACTIVE));
        uint randomOperatorIdx = (uint(hash) % realm.numActiveOperators);

        return realm.activeOperators[uint32(randomOperatorIdx)];
    }

    function getOperatorOwner(
        uint32 realmID,
        uint32 operatorID
        )
        external
        view
        returns (address payable owner)
    {
        Realm storage realm = getRealm(realmID);
        require(operatorID < realm.totalNumOperators, "INVALID_OPERATOR_ID");
        return realm.operators[operatorID].owner;
    }

    function isOperatorRegistered(
        uint32 realmID,
        uint32 operatorID
        )
        external
        view
        returns (bool)
    {
        Realm storage realm = getRealm(realmID);
        require(operatorID < realm.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = realm.operators[operatorID];
        return operator.unregisterTimestamp == 0;
    }

    function getNumActiveOperators(
        uint32 realmID
        )
        external
        view
        returns (uint)
    {
        Realm storage realm = getRealm(realmID);
        return realm.numActiveOperators;
    }

    function getActiveOperatorAt(
        uint32 realmID,
        uint32 index
        )
        external
        view
        returns (address owner, uint32 operatorID)
    {
        Realm storage realm = getRealm(realmID);
        Operator storage operator = realm.operators[realm.activeOperators[index]];
        owner = operator.owner;
        operatorID = operator.ID;
    }

    function withdrawOperatorStake(
        uint32 realmID,
        uint32 operatorID
        )
        external
    {
        Realm storage realm = getRealm(realmID);

        require(operatorID < realm.totalNumOperators, "INVALID_OPERATOR_ID");
        Operator storage operator = realm.operators[operatorID];

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

    function getRealm(
        uint32 realmID
        )
        internal
        view
        returns (Realm storage realm)
    {
        require(realmID < realms.length, "INVALID_MODE_ID");
        realm = realms[realmID];
    }
}
