
This tutorial illustrates how to use the Node.js SDK APIs to store and retrieve private data in the Hyperledger Fabric network.

Starting in v1.2, Fabric offers the ability to create private data collections, which allows a subset of organizations on
a channel to endorse, commit, or query private data without having to create a separate channel. For more information,
refer to:

* [Private Data Concept](http://hyperledger-fabric.readthedocs.io/en/latest/private-data/private-data.html) 
* [Private Data Architecture](http://hyperledger-fabric.readthedocs.io/en/latest/private-data-arch.html)
* [Using Private Data in Fabric](http://hyperledger-fabric.readthedocs.io/en/latest/private_data_tutorial.html)

### Overview
The following are the steps to use private data with the Node.js SDK (fabric-client). Check out the sections below for details on these steps.

1. Create a collection definition json file
2. Implement chaincode to store and query private data
3. Install and instantiate chaincode with a collection definition
4. Invoke chaincode to store and query private data
5. Purge private data
6. Query for a collection definition

### Create a collection definition json file
A collection definition describes who can persist data, how many peers the data is distributed to, how many peers are
required to disseminate the private data, and how long the private data is persisted in the private database. Chaincode APIs
will map the collection to the private data by the collection name.

A collection definition is composed of the following five properties.

* `name`: Name of the collection.
* `policy`: Defines the organization peers allowed to persist the collection data.
* `requiredPeerCount`: Number of peers required to disseminate the private data as a condition
of the endorsement of the chaincode
* `maxPeerCount`: For data redundancy purposes, the number of other peers that the current
endorsing peer will attempt to distribute the data to. If an endorsing peer goes down, these
other peers are available at commit time if there are requests to pull the private data.
* `blockToLive`: For very sensitive information such as pricing or personal information,
this value represents how long the data should live on the private database in terms of blocks.
The data will be purged after this specified number of blocks on the private database. To keep
private data indefinitely, that is, to never purge private data, set the blockToLive property to 0.

Here is a sample collection definition JSON file, containing an array of two collection definitions:
```json
[
	{
		"name": "collectionMarbles",
		"policy": {
			"identities": [
				{
					"role": {
						"name": "member",
						"mspId": "Org1MSP"
					}
				},
				{
					"role": {
						"name": "member",
						"mspId": "Org2MSP"
					}
				}
			],
			"policy": {
				"1-of": [
					{
						"signed-by": 0
					},
					{
						"signed-by": 1
					}
				]
			}
		},
		"requiredPeerCount": 1,
		"maxPeerCount": 2,
		"blockToLive": 100
	},
	{
		"name": "collectionMarblePrivateDetails",
		"policy": {
			"identities": [
				{
					"role": {
						"name": "member",
						"mspId": "Org1MSP"
					}
				}
			],
			"policy": {
				"1-of": [
					{
						"signed-by": 0
					}
				]
			}
		},
		"requiredPeerCount": 1,
		"maxPeerCount": 1,
		"blockToLive": 100
	}
]
```

This example contains two private data collections: `collectionMarbles` and `collectionMarblePrivateDetails`.
The policy property in the collectionMarbles definition allows all members of the channel (`Org1` and `Org2`) to have
the private data in a private database. The collectionMarblesPrivateDetails collection allows only members of `Org1`
to have the private data in their private database.

For Node.js SDK, you must define policies in the same format as shown above.

### Implement chaincode to store and query private data
Fabric provides chaincode APIs to store and query private data. As an example, check out [marbles private data example](
https://github.com/hyperledger/fabric-samples/blob/master/chaincode/marbles02_private/go/marbles_chaincode_private.go)
to understand how to use the chaincode APIs to read and write private data.

This example implements the following functions to manage private data.

* `readMarble`: query the values of the `name`, `color`, `size` and `owner` attributes using collection `collectionMarbles`.
* `readMarblePrivateDetails`: query the values of the `price` attribute using collection `collectionMarblePrivateDetails`.
* `initMarble`: store private data for the collections.
* `delete`: delete a marble from private database.

### Install and instantiate chaincode with a collection definition
Client applications interact with the blockchain ledger through chaincode. As such
we need to install and instantiate the chaincode on every peer that will execute and
endorse transactions. When instantiated a chaincode on a channel the collection will
be associated with that chaincode.

* Install chaincode. No specific parameter needed to support private data.
* Instantiate chaincode. To support private data, the request must include the `collections-config` attribute.
```javascript
const collectionsConfigPath = path.resolve(__dirname, collection_definition_json_filepath);
const request = {
	targets: peers,
	chaincodeId: chaincodeId,
	chaincodeType: chaincodeType,
	chaincodeVersion: chaincodeVersion,
	fcn: functionName,
	args: args,
	txId: tx_id,
	'collections-config': collectionsConfigPath
};
const endorsementResults = await channel.sendInstantiateProposal(request, time_out);
// additional code needed to validate endorsementResults and send transaction to commit
......
```

### Invoke chaincode to store and query private data
You must be authorized to transact with the private data based on the policy defined in collection definition.
Recall that the above collection definition allows all members of `Org1` and `Org2` to access `collectionMarbles` (name,
color, size, and owner) in their private database, but only peers in `Org1` can have access to
`collectionMarblePrivateDetails` (price) in their private database.

Acting as a member of `Org1`, you can do the following with [marbles private data example](
https://github.com/hyperledger/fabric-samples/blob/master/chaincode/marbles02_private/go/marbles_chaincode_private.go),

* Invoke `initMarble` to create a marble with private data.
* Invoke `readMarble` to read name, color, size and owner from the private database for `collectionMarbles`.
* Invoke `readMarblePrivateDetails` to read price from the private database for `collectionMarblePrivateDetails`.

### Purge private data
The Hyperledger Fabric allows client applications to optionally purge the private data in a collection by setting the
`blockToLive` property. This option may be needed when private data include personal or confidential information
and transacting parties want to have a limited lifespan for the data.

When `blockToLive` is set to a non-zero value in the collection definition file, Fabric will automatically purge the related
private data after the specified number of blocks are committed. Client applications do not need to call any API.

### Query for a collection definition
The Hyperledger Fabric allows client applications to query a peer for collection definitions.
The Node.js SDK (fabric-client) has an API that will query a Hyperledger Fabric Peer for a
collection definition associated with a chaincode running on the specified channel.
See {@link Channel#queryCollectionsConfig} for detailed information.
```javascript
const request = {
	chaincodeId: chaincodeId,
	target: peer
};

try {
	const response = await channel.queryCollectionsConfig(request);
	// response contains an array of collection definitions
	return response;
} catch (error) {
	throw error;
}
```

### Include private data in a transaction invocation
The client application must put all private data into the transient
data of the proposal request if the application wishes to keep
the data private. Transient data is not returned in the
endorsement results, only the hash of the transient data is
returned in the endorsement created by the peer.
The chaincode executed during the endorsement will be responsible
for pulling the private data from the transient area of the proposal
request and then work with the private data store of the peer.

#### Example using fabric-network API
```javascript
// Private data sent as transient data: { [key: string]: Buffer }
const transientData = {
	marblename: Buffer.from('marble1'),
	color: Buffer.from('red'),
	owner: Buffer.from('John'),
	size: Buffer.from('85'),
	price: Buffer.from('99')
};
const result = await contract.createTransaction('initMarble')
	.setTransient(transientData)
	.submit();
```

#### Example using fabric-client API
```javascript
// private data
const transient_data = {
	'marblename': Buffer.from('marble1'), // string <-> byte[]
	'color': Buffer.from('red'), // string <-> byte[]
	'owner': Buffer.from('John'), // string <-> byte[]
	'size': Buffer.from('85'), // string <-> byte[]
	'price': Buffer.from('99') // string <-> byte[]
};
const tx_id = client.newTransactionID();
const request = {
	chaincodeId : chaincodeId,
	txId: tx_id,
	fcn: 'initMarble',
	args: [], // all data is transient data
	transientMap: transient_data // private data
};

// results will not contain the private data
const endorsementResults = await channel.sendTransactionProposal(request);
```
