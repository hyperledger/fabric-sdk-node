
This tutorial illustrates the use of channel-based events. These events are similar to the existing events, however are specific to a single channel. channel-based events are a new feature of the Hyperledger Fabric Node.js client as of 1.1.

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `Promise`.

### Overview
Channel-based events occur when there is a new block added to the channel ledger. A client application may use the Fabric Node.js client to register a listener to receive new blocks as they are added to the channel ledger. The Fabric Node.js client will also assist client applications by processing the incoming blocks and looking for specific transactions or chaincode events. This allows a client application to be notified of transaction completion or arbitrary chaincode events without having to perform multiple queries or search through blocks.

### new API on the Channel
* `newChannelEventHub(peer)` - A Channel instance method to get a new instance of a ChannelEventHub.

### new class ChannelEventHub and new APIs
* `registerBlockEvent(eventCallBack, errorCallBack, start_block)` - To register for block events.
* `unregisterBlockEvent(reg_num)` - To remove a block registration.
* `registerTxEvent(tx_id, eventCallBack, errorCallBack, start_block)` - To register for a specific transaction event.
* `unregisterTxEvent(tx_id)` - To remove a specific transaction registration.
* `registerChaincodeEvent(ccid, eventCallBack, errorCallBack, start_block)` - To register for chaincode events.
* `unregisterChaincodeEvent(cc_handle)` - To remove a chaincode event registration.
* `connect()` - To have the client channel event hub connect with the fabric network channel base event service. This call must be made before events will be received by your instance of a ChannelEventHub. This call may be made before or after the registrations of events.
* `disconnect()` - To have the client channel event hub shutdown the connection to the fabric network channel-based event service and notify all current channel event registrations of the shutdown by using the registered errorCallBacks.

##### `peer` parameter
This parameter must be included when getting a new instance of the ChannelEventHub. The value may be a `Peer` instance or the name of a peer when using a `connection profile` see [How to use a common network configuration file](tutorial-network-config.html).

##### `eventCallback` parameter
This parameter must be included. This is the callback function to be notified when this channel receives a new block, when listening for a specific transaction or chaincode events.

##### `errorCallback` parameter
This is an optional parameter. This is the callback function to be notified when this channel event hub is shutdown. The shutdown may be caused by a fabric network error, network connection problem or by a call to the "disconnect()" method.

##### `start_block` parameter
This is an optional parameter. This is is the starting block number for event checking. When included, the fabric channel-based event service will be asked to start sending blocks from this point. This could be used to resume and replay missed blocks that were added to the ledger. Since replaying events may confuse other event listeners, only one listener will be allowed on a ChannelEventHub when a start_block is included. When this parameter is excluded, which would be the normal situation, the fabric channel-based event service will be asked to start sending blocks from the last block on the ledger.

### Get a Channel Event Hub
A new method has been added to the fabric channel object to simplify setting up of an ChannelEventHub object. Use the following to get a ChannelEventHub instance that will be setup to work with the peer's channel-based event service. The ChannelEventHub instance will use all the same endpoint configuration settings that the peer instance is using, like the tls certs and the host and port address.

call by peer name
```
var channelEventHub = channel.getChannelEventHub('peer0.org1.example.com');
```

call by peer instance
```
let data = fs.readFileSync(path.join(__dirname, 'somepath/tlscacerts/org1.example.com-cert.pem'));
let peer = client.newPeer(
	'grpcs://localhost:7051',
	{
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': 'peer0.org1.example.com'
	}
);
let channelEventHub = channel.newChannelEventHub(peer);
channelEventHub.connect();
```
### Block Listener
When there is a need to monitor for new blocks being added to the channel ledger, use a block event listener. The fabric client Node.js will be notified when a new block is committed to the ledger on the fabric peer. The fabric client Node.js will then call the registered callback of the application program. The callback will be passed a JSON representation of the newly added block. When there is a need to see previously added blocks, the registration of the callback may include a starting block number. The callback will start receiving blocks from this number and continue to receive new blocks as they are added to the ledger. This is a way for the application to resume and replay events that may have been lost if the application were to be offline. The application should remember the last block it has processed to avoid replaying the entire ledger.

The following example will register a block listener to start receiving blocks.
```
// keep the block_reg to unregister with later if needed
block_reg = channelEventHub.registerBlockEvent((block) => {
	console.log('Successfully received the block event');
	<do something with the block>
}, (error)=> {
	console.log('Failed to receive the block event ::'+error);
	<do something with the error>
});
```

The following example will register with a start block number because this application needs to resume at a specific block and replay the missed blocks. The application callback will handle the replayed blocks in the same manor like current events. The block listener will continue to receive blocks as they are committed to the ledger on the fabric peer.
```
// keep the block_reg to unregister with later if needed
block_reg = channelEventHub.registerBlockEvent((block) => {
	console.log('Successfully received the block event');
	<do something with the block>
}, (error)=> {
	console.log('Failed to receive the block event ::'+error);
	<do something with the error>
},
	resume_point
);
```

### Transaction listener
When there is a need to monitor for the completion of a transaction on your organization's peer, use a transaction listener. The fabric client Node.js will be notified when a new block is committed to the ledger on the fabric peer. The fabric client Node.js will then check the block for registered transaction identifiers. If a transaction is found then the callback will be notified with the transaction ID, the transaction status, and the block number.

The following example will show registering a transaction ID within a javascript promise and building another promise for sending the transaction to the orderer. Both promises will be executed together so that the results will be received for both actions together.

```
let tx_object = client.newTransactionID();

// get the transaction ID string for later use
let tx_id = tx_object.getTransactionID();

let request = {
	targets : targets,
	chaincodeId: 'my_chaincode',
	fcn: 'invoke',
	args: ['doSomething', 'with this data'],
	txId: tx_object
};

return channel.sendTransactionProposal(request);
}).then((results) => {
// a real application would check the proposal results
console.log('Successfully endorsed proposal to invoke chaincode');

// start block may be null if there is no need to resume or replay
let start_block = getBlockFromSomewhere();

let event_monitor = new Promise((resolve, reject) => {
	let handle = setTimeout(() => {
		channelEventHub.unregisterTxEvent(tx_id);
		console.log('Timeout - Failed to receive the transaction event');
		reject(new Error('Timed out waiting for block event'));
	}, 20000);

	channelEventHub.registerTxEvent((event_tx_id, status, block_num) => {
		clearTimeout(handle);
		channelEventHub.unregisterTxEvent(event_tx_id);
		console.log('Successfully received the transaction event');
		storeBlockNumForLater(block_num);
		resolve(status);
	}, (error)=> {
		clearTimeout(handle);
		channelEventHub.unregisterTxEvent(tx_id);
		console.log('Failed to receive the transaction event ::'+error);
		reject(error);
	},
		start_block // when this value is null (the normal case) transaction
		            // checking will start with the latest block
	);
});
let send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

return Promise.all([event_monitor, send_trans]);
}).then((results) => {
```

### Chaincode event listener
When there is a need to monitor for events that will be posted from within your chaincode, use a chaincode event listener. The fabric client Node.js will be notified when a new block is committed to the ledger on the fabric peer. The fabric client Node.js will then check for registered chaincode patterns within the chaincode events of the block. If a chaincode event is found then the callback will be notified with the chaincode event object and the block number.

The following example will show registering a chaincode event listener within a javascript promise and building another promise for sending the transaction to the orderer. Both promises will be executed together so that the results will be received for both actions together. If a chaincode event listener is needed for long term monitoring,  follow the block listener example above.

```
let tx_object = client.newTransactionID();
let request = {
	targets : targets,
	chaincodeId: 'my_chaincode',
	fcn: 'invoke',
	args: ['doSomething', 'with this data'],
	txId: tx_object
};

return channel.sendTransactionProposal(request);
}).then((results) => {
// a real application would check the proposal results
console.log('Successfully endorsed proposal to invoke chaincode');

let event_monitor = new Promise((resolve, reject) => {
	let regid = null;
	let handle = setTimeout(() => {
		if (regid) {
			channelEventHub.unregisterChaincodeEvent(regid);
			console.log('Timeout - Failed to receive the chaincode event');
		}
		reject(new Error('Timed out waiting for chaincode event'));
	}, 20000);

	regid = channelEventHub.registerChaincodeEvent(chaincode_id.toString(), '^evtsender*',
		(event, block_num) => {
		clearTimeout(handle);
		channelEventHub.unregisterChaincodeEvent(regid);
		console.log('Successfully received the chaincode event');
		storeBlockNumForLater(block_num);
		resolve();
	}, (error)=> {
		clearTimeout(handle);
		channelEventHub.unregisterChaincodeEvent(regid);
		console.log('Failed to receive the chaincode event ::'+error);
		reject(error);
	});
});
let send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

return Promise.all([event_monitor, send_trans]);
}).then((results) => {
```


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
