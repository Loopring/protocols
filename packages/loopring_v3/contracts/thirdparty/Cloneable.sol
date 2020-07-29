
// SPDX-License-Identifier: UNLICENSED
// This code is taken from https://gist.github.com/holiman/069de8d056a531575d2b786df3345665
pragma solidity ^0.7.0;

library Cloneable {
    function clone(address a)
        external
        returns (address)
    {

    /*
    Assembly of the code that we want to use as init-code in the new contract,
    along with stack values:
                    # bottom [ STACK ] top
     PUSH1 00       # [ 0 ]
     DUP1           # [ 0, 0 ]
     PUSH20
     <address>      # [0,0, address]
     DUP1           # [0,0, address ,address]
     EXTCODESIZE    # [0,0, address, size ]
     DUP1           # [0,0, address, size, size]
     SWAP4          # [ size, 0, address, size, 0]
     DUP1           # [ size, 0, address ,size, 0,0]
     SWAP2          # [ size, 0, address, 0, 0, size]
     SWAP3          # [ size, 0, size, 0, 0, address]
     EXTCODECOPY    # [ size, 0]
     RETURN

    The code above weighs in at 33 bytes, which is _just_ above fitting into a uint.
    So a modified version is used, where the initial PUSH1 00 is replaced by `PC`.
    This is one byte smaller, and also a bit cheaper Wbase instead of Wverylow. It only costs 2 gas.

     PC             # [ 0 ]
     DUP1           # [ 0, 0 ]
     PUSH20
     <address>      # [0,0, address]
     DUP1           # [0,0, address ,address]
     EXTCODESIZE    # [0,0, address, size ]
     DUP1           # [0,0, address, size, size]
     SWAP4          # [ size, 0, address, size, 0]
     DUP1           # [ size, 0, address ,size, 0,0]
     SWAP2          # [ size, 0, address, 0, 0, size]
     SWAP3          # [ size, 0, size, 0, 0, address]
     EXTCODECOPY    # [ size, 0]
     RETURN

    The opcodes are:
    58 80 73 <address> 80 3b 80 93 80 91 92 3c F3
    We get <address> in there by OR:ing the upshifted address into the 0-filled space.
      5880730000000000000000000000000000000000000000803b80938091923cF3
     +000000xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx000000000000000000
     -----------------------------------------------------------------
      588073xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx00000803b80938091923cF3

    This is simply stored at memory position 0, and create is invoked.
    */
        address retval;
        assembly{
            mstore(0x0, or (0x5880730000000000000000000000000000000000000000803b80938091923cF3 ,mul(a,0x1000000000000000000)))
            retval := create(0,0, 32)
        }
        return retval;
    }
}