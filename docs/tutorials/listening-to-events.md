
# Listening to events with Fabric Network

This tutorial describes the different ways to listen to events emitted by a
Hyperledger Fabric network channel using the fabric-network event service.

Listening for events allows an application to react without directly
calling a transaction. This is ideal in use cases such as monitoring network
analytics.

## Events

The amount of information contained within the event provided to an application
event listener is determined at the time of the fabric-network event service
setup with the Hyperledger Fabric network channel.
The fabric-network event service must
connect with the Hyperledgert Fabric network channel Peer's event service to
receive new blocks as they are committed to the ledger. The conection setup will
determine if 'filtered' or 'full' blocks are received and if private data will
be include in the 'full' blocks. The fabric-network event service will check
each block for a match with each application event listener.
Filter blocks as the source of event data will have the best proformance and
require the minimum access authority to the Hyperledger Fabric network channel
ledger. Full blocks as the source of the event data may also include private
data if the application user is allowed to see the private data.

There are three types of application event listeners.
1. Block events - These are emitted automatically when a block is committed
to the ledger. Filtered blocks do not contain any transaction data or private
data, only status, therefore it may not be useful to the application monitoring
the the ledger. It is recommended that the fabric-network event service
receive full blocks, especially if private data information is required.
2. Contract events - A chaincode event name and value are explicitly added to
the transaction information by the chaicode when the chaincode is invoked.
When a transaction contains a chaincode event, it is emitted automatically
when the transaction is committed to the ledger.
When the fabric-network event service is receiving
filtered blocks as the source of a contract event, only the event name
as emitted by the chaincode will be provided, the chaincode event value
will not be available. The application must setup the fabric-network event
service to receive full blocks by using the 'filtered=false'.
3. Commit events - These are emitted automatically when a transaction
is committed to the ledger. Both filtered and full blocks will contain the
transaction id and it's status, therefore there no advantage to receiving
full blocks and the default of filtered blocks may be used.

## Usage

### Callback

To subscribe to listen for any of the event types, the application must provide
a callback. This is the function that is called when an event is emmitted.

### Naming

Each appliction event listener must have a unique name. This allows the application
to reuse event listeners.

### Block events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const listener = await network.addBlockListener('my-block-listener', (error, block) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Block: ${block}`);
});
```

When listening for block events, it is important to specify if you want a filtered or none filtered event, as this determines which event hub is compatible with the request.

### Contract events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const contract = network.getContract('my-contract');
const listener = await contract.addContractListener('my-contract-listener', 'sale', (err, blockNumber, chaincodeEvents) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Processing chaincode events in block number: ${blockNumber}`);
    for (const chaincodeEvent of chaincodeEvents) {
        const {chaincodeId, transactionId, status, eventName, payload} = chaincodeEvent;
        console.log(`Block Number:${blockNumber} EventName:${eventName} Transaction ID:${transactionId} Status:${status}`);
    }
})
```

Notice that there is no need to specify an event service instance, the
`EventSelectionStrategy` will select it automatically.

## Commit events

By default the commit listener will monitor for all transactions. Use
the option `trasactionId: '1234567890' to listen for a specific transaction.

### Monitor all transactions

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const contract = network.getContract('my-contract');

const transaction = contract.newTransaction('sell');
const listener = await network.addCommitListener(
    'All sell transactions',
    (err, blockNumber, transactionId, status) => {
        if (err) {
            console.error(err);
            return;
       }
       console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
    }
);
```

### Monitor for a known transaction

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const listener = await network.addCommitListener(
    'All sell transactions',
    (err, blockNumber, transactionId, status) => {
        if (err) {
            console.error(err);
            return;
       }
       console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
    },
    {
        transactionId: '1234567890'
    }
);
```

## Checkpointing

{@tutorial event-checkpointer}

## Start Block and End Block

In the {@link module:fabric-network~EventListenerOptions} it is possible to specify a `startBlock` and an `endBlock`. This behaves in the same way as the same options on {@link ChannelEventHub} shown in the tutorial here {@tutorial channel-events}. Using `startBlock` and `endBlock` disables event replay using a checkpointer for the events received by that listener.

## Unregistering listeners

`addContractListener`, `addBlockListener` and `addCommitListener` return a `ContractEventListener`, `BlockEventListener` and `CommitEventListener` respectively. Each has an `unregister()` function that removes the listener from the event services, meaning no further events will be received from that listener until `register()` is called again.
