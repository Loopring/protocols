pragma solidity 0.5.7;
pragma experimental ABIEncoderV2;

// import "../../lib/BurnableERC20.sol";
// import "../../lib/ERC20SafeTransfer.sol";
import "../../lib/MathUint.sol";
import "../../lib/ERC20.sol";

import "../../iface/IAuctionData.sol";

/// @title AuctionBids.
/// @author Daniel Wang  - <daniel@loopring.org>
library AuctionBalance
{
    using MathUint for uint;
    using MathUint for uint32;

    function getBalance(
        IAuctionData.State storage s,
        address user
        )
        internal
        view
        returns (
            IAuctionData.Balance memory bidBalance,
            IAuctionData.Balance memory askBalance
        )
    {
        bidBalance = s.balanceMap[user][s.bidToken];
        askBalance = s.balanceMap[user][s.askToken];
    }

   function depositToken(
        IAuctionData.State storage s,
        address token,
        uint    amount
        )
        internal
        returns (uint _amount)
    {
        assert(token != address(0x0));

        ERC20 erc20 = ERC20(token);
        _amount = amount
            .min(erc20.balanceOf(msg.sender))
            .min(erc20.allowance(msg.sender, address(s.oedax)));

        require(_amount > 0, "zero amount");

        require(
            s.oedax.transferToken(token, msg.sender, _amount),
            "token transfer failed"
        );
    }
}