import {credentials, Metadata, ServiceError} from 'grpc';
import { DexServiceClient } from '../../proto_gen/service_dex_grpc_pb';
import { GetNextOrderIdReq } from '../../proto_gen/service_dex_pb';
import { grpcClientService } from './grpcClientService';
import { UInt32Value } from "google-protobuf/google/protobuf/wrappers_pb";

/* // https://github.com/grpc/grpc-node/issues/543#issuecomment-427487420
const baseCred: ChannelCredentials = credentials.createSsl();
const authCred: CallCredentials = credentials.createFromMetadataGenerator((params: { service_url: string }, callback: MetadataCallback) => {
  logger.info('createFromMetadataGenerator:', params);

  const metadata: Metadata = new Metadata();
  metadata.add('authorization', 'accessTokenValue');
  callback(null, metadata);
});
const client: GreeterClient = new GreeterClient('localhost:50051', credentials.combineChannelCredentials(baseCred, authCred));
*/
const client: DexServiceClient = new DexServiceClient('localhost:8980', credentials.createInsecure());

let argv: string = 'world';
if (process.argv.length >= 3) {
    argv = process.argv[2];
}

const param: GetNextOrderIdReq = new GetNextOrderIdReq();
param.setAccountId(1);
param.setTokenSellId(1);

const metadata: Metadata = new Metadata();
metadata.add('foo', 'bar1');
metadata.add('foo', 'bar2');

async function example(): Promise<void> {
    client.getNextOrderId(param, (err: ServiceError | null, res: UInt32Value) => {
        console.log('hello world')
        console.log(res.getValue())
    });
}

example().catch((err: Error) => console.log(err));
