This tutorial describes how peers are selected to evaluate transactions
that will not then be written to the ledger, which may also be considered
as queries.

### Query handling strategies

The SDK provides several selectable strategies for how it should evaluate
transactions on peers in the network. The available strategies are defined
in `QueryHandlerStrategies`. The desired strategy is (optionally)
specified as an argument to `connect()` on the `Gateway`, and is used for
all transaction evaluations on Contracts obtained from that Gateway
instance.

If no query handling strategy is specified, `MSPID_SCOPE_SINGLE` is used
by default. This will evaluate all transactions on the first peer from
which is can obtain a response, and only switch to another peer if this
peer fails.

```javascript
const { Gateway, QueryHandlerStrategies } = require('fabric-network');

const connectOptions = {
    query: {
        timeout: 3,
        strategy: QueryHandlerStrategies.MSPID_SCOPE_SINGLE
    }
}

const gateway = new Gateway();
await gateway.connect(connectionProfile, connectOptions);
```

### Plug-in query handlers

If behavior is required that is not provided by the default query handling
strategies, it is possible to implement your own query handling. This is
achieved by specifying your own factory function as the query handling
strategy. The factory function should return a *query handler*
object and take one parameter:
1. Blockchain network: `Network`

The Network provides access to peers on which transactions should be
evaluated.

```javascript
function createQueryHandler(network) {
    /* Your implementation here */
    return new MyQueryHandler(peers);
}

const connectOptions = {
    query: {
        timeout: 3,
        strategy: createQueryHandler
    }
 }

const gateway = new Gateway();
await gateway.connect(connectionProfile, connectOptions);
```

The *query handler* object returned must implement the following functions.

```javascript
class MyQueryHandler {
	/**
	 * Evaluate the supplied query on appropriate peers.
	 * @param {Query} query A query object that provides an evaluate()
	 * function to invoke itself on specified peers.
	 * @returns {Buffer} Query result.
	 */
    async evaluate(query) { /* Your implementation here */ }
}
```

For a complete sample plug-in query handler implementation, see [sample-query-handler.ts](https://github.com/hyperledger/fabric-sdk-node/blob/master/test/typescript/integration/network-e2e/sample-query-handler.ts).
