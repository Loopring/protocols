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
