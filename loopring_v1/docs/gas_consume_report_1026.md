# Gas Usage at Oct-26-2017

The following measurements usge 21Gwei as gas price.

## A Ring of 2 Orders:  
    
| Function                                       |        ETH           |
| ------                                         | ------               |
| code before verifyInputDataIntegrity           | 0.001422435000008704 |
| Verifyinputdataintegrity                       | 0.001468109999996928 |
| verifyTokensRegistered                         | 0.001697177999998976 |
| calculateRinghash                              | 0.002285702999998464 |
| check ringhashRegistry.canSubmit               | 0.002342087999995904 |
| verifySignature for ring                       | 0.002436             |
| assembleOrders                                 | 0.003235365000003584 |
| handleRing-verifyRingHasNoSubRing              | 0.003260627999997952 |
| handleRing-verifyMinerSuppliedFillRates        | 0.003361364999995392 |
| handleRing-scaleRingBasedOnHistoricalRecords   | 0.003469178999996416 |
| handleRing-calculateRingFillAmount             | 0.003518256000008192 |
| handleRing-calculateRingFees                   | 0.004114298999996416 |
| handleRing-settleRing                          | 0.008177547000004608 |
| RingMined event                                | 0.008721321000009727 |
| total                                          | 0.008721321000009727 |


## A Ring of 3 Orders:  
    
| Function                                       |        ETH           |
| ------                                         | ------               |
| code before verifyInputDataIntegrity           | 0.00166460700000256  |
| Verifyinputdataintegrity                       | 0.001716623999991808 |
| verifyTokensRegistered                         | 0.00209993699999744  |
| calculateRinghash                              | 0.00318345300000768  |
| check ringhashRegistry.canSubmit               | 0.003237149999988736 |
| verifySignature for ring                       | 0.003335094000009216 |
| assembleOrders                                 | 0.004525751999987712 |
| handleRing-verifyRingHasNoSubRing              | 0.00457401000001536  |
| handleRing-verifyMinerSuppliedFillRates        | 0.004705386000007168 |
| handleRing-scaleRingBasedOnHistoricalRecords   | 0.004853897999990784 |
| handleRing-calculateRingFillAmount             | 0.00495423600001024  |
| handleRing-calculateRingFees                   | 0.005421338999996416 |
| handleRing-settleRing                          | 0.010511991000006656 |
| RingMined event                                | 0.01074076500000768  |
| total                                          | 0.01074076500000768  |
    
