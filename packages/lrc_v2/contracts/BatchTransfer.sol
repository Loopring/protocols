pragma solidity 0.5.2;

contract Transferable {
    function transfer(address to, uint256 value) public returns (bool);
}

contract BatchTransfer {
    address public owner;
    address public lrcAddress;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    constructor() public {
        owner = msg.sender;
    }

    function setLrcAddress(address _lrcAddress)
        external
        onlyOwner
    {
        require(_lrcAddress != address(0));
        lrcAddress = _lrcAddress;
    }

    function doBatchTransfer(address[] calldata users, uint256[] calldata amounts)
        external
        onlyOwner
        returns (bool)
    {
        require(users.length == amounts.length);

        Transferable token = Transferable(lrcAddress);
        for (uint i = 0; i < users.length; i ++ ) {
            require(token.transfer(users[i], amounts[i]), "transfer failed");
        }

        return true;
    }

    function withdrawToken(address tokenAddress, uint256 amount)
        external
        onlyOwner
    {
        Transferable token = Transferable(tokenAddress);
        token.transfer(owner, amount);
    }

    function withdrawETH(uint256 amount)
        external
        onlyOwner
    {
        msg.sender.transfer(amount);
    }

    // check off-chain will save some gas.
    function isContract(address addr) internal view returns (bool) {
        uint size;
        assembly { size := extcodesize(addr) }
        return size > 0;
    }

}
