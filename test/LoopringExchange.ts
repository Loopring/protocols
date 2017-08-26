import { Artifacts } from '../util/artifacts';

const {
    LoopringExchange,
    TokenRegistry,
    DummyToken,
} = new Artifacts(artifacts);

contract('LoopringExchange', (accounts: string[])=>{

    before(async () => {
        console.log("init in before.");

        //console.log(oopringExchange);
    });

    describe('test1', () => {
        it('true should equal to true', async () => {
            assert.equal(true, true);
        });
    });

})
