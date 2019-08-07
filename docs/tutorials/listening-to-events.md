
# Listening to events with Fabric Network

This tutorial describes the different ways to listen to events emitted by a network using the fabric-network module.

## Overview

There are three event types that can be subscribed to:

1. Contract events - Those emitted explicitly by the chaincode developer within a transaction
2. Transaction (Commit) events - Those emitted automatically when a transaction is committed after an invoke
3. Block events - Those emitted automatically when a block is committed

Listening for these events allows the application to react without directly calling a transaction. This is ideal in use cases such as monitoring network analytics.

## Usage

Each listener type takes at least one parameter, the event callback. This is the function that is called when an event is received.

The callback function given is expected to be a promise, meaning that the callback can perform asynchronous tasks without risking missing events.

## Options

{@link module:fabric-network.Network~EventListenerOptions}.

*Note*: Listeners will connect to event hubs and ask to receive _unfiltered_ events by default. To receive _filtered_ events, set `EventListenerOptions.filtered: true`.

## Naming

All event listeners (including CommitEventListeners, which use the transaction ID) must have a unique name at the `Network` level

## Contract events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const contract = network.getContract('my-contract');

/**
 * @param {String} listenerName the name of the event listener
 * @param {String} eventName the name of the event being listened to
 * @param {Function} callback the callback function with signature (error, event, blockNumber, transactionId, status)
 * @param {module:fabric-network.Network~EventListenerOptions} options
**/
const listener = await contract.addContractListener('my-contract-listener', 'sale', (err, event, blockNumber, transactionId, status) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Block Number: ${blockNumber} Transaction ID: ${transactionId} Status: ${status}`);
})
```

Notice that there is no need to specify an event hub, as the `EventHubSelectionStrategy` will select it automatically.

### Block events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');

/**
 * @param {String} listenerName the name of the event listener
 * @param {Function} callback the callback function with signature (error, block)
 * @param {module:fabric-network.Network~EventListenerOptions} options
**/
const listener = await network.addBlockListener('my-block-listener', (error, block) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Block: ${block}`);
});
```

When listening for block events, it is important to specify if you want a filtered or none filtered event, as this determines which event hub is compatible with the request.

## Commit events

*Note*: The listener listener name is _transactionId_._\<some random string\>_

There are two methods for subscribing to a transaction commit event. Using {@link module:fabric-network.Network} and directly, using {@link module:fabric-network.Transaction}. Using {@link module:fabric-network.Transaction} directly, abstracts away the need to specify which transaction ID you wish to listen for.

### Option 1

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const contract = network.getContract('my-contract');

const transaction = contract.newTransaction('sell');
/**
 * @param {String} transactionId the transaction ID
 * @param {Function} callback the callback function with signature (error, transactionId, status, blockNumber)
 * @param {Object} options
**/
const listener = await network.addCommitListener(transaction.getTransactionID().getTransactionID(), (err, transactionId, status, blockNumber) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
});
```

### Option 2

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('mychannel');
const contract = network.getContract('my-contract');

const transaction = contract.newTransaction('sell');
/**
 * @param {String} transactionId the transaction ID
 * @param {Function} callback the callback function with signature (error, transactionId, status, blockNumber)
 * @param {Object} options
**/
const listener = await transaction.addCommitListener((err, transactionId, status, blockNumber) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
});
```

Both `Network.addCommitListener` and `Contract.addCommitListener` have an optional `eventHub` parameter. When set, the listener will only listen to that event hub, and in the event of an unforeseen disconnect, it will try and to reconnect without using the `EventHubSelectionStrategy`.

## Checkpointing

{@tutorial event-checkpointer}

## Start Block and End Block

In the {@link module:fabric-network~EventListenerOptions} it is possible to specify a `startBlock` and an `endBlock`. This behaves in the same way as the same options on {@link ChannelEventHub} shown in the tutorial here {@tutorial channel-events}. Using `startBlock` and `endBlock` disables event replay using a checkpointer for the events received by that listener.

## Unregistering listeners

`addContractListener`, `addBlockListener` and `addCommitListener` return a `ContractEventListener`, `BlockEventListener` and `CommitEventListener` respectively. Each has an `unregister()` function that removes the listener from the event hub, meaning no further events will be received from that listener until `register()` is called again.
