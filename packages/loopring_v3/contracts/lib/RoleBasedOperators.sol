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


/// @title RoleBasedOperators
/// @dev A Role-based operator manager.
/// @author Daniel Wang - <daniel@loopring.org>
contract RoleBasedOperators
{
    struct Operator {
        uint id;
        uint roles;
    }

    uint public constant ROOT = 1;

    address[] public operatorAddresses;
    mapping (address => Operator) public operatorMap;

    event OperatorAdded(address who, uint roles);
    event OperatorRemoved(address who);

    /// @dev Return an address's operator roles.
    /// @param who The address
    /// @return roles The address's roles
    function getRoles(
        address who
        )
        public
        view
        returns (uint roles)
    {
        return operatorMap[who].roles;
    }

    /// @dev Return if an address has all the roles.
    /// @param who The address
    /// @param roleMask The required roles.
    function hasAllRoles(
        address who,
        uint    roleMask)
        public
        view
        returns (bool)
    {
        require(roleMask != 0, "NO_ROLES");
        return (operatorMap[who].roles & roleMask == roleMask);
    }

    /// @dev Return if an address has at least one of the roles.
    /// @param who The address
    /// @param roleMask The required roles.
    function hasAnyRoles(
        address who,
        uint    roleMask)
        public
        view
        returns (bool)
    {
        require(roleMask != 0, "NO_ROLES");
        return (operatorMap[who].roles & roleMask != 0);
    }

    /// @dev Throws if called by any address that does not have all the roles.
    modifier onlyOperatorsWithAllRoles(
        uint roleMask
        )
    {
        require(hasAllRoles(msg.sender, roleMask), "UNAUTHORIZED");
        _;
    }

    /// @dev Throws if called by any address that does not have at least one of the roles.
    modifier onlyOperatorsWithAnyRoles(
        uint roleMask
        )
    {
        require(hasAnyRoles(msg.sender, roleMask), "UNAUTHORIZED");
        _;
    }

    /// @dev Add a new operator with roles or replace an existing operator with the new roles.
    ///      The first operator to add must have ROOT as its role; all other operators can only
    ///      be added by operators with ROOT role.
    /// @param who The operator to add or replace.
    /// @param roles The required roles.
    function addOperator(
        address who,
        uint    roles)
        public
    {
        require(roles != 0, "NO_ROLES");

        Operator storage operator = operatorMap[who];

        if (operator.id == 0) {
            if (operatorAddresses.length == 0) {
                require(roles & ROOT != 0, "NEED_A_ROOT");
            } else {
                // require(msg.sender != who, "SELF_OP_FORBIDDEN");
                require(hasAnyRoles(msg.sender, ROOT), "UNAUTHORIZED");
            }

            operatorAddresses.push(who);
            operator.id = operatorAddresses.length;
            operator.roles = roles;
        } else {
            require(operatorMap[who].roles != roles, "ALREADY_EXIST");
            require(hasAnyRoles(msg.sender, ROOT), "UNAUTHORIZED");
            operatorMap[who].roles = roles;
        }

        emit OperatorAdded(who, roles);
    }

    /// @dev Remove an operator, only callable by operators with ROOT role.
    /// @param who The operator to remove.
    function removeOperator(
        address who
        )
        public
        onlyOperatorsWithAllRoles(ROOT)
        returns (bool success)
    {
        // require(msg.sender != who, "SELF_OP_FORBIDDEN");
        Operator storage operator = operatorMap[who];

        if (operator.id != 0) {
            uint num = operatorAddresses.length;
            if (operator.id != num) {
                address lastOperator = operatorAddresses[num - 1];
                operatorAddresses[operator.id - 1] = lastOperator;
                operatorMap[lastOperator].id = operator.id;
            }

            operatorAddresses.length -= 1;
            delete operatorMap[who];

            success = true;
            emit OperatorRemoved(who);
        }
    }

}
