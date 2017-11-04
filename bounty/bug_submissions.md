# Bug Bounty Submissions

We'll be collecting bug bounty submissions and their responses here. Please be sure to take a look before making a submission. Thank you!

## #01 [Rejected]

- From: Akash Bansal <akash.bansal2504@gmail.com>
- Time: 01:57 03/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/41
- Resoluton: Will not implemented. See https://blog.coinfabrik.com/smart-contract-short-address-attack-mitigation-failure/

## #02 [Merged]

- From: Akash Bansal<akash.bansal2504@gmail.com>
- Time: 22:30 04/11/2017 Beijing Time
- PR: https://github.com/Loopring/protocol/pull/50

Description : According to ERC-20 token standards, 
Transfers of 0 values MUST be treated as normal transfers and fire the Transfer event.
(https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20-token-standard.md)
But in your method "transferToken" TokenTransferDelegate you have put a check against it. Either it should be allowed or a note should be added.

## #03 [TBD]

- From: Paul <pauliax6@gmail.com>
- Time: 23:41 04/11/2017 Beijing Time
- PR: 

Hello,

Here are my initial suggestions from a static analysis of your smart contracts code. Please note that I am just an enthusiast of Solidity and Bug Bounty campaigns, so you shouldn't take my suggestions for granted. Please review it carefully and only if you agree with it, implement the necessary changes. If you are satisfied with it, I can continue the testing to provide you more feedback.

There are some usages of "var" which infers the variable type from the right hand of the assignment. I recommend avoiding this feature because in some cases it might infer a smaller integer type than the developer might think. It is best to be explicit regarding types;
Consider avoiding the usage of "for" loop as iterating through the array of unknown size might consume all the gas provided (run out of gas). Especially, try to avoid loops in your functions or actions that modify large areas of storage (this includes clearing or copying arrays in storage). For example, here:
for (uint i = 0; i < tokens.length; i++) {
if (tokens[i] == _token) {
tokens[i] == tokens[tokens.length - 1];
tokens.length --;
break;
}
} if the tokens array becomes very large, the transaction to unregisterTokenwill never succeed.
assert(ERC20(token).transferFrom(from, to, value));
Please make sure that "assert" is used intentionally, as if it fails, all the gas is consumed. Consider replacing "assert" with "require". Require() is used for checking that the input of the function is well formatted, while assert() function is used to validate contract state after making changes . Read more: https://media.consensys.net/when-to-use-revert-assert-and-require-in-solidity-61fb2c0e5a
That’s all for now. Please, let me know if you find any of these relevant. Good luck with your project!
Regards,