# Gas Usage at Oct-25-2017

The following measurements usge 21Gwei as gas price.

## A Ring of 3 Orders:  
    
| Function                                       |        ETH           |
| ------                                         | ------               |
| code before verifyInputDataIntegrity           | 0.001742391000006656 |
| Verifyinputdataintegrity                       | 0.002311238999998464 |
| verifyTokensRegistered                         | 0.00281586900000768  |
| calculateRinghash                              | 0.003747051000004608 |
| check ringhashRegistry.canSubmit               | 0.003839093999992832 |
| verifySignature for ring                       | 0.003971372999999488 |
| assembleOrders                                 | 0.006713952          |
| handleRing-verifyRingHasNoSubRing              | 0.006886088999993344 |
| handleRing-verifyMinerSuppliedFillRates        | 0.007175867999993856 |
| handleRing-scaleRingBasedOnHistoricalRecords   | 0.007673106000003072 |
| handleRing-calculateRingFillAmount             | 0.00777247800000512  |
| handleRing-calculateRingFees                   | 0.008277926999998464 |
| handleRing-settleRing                          | 0.013680218999996416 |
| RingMined event                                | 0.013910337000013824 |
| total                                          | 0.013910337000013824 |
    
