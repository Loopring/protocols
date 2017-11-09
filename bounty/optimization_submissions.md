# Optimization Bounty Submissions

We'll be collecting optimization bounty submissions and their responses here. Please be sure to take a look before making a submission. Thank you!

**If you think our gas calculation is incorrect, please note that each PC may have a different development environment (solc version, truffle version, typescript version), so please prepare a script for us to re-run the gas calculation test before and after PL in question, we will review your script and verify the result. We simply don't have time to do it.**

## #01 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 11:22 29/10/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/35
- Result: reduced gas usage from 508406 to 462621 (=45785), a 8.95% reduction of 511465.


Hey,
 
I think I significantly reduced gas usage by optimizing the xorOp function in Bytes32Lib. This function is used in calculateRinghash. This is how I updated the function:
 
```
function xorOp(
        bytes32 bs1,
        bytes32 bs2
        )
        internal
        constant
        returns (bytes32 res)
    {
        uint temp = uint(bs1) ^ uint(bs2);
        res = bytes32(temp);
    }
 ```
 
The original code seems to make things more difficult than needed though there could be reasons for that that I don’t know.
This change reduces the gas usage a nice ~10% in the 3 order ring test in my quick measurements I did. I will do more exhaustive testing of this change when I have a bit more time, but I didn’t want to wait too long before submitting this for a possible bounty. 😊 All tests do seem to run just fine with this change.
 
If there any issues or additional questions please let me know.
 
Brecht Devos


## #02 [Merged]

- From: Kecheng Yue <yuekec@gmail.com>
- Time: 00:46 01/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/37
- Result: reduced gas usage from 462621 to 447740 (=14881), a 2.91% reduction of 511465.

Hi,  

I made two optimizations for loopring protocol which reducing about 3.7% of the gas usage in the 3 orders ring test. All tests are passed for the changes.

1. Reduce the time complexity of `TokenRegistry.isTokenRegistered` from O(n) to O(1). `n` is the length of registered token list. This optimization is made for the reason that when `verifyTokensRegistered ` loops for each address in addressList, it calls `TokenRegistry.isTokenRegistered`, causing the time complexity is O(mn). It will be reduced to O(m) by this optimization. This change reduces the gas usage a ~2.2%.

```

contract TokenRegistry is Ownable {

    address[] public tokens;

    mapping (address => bool) tokenMap; // Add this.

    mapping (string => address) tokenSymbolMap;

    function registerToken(address _token, string _symbol)

        public

        onlyOwner

    {

        // ...

        tokens.push(_token);

        tokenMap[_token] = true; // Add this.

        tokenSymbolMap[_symbol] = _token;

    }

    // ... see details in TokenRegistry.sol

    function isTokenRegistered(address _token)

        public

        constant

        returns (bool)

    {

        return tokenMap[_token]; // Add this.


    }

```

2. Optimize `ErrorLib.check` usage in many places in the codes. In fact, I just inline the function in some elementary operations. That is `ErrorLib.check(condition, message) => If (!condition) {ErrorLib.error(message)}`. Given that, ErrorLib.check is called in some elementary operations, whatever the value of `condition` is, making the function inline will avoid the additional cost for calling function. Certainly, `real` inline funcations are commonly supported by compiler. But as I know, inline functions are planned but not yet supported by official for now (http://solidity.readthedocs.io/en/v0.4.15/types.html). This change reduces the gas usage a ~2.2%.

See details in LoopringProtocolImpl.sol





因为不擅长用英语写文章，所以以下用中文描述了一遍。

Hi,

我对loopring protocal做了2点优化，使得`3 order ring test` 减少了大约3.7%gas使用量。测试用例已通过。

1 将TokenRegistry.isTokenRegistered的时间复杂度从O(n)改到O(1)(n为RegisteredToken.length)。之所以做这样的优化，是因为verifyTokensRegistered方法在遍历addressList时，调用了TokenRegistry.isTokenRegistered。优化后可以将复杂度从O(mn)降为O(m)。此项优化大约减少了2.2%左右的gas消耗。

代码见英文处

2 对多处使用到ErrorLib.check的地方做了优化。其实就是将其inline化。即：ErrorLib.check(condition, message) => If (!condition) {ErrorLib.error(message)}。之所以这么做是因为考虑到ErrorLib.check出现在了很多关键操作中，并且无论condition为何值，都会引起一个函数调用，将其inline化可以避免函数调用所引起的额外消耗。当然，这样的inline化通常是交给编译器来进行的，不过就目前为止，inline function 并未被支持（但已在计划中）。此项优化大约减少了1.5%左右的gas消耗。考虑到以后inline function可能会被官方支持，并且此优化所带来的改进较小，是否需要如此优化值得商榷。


## #03 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 00:55 01/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/44
- Result: reduced gas usage from 446542 to 426942 (=14881), a 3.83% reduction of 511465.

Hi,
 
I reduced the number of necessary SSTORE (and SLOAD) instructions in submitRing. The idea is pretty simple: 2 storage variables are always updated in the function: ‘entered’ and ‘ringIndex’.
'entered’ is used to check for reentrancy of the function, so it’s updated once at the very beginning and once at the very end (2 SSTORES). ‘ringIndex’ is also read in the function and updated at the end (1 SSTORE).
You can reduce the number of SSTORES by combining these 2 storage variables in 1. Instead of setting ‘entered’ to true at the beginning, you can set ‘ringIndex’ to an invalid value (uint(-1)). So the reentrance check becomes ‘ringIndex != uint(-1)’.
At the end of the function ‘ringIndex’ is updated again with it’s original value incremented by 1. This also signals that the function has reached its end (‘ringIndex’ != uint(-1)). This is where the SSTORE instruction is saved, before the change 2 SSTORE instructions were needed to update ‘entered’ and ‘ringIndex’.
 
Some thoughts about the change:
Reading the storage variable ‘ringIndex’ while submitRing is running will not return the correct value (as it is set to uint(-1)). This shouldn’t be a problem because (as far as I know) this can only be done in a reentrance scenario.
But this still could be fixed by reserving a single bit of ‘ringIndex’ as a sort of ‘busy bit’. This bit could be set at the start of the function (‘ringIndex |= (1 << 255)’) without destroying the actual index bits. The actual ‘ringIndex’ could then be read by ignoring the busy bit.
Extra care needs to be given to not accedentially read from the ‘ringIndex’ storage variable in the submitRing function. This isn’t that big of a problem because it’s used only twice.
 
This change saves a bit more than 1% in gas (which is what I expected calculating the theoretical gas costs).
 
Let me know what you think of this optimization. For completeness’ sake I pasted the git diff below with all necessary changes. If you’re alright with the change I could make a pull request if you want.
I had to put the calculateRinghash inside its own function to save on local variables inside submitRing(). Otherwise it’s some very small changes in a couple of places.
 
Brecht Devos

## #04 [Rejected]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 04:35 01/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/45
- Result: We need to keep an list of tokens so they can be browsered by normal user using Geth. Maps are not enumeratable.

Hi,
 
I’ve done a pretty straight forward optimization (and code simplification) in TokenRegistry. I’ve changed the tokens array to a mapping like this: mapping (address => bool) tokenAddressMap.
This makes isTokenRegistered() faster because the tokens array doesn’t need to be searched for the matching address
This simplifies the code in unregisterToken() and  isTokenRegistered()
 
This makes the verifyTokensRegistered() function that calls isTokenRegistered() a couple of times quite a bit faster. In total this change reduces the gas usage about 2%.
 
I’ve pasted the complete updated code for the TokenRegistry contract below.
 
Let me know if you’ve got any questions/thoughts about this.
 
Brecht Devos
 
 
TokenRegistry.sol:
 
/// @title Token Register Contract
/// @author Kongliang Zhong - <kongliang@loopring.org>,
/// @author Daniel Wang - <daniel@loopring.org>.
contract TokenRegistry is Ownable {
 
    mapping (string => address) tokenSymbolMap;
    mapping (address => bool) tokenAddressMap;
 
    function registerToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(_token != address(0));
        require(!isTokenRegisteredBySymbol(_symbol));
        require(!isTokenRegistered(_token));
        tokenSymbolMap[_symbol] = _token;
        tokenAddressMap[_token] = true;
    }
 
    function unregisterToken(address _token, string _symbol)
        public
        onlyOwner
    {
        require(tokenSymbolMap[_symbol] == _token);
        require(tokenAddressMap[_token] == true);
        delete tokenSymbolMap[_symbol];
        delete tokenAddressMap[_token];
    }
 
    function isTokenRegisteredBySymbol(string symbol)
        public
        constant
        returns (bool)
    {
        return tokenSymbolMap[symbol] != address(0);
    }
 
    function isTokenRegistered(address _token)
        public
        constant
        returns (bool)
    {
       return tokenAddressMap[_token];
    }
 
    function getAddressBySymbol(string symbol)
        public
        constant
        returns (address)
    {
        return tokenSymbolMap[symbol];
    }
 }

## #05 [Rejected]

- From: Akash Bansal <akash.bansal2504@gmail.com>
- Time: 21:58 01/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/38
- Our test shows that this change actually increased gas usage. This is probably because 1) our test is not written to test TokenTransferDelegate and 2) we prefer less storage on-chain over less computation.

Description : Adding and removing loopring protocol Address in TokenTransferDelegate.sol in O(1)
I think this will reduce gas significantly.

Thanks.

## #06 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 23:00 01/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/39
- Result: reduced gas usage from 426942 to 426590 (=14881), a 0.07% reduction of 511465.

Hi,
 
Shouldn’t the return value of delegate.transferToken() be checked in settleRing()? Even if you’ve done some checks before, it still seems like a good idea to check the return value of the function because it seems like it could fail for multiple reasons. It’s also a very critical part of the codebase.
I haven’t thought that much yet if or how it could be abused, though I don’t see any reason not to check the return value.
 
Brecht Devos


## #07 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 10:01 03/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/43
- Result: reduced gas usage from 447740 to 446542 (=14881), a 0.23% reduction of 511465.

Hi,
 
Currently there are 2 storage fields for filled and cancelled separately. The code as is it works now does not need to have separate lists for both because they are only used added together like this:
uint amountB = order.amountB.sub(filled[state.orderHash]).tolerantSub(cancelled[state.orderHash]);
 
If the amount cancelled is simply added to filled the code would simply become:
uint amountB = order.amountB. tolerantSub (filled[state.orderHash]);
 
Of course this is only possible when future features don’t depend on having these separate.
 
In the 3 order test case this saves 3 SLOADs, which is currently about 0.25% in gas, which is pretty minor. Though it can also reduce future expensive SSTOREs (zero to non-zero) when either the filled or cancelled amount is already non-zero
(e.g. when the filled amount is already non-zero but the cancelled amount is still zero, cancelling an order would not bring about an expensive SSTORE to bring the cancelled amount to non-zero -> this would save 15000 gas).
 
Brecht Devos

## #08 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 02:38 04/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/48
- Result: reduced gas usage from 426718 to 423909 (=2809), a 0.55% reduction of 511465.

Hi,
 
Small but straightforward optimization in the verifyTokensRegistered function: All token addresses can be checked in a single function call in the TokenRegistry contact like this:
 
    function verifyTokensRegistered(address[2][] addressList)
        internal
        constant
    {
        // Extract the token addresses
        address[] memory tokens = new address[](addressList.length);
        for (uint i = 0; i < addressList.length; i++) {
            tokens[i] = addressList[i][1];
        }
 
        // Test all token addresses at once
        if (!TokenRegistry(tokenRegistryAddress).areAllTokensRegistered(tokens)) {
            ErrorLib.error("token not registered");
        }
    }
 
The new function in the TokenRegistry contract looks like this:
 
    function areAllTokensRegistered(address[] tokenList)
        public
        constant
        returns (bool)
    {
        bool allFound = true;
        for (uint i = 0; i < tokenList.length; i++) {
            allFound = allFound && tokenMap[tokenList[i]];
        }
        return allFound;
    }
 
This reduces gas usage by about 0.5%.
 
Brecht Devos.

## #09 [Merged]
Name : Akash Bansal
email : akash.bansal2504@gmail.com
PR : https://github.com/Loopring/protocol/pull/47 and https://github.com/Loopring/protocol/pull/49
Result: reduced gas usage from 423909 to 422633 (=1276), a 0.25% reduction of 511465.

Description : In the function calculateRingFees, call to getSpendable is made which is everytime creating new object of TokenTransferDelegate. It can be avoided.
Gas reduced from 427548 to 426923 which is more than 1%

Ethereum Address : 0x8130cdea28278a14b42aaa49abf0415607cdbfee

Let me know in case of issues.


## #10 [Merged]
Name : Akash Bansal
email : akash.bansal2504@gmail.com
PR : https://github.com/Loopring/protocol/pull/53
Result: reduced gas usage from 421991 to 420823 (=1168), a 0.22% reduction of 511465.


In addition to the above :
https://github.com/Loopring/protocol/pull/52

This further reduces some gas.


## #11 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 02:52 06/11/2017 Beijing Time
- PR:  https://github.com/Loopring/protocol/pull/55 and https://github.com/Loopring/protocol/pull/77
- Result: reduced gas usage from 405588 to 400286 405588 (=5302), a 1.04% reduction of 511465.

I also made a pull request for this one: https://github.com/Loopring/protocol/pull/55


## #12 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 02:52 06/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/56 and https://github.com/Loopring/protocol/pull/75
- Result: reduced gas usage from 416380 to 405588 (=10792), a 2.11% reduction of 511465.



## #13 [TBD]

- From: 裴林波 <398202646@qq.com>
- Time: 00:00 07/11/2017 Beijing Time
- PR: 

Hi Team

I have noticed that, in below code there is one nested loop, which should be avoided always.
The cost for nested loop will be O(n*n).
The performance will be bad, along with the growing up of ringSize.

    function verifyRingHasNoSubRing(Ring ring)
        internal
        constant
    {
        uint ringSize = ring.orders.length;
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ringSize - 1; i++) {
            address tokenS = ring.orders[i].order.tokenS;
            for (uint j = i + 1; j < ringSize; j++) {
                ErrorLib.check(
                    tokenS != ring.orders[j].order.tokenS,
                    "found sub-ring"
                );
            }
        }
    }


By below idea, we can reduce the cost to O(n).
1. Add one mapping member to Ring stuct.
    struct Ring {
        bytes32      ringhash;
        OrderState[] orders;
        address      miner;
        address      feeRecepient;
        bool         throwIfLRCIsInsuffcient;
	mapping 	(address => bool) tokenSExist;
    }
2. Change the verifyRingHasNoSubRing as below.
    function verifyRingHasNoSubRing(Ring ring)
        internal
        constant
    {
        uint ringSize = ring.orders.length;
        // Check the ring has no sub-ring.
        for (uint i = 0; i < ringSize; i++) {
			address tokenS = ring.orders[i].order.tokenS;
			ErrorLib.check(ring.tokenSExist[tokenS], "found sub-ring");			
			ring.tokenSExist[tokenS] = true;
        }
    }

Hope this can help. Thanks.

My Ether Wallet address:
0x4CEB79e11BdFBBFFB5ac902d7b50D00B3339875B

ShangHai China
5 November 2017


## #14 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: 00:00 07/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/57 and https://github.com/Loopring/protocol/pull/78
- Result: reduced gas usage from 400512 to 400278 (=234), a 0.04% reduction of 511465.


## #15 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 59
- PR: https://github.com/Loopring/protocol/pull/59 and  https://github.com/Loopring/protocol/pull/79
- Result: reduced gas usage from 400411 to 400376 (=35), a 0.00% reduction of 511465.

## #16 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 65
- PR: https://github.com/Loopring/protocol/pull/65
- Result: reduced gas usage from 400427 to 400084 (=343), a 0.07% reduction of 511465.

## #17 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: as of PR 84
- PR:  https://github.com/Loopring/protocol/pull/87 and https://github.com/Loopring/protocol/pull/84
- Result: reduced gas usage from 400427 to 400084 (=343), a 0.07% reduction of 511465.

## #18 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: as of PR 85
- PR: https://github.com/Loopring/protocol/pull/85
- Result: reduced gas usage from 414469 to 413379 (=1090), a 0.21% reduction of 511465.


## #19 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 91
- PR: https://github.com/Loopring/protocol/pull/65
- Result: reduced gas usage from 412961 to 412188 (=773), a 0.15% reduction of 511465.


## #20 [Merged]

- From: https://github.com/rainydio
- Time: as of PR 91
- PR: https://github.com/Loopring/protocol/pull/66 and https://github.com/Loopring/protocol/pull/93
- Result: reduced gas usage from 412350 to 399328 (=13022), a 2.55% reduction of 511465.


## #21 [Merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: as of PR 103
- PR: https://github.com/Loopring/protocol/pull/103
- Result: reduced gas usage from 398189 to 397173 (=1016), a 0.20% reduction of 511465.

## #21 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 105
- PR: https://github.com/Loopring/protocol/pull/105
- Result: reduced gas usage from 397173 to 397050 (=123), a 0.02% reduction of 511465.

## #22 [Merged]

- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 106
- PR: https://github.com/Loopring/protocol/pull/106
- Result: reduced gas usage from 397050 to 396951 (=99), a 0.02% reduction of 511465.

## #23 [Merged]

- From: https://github.com/rainydio
- Time: as of PR 102
- PR: https://github.com/Loopring/protocol/pull/102
- Result: reduced gas usage from 396951 to 396125 (=826), a 0.17% reduction of 511465.

## #24 [Merged]
395572/395572
- From: Benjamin John Price <ben@benprice.ca>
- Time: as of PR 104 and 99
- PR: https://github.com/Loopring/protocol/pull/104 and https://github.com/Loopring/protocol/pull/99
- Result: reduced gas usage from 396125 to 395537 (=588), a 0.11% reduction of 511465.
