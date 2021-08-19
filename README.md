# README

This repository contains Loopring's opensource smart contracts and circuit code for the Loopring protocol, the smart contracts for Loopring's smart-wallet implementation (hebao), and an Open-Ended Dutch Auction Exchange (Oedax) protocol (discontinued).

You will find some sub-packages are out of date, no worries. The following ones are actively developed & maintained:

- loopring_v3: Loopring Protocol
- hebao_v1: Loopring's smart-wallet implementation.

## How to release

- Create a branch called `release_loopring_x.x.x` or `release_hebao_x.x.x` (all lower cases). These branches are protected and cannot be deleted.

- Create a release named `loopring_x.x.x` or `hebao_x.x.x` (all lower cases）， the tag name shall be the same as the release name. Do NOT check the 'This is a pre-release' option, and add as many notes as possible to describe what's new in the release.
