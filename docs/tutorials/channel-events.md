
This tutorial illustrates the use of channel-based events.
Channel-based events are a new feature of the Hyperledger Fabric Node.js client
as of v1.1. It replaces the event hub from v1.0, with a more useful
and reliable interface for applications to receive events.

For more information on getting started with Fabric check out
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).

The following assumes an understanding of Fabric networks (orderers and peers),
and of Node application development, including the use of the Javascript `Promise`.

### Overview
A client application may use the Fabric Node.js client to register a "listener"
to receive blocks as they are added to the channel ledger. We call these
"channel-based events", and they allow a client to start to receive blocks from
a specific block number, allowing event processing to run normally on blocks that
may have been missed. The Fabric Node.js client can also assist client
applications by processing the incoming blocks and looking for specific
transactions or chaincode events. This allows a client application to be
notified of transaction completion or arbitrary chaincode events without having
to perform multiple queries or search through the blocks as they are received.

Applications may use block or chaincode events to provide channel data to
other applications. For example an application could listen for block events
and write transaction data to a data store for the purpose of performing
queries or other analytics against the channel's data.
For each block received, the block listener application could iterate through
the block transactions, and build a data store using the key/value writes from
each valid transaction's 'rwset' (see the {@link Block} and {@link Transaction}
Type Definitions for details of these data structures).

The event service also allows applications to receive "filtered" block events
(which allow for receiving transaction validation status without providing
other sensitive information). Access to "filtered" and "unfiltered" events
can be configured independently in Fabric. The default behavior is to connect to
receive filtered block events. To connect to receive unfiltered block events
call `connect(true)` (see below).

Note that if you register for a block event and then submit a transaction, you should not
make any assumptions about which block contains your transaction. In particular,
you should not assume that your transaction is in the block associated with the
first block event received after registration to the peer's channel-based event
service. Instead, you may simply register for a transaction event.

### APIs on the Channel
* `newChannelEventHub(peer)` -- A Channel instance method to get a new instance
of a `ChannelEventHub`.
* `getChannelEventHubsForOrg` -- Gets a list of `ChannelEventHubs` based on an
organization. If the organization name is omitted then the current organization
of the current user is used.

### `ChannelEventHub` and APIs new in v1.1
* `registerBlockEvent(eventCallBack, errorCallBack, options)` -- To register for
block events.
* `unregisterBlockEvent(reg_num)` -- To remove a block registration.
* `registerTxEvent(tx_id, eventCallBack, errorCallBack, options)` -- To register
for a specific transaction event.
* `unregisterTxEvent(tx_id)` -- To remove a specific transaction registration.
* `registerChaincodeEvent(ccid, eventCallBack, errorCallBack, options)` -- To
register for chaincode events.
* `unregisterChaincodeEvent(cc_handle)` -- To remove a chaincode event
registration.
* `connect(full_block)` -- To have the client channel event hub connect with the
fabric channel-based event service. This call must be made before events will be
received by your instance of a `ChannelEventHub`. When the channel-based event hub
connects with the service, it will request to receive blocks or filtered blocks.
If the `full_block` parameter is omitted, it will default to false
and filtered blocks will be requested. Receiving blocks or filtered blocks
can not be changed once `connect()` is called.
When replaying blocks (by setting the startBlock and endBlock) `connect()` must be
called after registering the listener as the connection to the peer must be
setup to request existing blocks.
* `disconnect()` -- To have the client channel event hub shutdown the connection
to the fabric network channel-based event service and notify all current channel
event registrations of the shutdown by using the registered `errorCallBack`s.

#### `peer` parameter
This parameter must be included when getting a new instance of the
`ChannelEventHub`. The value may be a `Peer` instance or the name of a peer when
using a `connection profile` see [How to use a common common connection profile file](tutorial-network-config.html).

#### `eventCallback` parameter
This parameter must be included. This is the callback function to be notified
when this channel receives a new block, when listening for a specific
transaction or chaincode events.

#### `errorCallback` parameter
This is an optional parameter. This is the callback function to be notified when
this channel event hub is shutdown. The shutdown may be caused by a fabric
network error, network connection problem or by a call to the `disconnect()`
method.
This callback will also be called when the channel event hub is shutdown
due to the last block being received if replaying with the endBlock set to 'newest'.

#### `options` parameter
This is an optional parameter. This parameter will contain the following optional
properties:

* {integer} `startBlock` -- (Optional) The starting block number for event
  checking. When included, the peer's channel-based event service will be asked to start
  sending blocks from this block number.

  This is also how to resume listening or replay missed blocks that were added
	to the ledger. The default value is the number of the last block on the ledger.
	Replaying events may confuse other event listeners; therefore, only one listener
	will be allowed on a `ChannelEventHub` when `startBlock` and/or `endBlock` are used.
	When this parameter is excluded (as it will be normally) the event service
	will be asked to start sending blocks from the last (newest) block on the ledger.

* {integer | 'newest'} `endBlock` -- (Optional) The ending block number for event checking.
  When included, the peer's channel-based event service will be asked to stop
	sending blocks once this block is delivered.

  This is how to replay missed blocks that were added to the ledger. When a
	`startBlock` is not included, the `endBlock` must be equal to or larger than
	the current channel block height. Replaying events may confuse other event
	listeners; therefore, only one listener will be allowed on a `ChannelEventHub`
	when `startBlock` and/or `endBlock` are used.
	The value 'newest' will indicate that 'endBlock' will be calculated by the
	peer as the newest block on the ledger.
	This allows the application to replay up to the latest block on
	the ledger and then the listener will stop and be notified by the
	'onError' callback.

* {boolean} `unregister` -- (Optional) This setting indicates that the
  registration should be removed (unregister) when the event is seen. When the
	application is using a timeout to only wait a specified amount of time for the
	transaction to be seen, the timeout processing should include the manual
	'unregister' of the transaction event listener to avoid the event callbacks
	being called unexpectedly. The default for this setting is different for the
	different types of event listeners. For block listeners the default is true when
  an end_block was set as a option. For transaction listeners the default is true.
  For chaincode listeners the default will be false as the match filter might be
  intended for many transactions.

* {boolean} `disconnect` -- (Optional) This option setting Indicates to the
  `ChannelEventHub` instance to automatically disconnect itself from the peer's
	channel-based event service once the event has been seen. The default is false
	unless the endBlock has been set, then it it will be true.

### Get a Channel-based Event Hub
New methods have been added to the Fabric Node.js client `Channel` object to
simplify setting up of `ChannelEventHub` objects. Use the following to get a
`ChannelEventHub` instances that will be setup to work with the peer's
channel-based event service. A `ChannelEventHub` instance will use all the same
endpoint configuration settings that the peer instance is using, like the tls
certs and the host and port address.

When using a connection profile ([see](tutorial-network-config.html)) then
the peer's name may be used to get a new channel event hub.

```
const channel_event_hub = channel.newChannelEventHub('peer0.org1.example.com');
```

Here is an example of how to get a list of channel event hubs when using a
connection profile. The following will get a list based on the current
organization that is defined in the currently active `client` section of the
connection profile. Peers defined in the organization that have the `eventSource`
set to true will be added to the list.

```
const channel_event_hubs = channel.getChannelEventHubsForOrg();
```

When creating a peer instance, you can get a `ChannelEventHub` instance by using
the peer instance.

```
const data = fs.readFileSync(path.join(__dirname, 'somepath/tlscacerts/org1.example.com-cert.pem'));
const peer = client.newPeer(
	'grpcs://localhost:7051',
	{
		pem: Buffer.from(data).toString(),
		'ssl-target-name-override': 'peer0.org1.example.com'
	}
);
const channel_event_hub = channel.newChannelEventHub(peer);
```

### Block Listener
When there is a need to monitor for new blocks being added to the ledger,
use a block event listener. The Fabric client Node.js will be notified when a
new block is committed to the ledger on the peer. The client Node.js will then
call the registered callback of the application program. The callback will be
passed a JSON representation of the newly added block. Note that when `connect()`
is not called with a `true` value the callback will receive a filtered block.
The access rights of the user registering to receive full blocks will be checked
by the peer's channel-based event service. When there is a need to see previously
added blocks, the registration of the callback may include a starting block
number. The callback will start receiving blocks from this number and continue
to receive new blocks as they are added to the ledger. This is a way for the
application to resume and replay events that may have been lost if the
application were to be offline. The application should remember the last block
it has processed to avoid replaying the entire ledger.

The following example will register a block listener to start receiving new
blocks as they are added to the ledger.

```
// keep the block_reg to unregister with later if needed
block_reg = channel_event_hub.registerBlockEvent((block) => {
	console.log('Successfully received the block event');
	<do something with the block>
}, (error)=> {
	console.log('Failed to receive the block event ::'+error);
	<do something with the error>
});
```

The following example will register with a start block number because this
application needs to resume at a specific block and replay the missed blocks.
The application callback will handle the replayed blocks in the same manor like
current events. The block listener will continue to receive blocks as they are
committed to the ledger on the peer.

```
// keep the block_reg to unregister with later if needed
block_reg = channel_event_hub.registerBlockEvent((block) => {
	console.log('Successfully received the block event');
	<do something with the block>
}, (error)=> {
	console.log('Failed to receive the block event ::'+error);
	<do something with the error>
},
	{startBlock:23}
);
```

The following example will register with a start block number and an end block.
The application needs to replay the missed blocks. The application callback will
handle the replayed blocks in the same manor as current events. The block
listener will be automatically unregistered and the `ChannelEventHub` shutdown
when the end block event is seen by the listener. The application will not have
to handle this housekeeping.

```
block_reg = channel_event_hub.registerBlockEvent((full_block) => {
	console.log('Successfully received a block event');
	<do something with the block>
	const event_block = Long.fromValue(full_block.header.number);
	if(event_block.equals(current_block)) {
		console.log('Successfully got the last block number');
		<application is now up to date>
	}
}, (error)=> {
	console.log('Failed to receive the block event ::'+error);
	<do something with the error>
},
	// for block listeners, the defaults for unregister and disconnect are true,
	// so they are not required to be set in the following example
	{startBlock:23, endBlock:30, unregister: true, disconnect: true}
);
channel_event_hub.connect(true); //get full blocks
```

The following example will register with a start block number and an end block
set to 'newest'. The error callback will be called to notify the application
that the last block has been delivered and that the listener has been shutdown.

```
block_reg = channel_event_hub.registerBlockEvent((block) => {
	console.log('Successfully received the block event');
	<do something with the block>
}, (error)=> {
	if(error.toString().indexOf('Newest block received')) {
		console.log('Received latest block');
		<application is now up to date>
	} else {
		console.log('Failed to receive the block event ::'+error);
		<do something with the error>
	}

},
	{startBlock:23, endBlock:'newest'}
);
```

### Transaction listener
When there is a need to monitor for the completion of a transaction on your
organization's peer, use a transaction listener. The client Node.js will be
notified when a new block is committed to the ledger on the peer. The client will
then check the block for registered transaction identifiers. If a transaction is
found then the callback will be notified with the transaction ID, the transaction
status, and the block number. Filtered blocks contain the transaction status, so
there is no need to connect to the peer's channel-based event service to receive
full blocks. Since most non-admin users will not be able to see full blocks,
connecting to receive filtered blocks will avoid access issues when those users
only need to listen for their transactions to be committed.

The following example will show registering a transaction ID within a javascript
promise and building another promise for sending the transaction to the orderer.
Both promises will be executed together so that the results will be received for
both actions together. The default optional setting of `unregister` is true with
a transaction listener. Therefore in the following example the listener that is
registered will be automatically unregistered after the listener sees the
transaction.

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
		// do the housekeeping when there is a problem
		channel_event_hub.unregisterTxEvent(tx_id);
		console.log('Timeout - Failed to receive the transaction event');
		reject(new Error('Timed out waiting for block event'));
	}, 20000);

	channel_event_hub.registerTxEvent((event_tx_id, status, block_num) => {
		clearTimeout(handle);
		//channel_event_hub.unregisterTxEvent(event_tx_id); let the default do this
		console.log('Successfully received the transaction event');
		storeBlockNumForLater(block_num);
		resolve(status);
	}, (error)=> {
		clearTimeout(handle);
		console.log('Failed to receive the transaction event ::'+error);
		reject(error);
	},
		// when this `startBlock` is null (the normal case) transaction
		// checking will start with the latest block
		{startBlock:start_block}
		// notice that `unregister` is not specified, so it will default to true
		// `disconnect` is also not specified and will default to false
	);
	channel_event_hub.connect();
});
let send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

return Promise.all([event_monitor, send_trans]);
}).then((results) => {
```

### Chaincode event listener
When there is a need to monitor for events that will be posted from within your
chaincode, use a chaincode event listener. The client Node.js will be
notified when a new block is committed to the ledger. The client will then check
for registered chaincode patterns within the chaincode event's name field. The
registration of the listener includes a regular expression to be used in the
check against a chaincode event name. If a chaincode event name is found to
match the listener's regular expression then the listener's callback will be
notified with the chaincode event, the block number, transaction id, and
transaction status. Filtered blocks will not have the chaincode event payload
information; it has only the chaincode event name. If the payload information is
required, the user must have access to the full block and the channel event hub
must be `connect(true)` to receive the full block events from the peer's
channel-based event service.

The following example demonstrates registering a chaincode event listener within a
javascript promise and building another promise for sending the transaction to
the orderer. Both promises will be executed together so that the results will
be received for both actions together. If a chaincode event listener is needed
for long term monitoring, follow the block listener example above.

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

// Build the promise to register a event listener with the NodeSDK.
// The NodeSDK will then send a request to the peer's channel-based event
// service to start sending blocks. The blocks will be inspected to see if
// there is a match with a chaincode event listener.
let event_monitor = new Promise((resolve, reject) => {
	let regid = null;
	let handle = setTimeout(() => {
		if (regid) {
			// might need to do the clean up this listener
			channel_event_hub.unregisterChaincodeEvent(regid);
			console.log('Timeout - Failed to receive the chaincode event');
		}
		reject(new Error('Timed out waiting for chaincode event'));
	}, 20000);

	regid = channel_event_hub.registerChaincodeEvent(chaincode_id.toString(), '^evtsender*',
		(event, block_num, txnid, status) => {
		// This callback will be called when there is a chaincode event name
		// within a block that will match on the second parameter in the registration
		// from the chaincode with the ID of the first parameter.
		console.log('Successfully got a chaincode event with transid:'+ txnid + ' with status:'+status);

		// might be good to store the block number to be able to resume if offline
		storeBlockNumForLater(block_num);

		// to see the event payload, the channel_event_hub must be connected(true)
		let event_payload = event.payload.toString('utf8');
		if(event_payload.indexOf('CHAINCODE') > -1) {
			clearTimeout(handle);
			// Chaincode event listeners are meant to run continuously
			// Therefore the default to automatically unregister is false
			// So in this case we want to shutdown the event listener once
			// we see the event with the correct payload
			channel_event_hub.unregisterChaincodeEvent(regid);
			console.log('Successfully received the chaincode event on block number '+ block_num);
			resolve('RECEIVED');
		} else {
			console.log('Successfully got chaincode event ... just not the one we are looking for on block number '+ block_num);
		}
	}, (error)=> {
		clearTimeout(handle);
		console.log('Failed to receive the chaincode event ::'+error);
		reject(error);
	}
		// no options specified
		// unregister will default to false
		// disconnect will default to false
	);
});

// build the promise to send the proposals to the orderer
let send_trans = channel.sendTransaction({proposalResponses: results[0], proposal: results[1]});

// now that we have two promises all set to go... execute them
return Promise.all([event_monitor, send_trans]);
}).then((results) => {
```

### When using mutual tls
All peers and orderers objects need to use the same client side credentials
for a mutual TLS connection. The credentials must be assigned to the 'client'
object instance before it is used to create the peer used in the ChannelEventHub
creation.

```
const client = new Client();
client.setTlsClientCertAndKey(tlsInfo.certificate, tlsInfo.key);

const channel = client.newChannel('mychannel');
const peer = client.newPeer('grpcs://localhost:7051', {
	pem: '<pem string here>',
	'ssl-target-name-override': 'peer0.org1.example.com'
});
channel.addPeer(peer);
const channelEventHub = channel.newChannelEventHub(peer);
```

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
