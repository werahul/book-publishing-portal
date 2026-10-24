import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env';

export async function connectDb(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  // Some local setups hand Node a resolver (e.g. 127.0.0.1) that refuses SRV queries,
  // which breaks mongodb+srv:// URIs. DNS_SERVERS overrides it; unset in production.
  if (env.DNS_SERVERS.length > 0) dns.setServers(env.DNS_SERVERS);

  mongoose.set('strictQuery', true);
  return mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
