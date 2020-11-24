This tutorial describes how peers are selected when a transaction is evaluated
and the results are not written to the ledger. The is considered to be a
query.

### Query handling strategies

The SDK provides two strategies to evaluate transactions.
The available strategies are defined
in `DefaultQueryHandlerStrategies`. The desired strategy is (optionally)
specified as an argument to `connect()` on the `Gateway`, and is used for
all transaction evaluations on Contracts obtained from that Gateway
instance.

If no query handling strategy is specified, `PREFER_MSPID_SCOPE_SINGLE` is used
by default. This will evaluate all transactions on the first peer from
which it can obtain a response, and only switch to another peer if this
peer fails. The list of peers will be all peers in the contract's `Network`
that belong to the gateway's organization, if that organization has any peers.
Otherwise, the list of peers will be all peers in the network. If you do not
want to fall back to all peers in the network when the gateway's organization has
no peers, use `MSPID_SCOPE_SINGLE` instead which will fail when there are no peers
in the gateway's organization.

There are another two query handling strategies provided called `PREFER_MSPID_SCOPE_ROUND_ROBIN`
and `MSPID_SCOPE_ROUND_ROBIN`.
This will evaluate a transaction starting with the first peer on the list.
It will try the peers in order until a response is received or all peers
have been tried. On the next call the second peer will be tried first and then
continue on in the list until a response is received. The starting point within
the list is incremented on each call, this will distribute the work load among all
responding peers. When using `PREFER_MSPID_SCOPE_ROUND_ROBIN`, the list of peers
will be all peers in the contract's `Network` that belong to the gateway's organization,
if that organization has any peers. Otherwise, the list of peers will be all peers
in the network. If you do not want to fall back to all peers in the network when the
gateway's organization has no peers, use `MSPID_SCOPE_ROUND_ROBIN` instead which will
fail when there are no peers in the gateway's organization.

```javascript
const { Gateway, DefaultQueryHandlerStrategies } = require('fabric-network');

const connectOptions = {
    queryHandlerOptions: {
        timeout: 3, // timeout in seconds
        strategy: DefaultQueryHandlerStrategies.MSPID_SCOPE_SINGLE
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
1. Blockchain network: `Network` - {@link fabric-network.Network}

The Network instance provides access to peers on which transactions should be
evaluated.

```javascript
// factory function will return the handler
function createQueryHandler(network) {
    // use the network to get all endorsing peers
    // of all organizations
    const peers = network.getEndorsers();
    // use the network to get endorsing peers
    // of my organization (MSPID of the organization)
    const peers = network.getEndorsers('mymspid');

    // build and return the query handler
    return new MyQueryHandler(peers);
}

const connectOptions = {
    query: {
        timeout: 3, // timeout in seconds (optional will default to 3)
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
	 * @param {Query} query - A query object that will send the
	 * query proposal to the peers and format the responses for this query handler
	 * @returns {Buffer} Query result.
	 */
    async evaluate(query) { /* Your implementation here */ }
}
```

Use the `query` instance provided to the `evaluate` method to make the query call
to the peer or peers of your Fabric network. The query instance will process
the peer responses of the endorsement and provide your handler with the results.
The results will be keyed by peer name and may contain either a `QueryResult`
or an `Error`.

The QueryResult:
```
export interface QueryResponse {
	isEndorsed: boolean; // indicates a good endorsement, required to have query results
	payload: Buffer; // The query results
	status: number; // status of the query, 200 successful, 500 failed
	message: string; // failed reason message
}
```

The following sample code is in TypeScript to show the object types involved.
```javascript
	public async evaluate(query: Query): Promise<Buffer> {
		const errorMessages: string[] = [];

		for (const peer of this.peers) {
			const results: QueryResults = await query.evaluate([peer]);
			const result = results[peer.name];
			if (result instanceof Error) {
				errorMessages.push(result.toString());
			} else {
				if (result.isEndorsed) {
					return result.payload;
				}
				errorMessages.push(result.message);
			}
		}

		const message = util.format('Query failed. Errors: %j', errorMessages);
		const error = new Error(message);
		throw error;
	}
```

For a complete sample plug-in query handler implementation, see [sample-query-handler.ts](https://github.com/hyperledger/fabric-sdk-node/blob/master/test/ts-scenario/config/handlers/sample-query-handler.ts).
