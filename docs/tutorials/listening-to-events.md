This tutorial describes the different ways to listen to events emitted by a network using the fabric-network module.

### Overview

There are three event types that can be subscribed to:
1. Contract events - Those emitted explicitly by the chaincode developer within a transaction
2. Transaction (Commit) events - Those emitted automatically when a transaction is committed after an invoke
3. Block events - Those emitted automatically when a block is committed

Listening for these events allows the application to react without directly calling a transaction. This is ideal in use cases such as tracking network analytics.

### Usage

Each listener type takes at least one parameter, the event callback. This is the function that is called when an event is detected. This callback is overridden by the `fabric-network` in order to support `Checkpointing`. 

#### Contract events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('my-channel');
const contract = network.getContract('my-contract');

/**
 * @param {String} listenerName the name of the event listener
 * @param {String} eventName the name of the event being listened to
 * @param {Function} callback the callback function with signature (error, event, blockNumber, transactionId, status)
 * @param {Object} options
**/
const listener = await contract.addContractListener('my-contract-listener', 'sale', (error, event, blockNumber, transactionId, status) => {
	if (err) {
		console.error(err);
		return;
	}
	console.log(`Block Number: ${blockNumber} Transaction ID: ${transactionId} Status: ${status}`);
})
```
Notice that there is no need to specify an event hub, as the `EventHubSelectionStrategy` will select it automatically.

#### Block events

```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('my-channel');

/**
 * @param {String} listenerName the name of the event listener
 * @param {Function} callback the callback function with signature (error, blockNumber, transactionId, status)
 * @param {Object} options
**/
const listener = await network.addBlockListener('my-block-listener', (error, block) => {
	if (err) {
		console.error(err);
		return;
	}
	console.log(`Block: ${block}`);
}, {filtered: true /*false*/})
```
When listening for block events, it is important to specify if you want a filtered or none filtered event, as this determines which event hub is compatible with the request. 

#### Commit events

Option 1:
```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('my-channel');
const contract = network.getContract('my-contract');

const transaction = contract.newTransaction('sell');
/**
 * @param {String} transactionId the name of the event listener
 * @param {Function} callback the callback function with signature (error, transactionId, status, blockNumber)
 * @param {Object} options
**/
const listener = await network.addCommitListener(transaction.getTransactionID().getTransactionID(), (error, transactionId, status, blockNumber) => {
	if (err) {
		console.error(err);
		return;
	}
	console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
}, {}); 
```

Option 2:
```javascript
const gateway = new Gateway();
await gateway.connect(connectionProfile, gatewayOptions);
const network = await gateway.getNetwork('my-channel');
const contract = network.getContract('my-contract');

const transaction = contract.newTransaction('sell');
/**
 * @param {String} transactionId the name of the event listener
 * @param {Function} callback the callback function with signature (error, transactionId, status, blockNumber)
 * @param {Object} options
**/
const listener = await transaction.addCommitListener((error, transactionId, status, blockNumber) => {
	if (err) {
		console.error(err);
		return;
	}
	console.log(`Transaction ID: ${transactionId} Status: ${status} Block number: ${blockNumber}`);
}); 
```





