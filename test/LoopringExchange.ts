import { Artifacts } from '../util/artifacts';

const {
    LoopringExchange,
    TokenRegistry,
    DummyToken,
} = new Artifacts(artifacts);

contract('LoopringExchange', (accounts: string[])=>{

    let loopringExchange: LoopringExchange;

    before(async () => {
        console.log("init in before.");
        loopringExchange = new LoopringExchange("0x1234567");
        //console.log(loopringExchange);
    });

    describe('test1', () => {
        it('true should equal to true', async () => {
            assert.equal(true, true);
        });
    });

})
