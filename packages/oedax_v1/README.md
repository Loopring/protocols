# Oedax

## Compile

run `npm run compile` or `npm run watch`.

## Implementation

- [x] ledger book keeping
- [x] queue management
- [x] support asks
- [x] settlement and send back token/ether
- [x] curve implementation
- [x] remove curve registry
- [x] calculate closing time
- [x] check price range and overflow
- [x] api ducmentation

### Optimization
- [ ] smart curve (auto shape adjustment based on min-auction duration and max-auction duration)

## Testing
- [ ] price not bounded, no bids/asks
- [ ] price not bounded, price too big or too small
- [ ] price bounded, empty queue, ask price == actual price
- [ ] price bounded, empty queue, bid price == actual price
- [ ] price bounded, bid queue not empty, ask price == actual price
- [ ] price bounded, ask queue not empty, bid price == actual price

