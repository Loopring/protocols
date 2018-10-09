pragma solidity 0.4.24;

import { ERC20Token } from "./ERC20Token.sol";
import { ERC777BaseToken } from "./ERC777BaseToken.sol";

contract ERC777ERC20BaseToken is ERC20Token, ERC777BaseToken {
    uint public constant MAX_UINT = 2**256 - 1;

    bool internal mErc20compatible;

    mapping(address => mapping(address => bool)) internal mAuthorized;
    mapping(address => mapping(address => uint256)) internal mAllowed;

    constructor(
        string _name,
        string _symbol,
        uint256 _granularity,
        address[] _defaultOperators
    )
        internal ERC777BaseToken(_name, _symbol, _granularity, _defaultOperators)
    {
        mErc20compatible = true;
        setInterfaceImplementation("ERC20Token", this);
    }

    /// @notice This modifier is applied to erc20 obsolete methods that are
    ///  implemented only to maintain backwards compatibility. When the erc20
    ///  compatibility is disabled, this methods will fail.
    modifier erc20 () {
        require(mErc20compatible);
        _;
    }

    /// @notice For Backwards compatibility
    /// @return The decimls of the token. Forced to 18 in ERC777.
    function decimals() public erc20 constant returns (uint8) { return uint8(18); }

    /// @notice ERC20 backwards compatible transfer.
    /// @param _to The address of the recipient
    /// @param _amount The number of tokens to be transferred
    /// @return `true`, if the transfer can't be done, it should fail.
    function transfer(address _to, uint256 _amount) public erc20 returns (bool success) {
        doSend(msg.sender, msg.sender, _to, _amount, "", "", false);
        return true;
    }

    /// @notice ERC20 backwards compatible transferFrom.
    /// @param _from The address holding the tokens being transferred
    /// @param _to The address of the recipient
    /// @param _amount The number of tokens to be transferred
    /// @return `true`, if the transfer can't be done, it should fail.
    function transferFrom(address _from, address _to, uint256 _amount) public erc20 returns (bool success) {
        require(_amount <= mAllowed[_from][msg.sender]);

        /// an allowance of MAX_UINT represents an unlimited allowance.
        /// @dev see https://github.com/ethereum/EIPs/issues/717
        if (mAllowed[_from][msg.sender] < MAX_UINT) {
            mAllowed[_from][msg.sender] = mAllowed[_from][msg.sender].sub(_amount);
        }

        doSend(msg.sender, _from, _to, _amount, "", "", false);
        return true;
    }

    /// @notice ERC20 backwards compatible approve.
    ///  `msg.sender` approves `_spender` to spend `_amount` tokens on its behalf.
    /// @param _spender The address of the account able to transfer the tokens
    /// @param _amount The number of tokens to be approved for transfer
    /// @return `true`, if the approve can't be done, it should fail.
    function approve(address _spender, uint256 _amount) public erc20 returns (bool success) {
        mAllowed[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }

        /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _addedValue The amount of tokens to increase the allowance by.
     */
    function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
        mAllowed[msg.sender][_spender] = mAllowed[msg.sender][_spender].add(_addedValue);
        emit Approval(msg.sender, _spender, mAllowed[msg.sender][_spender]);
        return true;
    }
    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To decrement
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
        uint oldValue = mAllowed[msg.sender][_spender];
        if (_subtractedValue > oldValue) {
            mAllowed[msg.sender][_spender] = 0;
        } else {
            mAllowed[msg.sender][_spender] = oldValue.sub(_subtractedValue);
        }
        emit Approval(msg.sender, _spender, mAllowed[msg.sender][_spender]);
        return true;
    }

    /// @notice ERC20 backwards compatible allowance.
    ///  This function makes it easy to read the `allowed[]` map
    /// @param _owner The address of the account that owns the token
    /// @param _spender The address of the account able to transfer the tokens
    /// @return Amount of remaining tokens of _owner that _spender is allowed
    ///  to spend
    function allowance(address _owner, address _spender) public erc20 constant returns (uint256 remaining) {
        return mAllowed[_owner][_spender];
    }

    function doSend(
        address _operator,
        address _from,
        address _to,
        uint256 _amount,
        bytes _userData,
        bytes _operatorData,
        bool _preventLocking
    )
        internal
    {
        super.doSend(_operator, _from, _to, _amount, _userData, _operatorData, _preventLocking);
        if (mErc20compatible) { emit Transfer(_from, _to, _amount); }
    }

    function doBurn(address _operator, address _tokenHolder, uint256 _amount, bytes _holderData, bytes _operatorData)
        internal
    {
        super.doBurn(_operator, _tokenHolder, _amount, _holderData, _operatorData);
        if (mErc20compatible) { emit Transfer(_tokenHolder, 0x0, _amount); }
    }
}
