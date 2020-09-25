This tutorial describes the approaches that can be selected by users of the
fabric-network module for ensuring that submitted transactions are committed
on peers.

### Overview

The submit of a transaction involves several steps:
1. Send proposals to endorsing peers.
2. Send the endorsed transaction to the orderer.
3. The transaction is *eventually* committed on all peers in the network.

In some cases a client application might be happy to proceed immediately after
the transaction is successfully sent to the orderer. In other cases a client
application might need to ensure that the transaction has been committed on
certain peers with which it wants to interact before proceeding.

It is important to note that the blockchain state visible from a specific peer
will remain unchanged until a transaction is committed on that peer. If a
client application queries a peer for state after an endorsed transaction has
been successfully sent to the orderer but before the transaction has been
committed on that peer, the state returned will still be that prior to the
transaction. For example, a query of a bank balance after a transaction to
deduct funds from that bank account is submitted to the orderer will return
the old balance until the transaction is eventually committed on the peer
being queried.

### Event handling strategies

The SDK provides several selectable strategies for how it should wait for
commit events following a transaction invocation. The available strategies
are defined in `DefaultEventHandlerStrategies`. The desired strategy is
(optionally) specified as an argument to `connect()` on the `Gateway`, and
is used for all transaction invocations on Contracts obtained from that
Gateway instance.

If no event handling strategy is specified, `PREFER_MSPID_SCOPE_ALLFORTX` is used
by default. This uses all peers from the current organization if that organization
has any peers, otherwise it uses all peers from the network.

```javascript
import { Gateway, GatewayOptions, DefaultEventHandlerStrategies } from 'fabric-network';

const connectOptions: GatewayOptions = {
    eventHandlerOptions: {
        strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX
    }
}

const gateway = new Gateway();
await gateway.connect(connectionProfile, connectOptions);
```

Specifying `null` as the event handling strategy will cause transaction
invocations to return immediately after successfully sending the endorsed
transaction to the orderer. It will not wait for any commit events to be
received from peers.

For more details on *Event Handling Options*, see
[TransactionOptions](module-fabric-network.Gateway.html#~TransactionOptions).

### Plug-in event handlers

If behavior is required that is not provided by the default event handling
strategies, it is possible to implement your own event handling. This is
achieved by specifying your own factory function as the event handling
strategy. The factory function should return a *transaction event handler*
object and take two parameters:
1. transactionId: `string`
2. network: `Network`

The Network instance provides access to an underlying Channel object, from
which endorsing peers can be obtained.

```javascript
import { Gateway, GatewayOptions, TxEventHandlerFactory } from 'fabric-network';

const createTransactionEventHandler: TxEventHandlerFactory = (transactionId, network) => {
	/* Your implementation here */
    const mspId = network.getGateway().getIdentity().mspId;
    const myOrgPeers = network.getChannel().getEndorsers(mspId);
    return new MyTransactionEventHandler(transactionId, network, myOrgPeers);
}

const connectOptions: GatewayOptions = {
    transaction: {
        strategy: createTransactionEventhandler
    }
 }

const gateway = new Gateway();
await gateway.connect(connectionProfile, connectOptions);
```

The *transaction event handler* object returned must implement the following
functions:

```javascript
import { TxEventHandler } from 'fabric-network';

class MyTransactionEventHandler implements TxEventHandler {
    /**
     * Called to initiate listening for transaction events.
     */
    async startListening() { /* Your implementation here */ }

    /**
     * Wait until enough events have been received from peers to satisfy the event handling strategy.
     * @throws {Error} if the transaction commit is not successfully confirmed.
     */
    async waitForEvents() { /* Your implementation here */ }

    /**
     * Cancel listening for events.
     */
    cancelListening() { /* Your implementation here */ }
}
```

The *transaction event handler* implementation will typically use a commit
listener to monitor commit events from endorsing peers by calling
[Network.addCommitListener](module-fabric-network.Network.html#addCommitListener).

For a complete sample plug-in event handler implementation, see
[sample-transaction-event-handler.ts](https://github.com/hyperledger/fabric-sdk-node/blob/master/test/ts-scenario/config/handlers/sample-transaction-event-handler.ts).
