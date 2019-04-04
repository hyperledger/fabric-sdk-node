This tutorial describes the approaches that can be selected by users of the fabric-network module for replaying missed events emitted by peers.

### Overview

Events are emitted by peers when blocks are committed. Two types of events support checkpointing:
1. Contract events (also known as chaincode events) - Defined in transactions to be emitted. E.g. an event emitted when a commercial paper is sold
2. Block Events - Emitted when a block is committed

In the case of an application crashing and events being missed, applications may still want to execute the event callback for the event it missed. Peers in a Fabric network support event replay, and to support this, the fabric-network module supports checkpointing strategies that track the last block and transactions in that block, that have been seen by the client. 

#### Notes
`Block Number` = `Block Height - 1` 
When using checkpointing:
- The listener will only catch up on events if the `startBlock` is less than the current `Block Number`
- If the latest block in the checkpointer is block `n` the `startBlock` will be `n + 1` (e.g. for checkpoint `blockNumber=1`,`startBlock=2`)

### Checkpointers

The `BaseCheckpoint` class is an interface that is to be used by all Checkpoint classes. fabric-network has one default class, `FileSystemCheckpointer` that is exported as a factory in the `CheckpointFactories`. The `FILE_SYSTEM_CHECKPOINTER` is the default checkpointer.

A checkpoint factory is a function that returns an instance with `BaseCheckpointer` as a parent class. These classes implement the `async save(channelName, listenerName)` and `async load()` functions. 

A checkpointer is called each time the event callback is triggered. 

The checkpointer can be set when connecting to a gateway or when creating the event listener.
```javascript
const { Gateway, CheckpointFactories } = require('fabric-network');

const connectOptions = {
	checkpointer: { 
		factory: CheckpointFactories.FILE_SYSTEM_CHECKPOINTER,
		options: {} // Options usable by the factory
	}
};

const gateway = new Gateway()
await gateway.connect(connectionProfile, connectOptions);
```

Configuring a listener to be checkpointed required two properties:
1. `replay : boolean` - Tells the listener to record a checkpoint. Required if checkpointing is desired
2. `checkpointer : BaseCheckpointer` - If a checkpointer is not specified in the gateway, it must be specified here
```javascript
const listener = await contract.addContractListener('saleEventListener', 'sale', (err, event, blockNumber, txId) => {
	if (err) {
		console.error(err);
		return;
	}
	// -- Do something
}, {replay: true, checkpointer: {factory: MyCheckpointer});
```

### Custom Checkpointer

Users can configure their own checkpointer. This requires two components to be created:
1. The Checkpointer class
2. The Factory

```javascript
class DbCheckpointer extends BaseCheckpointer {
	constructor(channelName, listenerName, dbOptions) {
		super(channelName, listenerName);
		this.db = new Db(dbOptions);
	}

	async save(transactionId, blockNumber) { /* Your implementation using a database */ }

	async load() { /* Your implementation using a database*/ }
}

function BD_CHECKPOINTER_FACTORY(channelName, listenerName, options) {
	return new DbCheckpointer(channelName, listenerName, options);
}

const gateway = new Gateway();
await gateway.connect({
	checkpointer: { 
		factory: DB_CHECKPOINTER_FACTORY,
		options: {host: 'http://localhost'}
});
```
