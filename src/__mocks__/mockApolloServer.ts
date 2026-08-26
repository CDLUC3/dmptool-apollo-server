import { ApolloServer } from '@apollo/server';
import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { MyContext } from '../context.js';
import { typeDefs } from '../schema';
import { resolvers } from '../resolver';
import { mocks } from '../mocks';

// Test server using mocks
const server = new ApolloServer<MyContext>({
  schema: addMocksToSchema({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
    mocks,
  }),
});

export default server;
