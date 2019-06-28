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

import "./MintableERC20.sol";
import "./MathUint.sol";
import "./Ownable.sol";

/// @title MintableNonTransferableERC20Token - An mintable & non-transferrable ERC20 token.
///        Such tokens can be used as DAO reputation tokens and only approved DAO proposals
///        are authorized to mint tokens, destroy tokens, and update the max supply.
/// @author Daniel Wang - <daniel@loopring.org>
contract MintableNonTransferableERC20Token is MintableERC20, Ownable
{
    using MathUint for uint;

    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public maxSupply_;
    uint256 public totalSupply_;

    mapping (address => uint256) balances;

    event Minted(uint256 amount);
    event Destroyed(uint256 amount);
    event MaxSupplyChanged(uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint8         _decimals
        )
        public
    {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        maxSupply_ = 2**256 - 1;
        owner = msg.sender;
    }

    function ()
        external
        payable
    {
        revert("UNSUPPORTED");
    }

    function setMaxSupply(
        uint256 _maxSupply
        )
        public
        onlyOwner
    {
        require(_maxSupply >= totalSupply_, "INVALID_AMOUNT");
        maxSupply_ = _maxSupply;
        emit MaxSupplyChanged(maxSupply_);
    }

    function mint(
        address recipient,
        uint256 amount
        )
        public
        onlyOwner
    {
        require(amount > 0, "ZERO_VALUE");
        require(totalSupply_.add(amount) <= maxSupply_, "EXCEED_MAX_SUPPLY");

        totalSupply_ = totalSupply_.add(amount);
        balances[recipient] = balances[recipient].add(amount);
        emit Minted(amount);
    }

    function destroy(
        address recipient,
        uint256 amount
        )
        public
        onlyOwner
        returns (uint256 destroyed)
    {
        require(amount > 0, "ZERO_VALUE");

        uint256 balance = balances[recipient];
        destroyed = amount > balance ? balance : amount;
        balances[recipient] = balance.sub(amount);
        totalSupply_ = totalSupply_.sub(amount);
        emit Destroyed(destroyed);
    }

    function totalSupply()
        public
        view
        returns (uint256)
    {
        return totalSupply_;
    }

    function maxSupply()
        public
        view
        returns (uint256)
    {
        return maxSupply_;
    }

    function balanceOf(
        address _owner
        )
        public
        view
        returns (uint256 balance)
    {
        return balances[_owner];
    }

    // The following functions are disabled.

    function transfer(address, uint256) public returns (bool) { revert("UNSUPPORTED"); }

    function transferFrom(address, address, uint256) public returns (bool) { revert("UNSUPPORTED"); }

    function approve(address, uint256) public returns (bool) { revert("UNSUPPORTED"); }

    function allowance(address, address) public view returns (uint256) { return 0; }
}
