/*
  https://github.com/christianlundkvist/simple-multisig/blob/master/contracts/SimpleMultiSig.sol
*/
pragma solidity 0.4.18;

contract SimpleMultsig {

    ////////////////////////////////////////////////////////////////////////////
    /// Variables                                                            ///
    ////////////////////////////////////////////////////////////////////////////

    uint public nonce;                  // (only) mutable state
    uint public threshold;              // immutable state
    mapping (address => bool) ownerMap; // immutable state
    address[] public owners;            // immutable state


    ////////////////////////////////////////////////////////////////////////////
    /// Constructor                                                          ///
    ////////////////////////////////////////////////////////////////////////////

    function SimpleMultsig(
        uint      _threshold,
        address[] _owners
        )
        public
    {
        require(_owners.length <= 10);
        require(_threshold <= _owners.length);
        require(_threshold != 0);

        address lastAddr = address(0); 
        for (uint i=0; i<_owners.length; i++) {
            address owner = _owners[i];
            require(owner > lastAddr);
            ownerMap[owner] = true;
            lastAddr = owner;
        }
        owners = _owners;
        threshold = _threshold;
    }


    ////////////////////////////////////////////////////////////////////////////
    /// Public Functions                                                     ///
    ////////////////////////////////////////////////////////////////////////////

    // default function does nothing.
    function () payable public {}

    // Note that address recovered from signatures must be strictly increasing.
    function execute(
        uint8[]   sigV,
        bytes32[] sigR,
        bytes32[] sigS,
        address   destination,
        uint      value,
        bytes     data
        )
        public
    {
        uint len = sigR.length;
        require(len == threshold);
        require(len == sigS.length);
        require(len == sigV.length);

        // Follows ERC191 signature scheme:
        //    https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(
            byte(0x19),
            byte(0),
            this,
            destination,
            value,
            data,
            nonce
        );

        address lastAddr = address(0); // cannot have address(0) as an owner

        for (uint i = 0; i < threshold; i++) {
            address recovered = ecrecover(txHash, sigV[i], sigR[i], sigS[i]);
            require(recovered > lastAddr && ownerMap[recovered]);
            lastAddr = recovered;
        }

        // If we make it here all signatures are accounted for
        nonce++;

        require(destination.call.value(value)(data));
    }
}