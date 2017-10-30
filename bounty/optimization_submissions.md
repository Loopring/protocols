# Optimization Bounty Submissions

We'll be collecting optimization bounty submissions and their responses here. Please be sure to take a look before making a submission. Thank you!

## #01 [merged]

- From: Brecht Devos <brechtp.devos@gmail.com>
- Time: 11:22 29/10/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/35
- Result: This PR simplies the code but doesn't reduce gas usage. We encourage Brecht to confirm our findings.

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
