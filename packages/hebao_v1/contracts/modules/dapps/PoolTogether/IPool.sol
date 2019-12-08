// Created from the pooltogether codebase: https://github.com/pooltogether/pooltogether-contracts/blob/v2.x/contracts/BasePool.sol
pragma solidity ^0.5.13;


contract ICErc20 {
    address public underlying;
    function mint(uint mintAmount) external returns (uint);
    function redeemUnderlying(uint redeemAmount) external returns (uint);
    function balanceOfUnderlying(address owner) external returns (uint);
    function getCash() external view returns (uint);
    function supplyRatePerBlock() external view returns (uint);
}

contract IPool {
    /**
    * The Compound cToken that this Pool is bound to.
    */
    ICErc20 public cToken;

    /**
    * @notice Deposits into the pool under the current open Draw.  The deposit is transferred into the cToken.
    * Once the open draw is committed, the deposit will be added to the user's total committed balance and increase their chances of winning
    * proportional to the total committed balance of all users.
    * @param _amount The amount of the token underlying the cToken to deposit.
    */
    function depositPool(uint256 _amount) public;

    /**
    * @notice Withdraw the sender's entire balance back to them.
    */
    function withdraw() public;

    /**
    * @notice Returns a user's total balance, including both committed Draw balance and open Draw balance.
    * @param _addr The address of the user to check.
    * @return The users's current balance.
    */
    function balanceOf(address _addr) external view returns (uint256);
}
