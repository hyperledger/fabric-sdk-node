
This tutorial illustrates how to use the Node.js SDK APIs to store and retrieve private data in the Hyperledger Fabric network.

Starting in v1.2, Fabric offers the ability to create private data collections, which allows a subset of organizations on 
a channel to endorse, commit, or query private data without having to create a separate channel.For more information, 
refer to [Private Data Concept](
http://hyperledger-fabric.readthedocs.io/en/latest/private-data/private-data.html), [Private Data Architecture](
http://hyperledger-fabric.readthedocs.io/en/latest/private-data-arch.html), and [Using Private Data in Fabric](
http://hyperledger-fabric.readthedocs.io/en/latest/private_data_tutorial.html)

### Overview
The following are the steps to use private data with the Node.js SDK.

1. [Create a collection definition json file](#create-a-collection-definition-json-file)
2. [Implement chaincode to store and query private data](#implement-chaincode-to-store-and-query-private-data)
3. [Install and instantiate chaincode with a collection definition](#install-and-instantiate-chaincode-with-a-collection-definition)
4. [Invoke chaincode to store and query private data](#invoke-chaincode-to-store-and-query-private-data)
5. [Purge private data](#purge-private-data)

### Create a collection definition json file
A collection definition describes who can persist data, how many peers the data is distributed to, how many peers are 
required to disseminate the private data, and how long the private data is persisted in the private database. Chaincode APIs 
will map the collection to the private data.

A collection definition is composed of the following five properties.

* `name`: Name of the collection.
* `policy`: Defines the organization peers allowed to persist the collection data.
* requiredPeerCount: Number of peers required to disseminate the private data as a condition
of the endorsement of the chaincode
* `maxPeerCount`: For data redundancy purposes, the number of other peers that the current 
endorsing peer will attempt to distribute the data to. If an endorsing peer goes down, these 
other peers are available at commit time if there are requests to pull the private data.
* `blockToLive`: For very sensitive information such as pricing or personal information, 
this value represents how long the data should live on the private database in terms of blocks. 
The data will be purged after this specified number of blocks on the private database. To keep 
private data indefinitely, that is, to never purge private data, set the blockToLive property to 0.

Here is a sample collection definition JSON file, containing an array of two collection definitions:
```
[{
    "name": "collectionMarbles",
    "policy": {
      "identities": [{
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
      "identities": [{
        "role": {
          "name": "member",
          "mspId": "Org1MSP"
        }
      }],
      "policy": {
        "1-of": [{
          "signed-by": 0
        }]
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

For Node.js SDK, you must define policies in the same format as shown in the above. Although the format looks different 
than what is specified in [Private data collection definition](
http://hyperledger-fabric.readthedocs.io/en/latest/private-data-arch.html#private-data-collection-definition), these two formats are resolved to the same policy.

### Implement chaincode to store and query private data
A set of shim APIs are available for setting and retrieving private data. For example, the following APIs are provided 
to read, write, and delete private data in chaincode.

* `GetPrivateData(collection, key)`: query private data from the private database. The API requires
two arguments, the collection name and the data key.
* `PutPrivateData(collection, key, value)`: store the private data into the private database. The API 
requires three arguments, the collection name, the data key and value.
* `DelPrivateData(collection, key)`: delete the private data from the private database. The API requires
two arguments, the collection name and the data key.

According to how the data will be accessed, the marble private data example divides the private data into two separate
data definitions, one for each collection. The collectionMarbles collection has name, color, size and owner, while the 
collectionMarblePrivateDetails collection has price.

Check out the chaincode in [marbles private data example](
https://github.com/hyperledger/fabric-samples/blob/master/chaincode/marbles02_private/go/marbles_chaincode_private.go) for implementation details.
Look at the following functions to understand how to handle the private data using chaincode API.

* `readMarble`: query the values of the name, color, size and owner attributes
* `readMarblePrivateDetails`: query the values of the price attribute
* `initMarble`: store private data for the collections. Because private data `price`will be stored separately
from other data (name, owner, color, and size), the function calls the `PutPrivateData()` API twice 
to persist the private data, once for each collection.
* `delete`: remove a marble key/value pair from state. 

### Install and instantiate chaincode with a collection definition
Client applications interact with the blockchain ledger through chaincode. As such 
we need to install and instantiate the chaincode on every peer that will execute and 
endorse transactions. Below code snippets call the Node.js SDK APIs to install and instantiate chaincode.

* Install chaincode. No specific parameter needed to support private data.
```
		var request = {
			targets: peers,
			chaincodePath: chaincodePath,
			chaincodeId: chaincodeId,
			chaincodeVersion: chaincodeVersion,
			chaincodeType: chaincodeType
		};
		var results = await client.installChaincode(request);
```

* Instantiate chaincode. To support private data, the request must include the 'collections-config' attribute.
```
		const collectionsConfigPath = path.resolve(__dirname, collection_definition_json_filepath);
		var request = {
			targets : peers,
			chaincodeId: chaincodeId,
			chaincodeType: chaincodeType,
			chaincodeVersion: chaincodeVersion,
			fcn: functionName,
			args: args,
			txId: tx_id,
			'collections-config': collectionsConfigPath
		};
		var endorsementResults = await channel.sendInstantiateProposal(request, time_out);
		// validate endorsementResults, register events, and build a tx_request to send transaction to commit
		...
		var tx_request = {
			txId: tx_id,
			proposalResponses: proposalResponses,
			proposal: proposal
		};
		var txPromise = channel.sendTransaction(tx_request);
		// check results from sendTransaction and eventhub
		...
```

### Invoke chaincode to store and query private data
You must be authorized to transact with the private data based on the policy defined in collection definition.
Recall that the collection definition allows all members of `Org1` and `Org2` to access `collectionMarbles` (name, 
color, size, and owner private data) in their side database, but only peers in `Org1` can have access to 
`collectionMarbleDetail` (the price private data) in their side database.

Below snippets use [marbles private data example](https://github.com/hyperledger/fabric-samples/blob/master/chaincode/marbles02_private/go/marbles_chaincode_private.go).

* Invoke the `initMarble` function that creates a marble with private data.
The initMarble function will store `price` separately from other data such as name, owner, 
color, and size because they are defined in two separate collections.
```
		var request = {
			targets: peerNames,
			chaincodeId: chaincodeId,
			fcn: 'initMarble',
			args: [marble1', 'blue', '35', 'tom', '99'],
			txId: tx_id
		};
		var results = await channel.sendTransactionProposal(request);
		// validate endorsementResults, register events, and send transaction for commit
		...
```

* Invoke the `readMarble` function that reads from the private database for collectionMarbles, 
where name, color, size, owner are stored.
```
		var request = {
			targets: peerNames,
			chaincodeId: chaincodeId,
			fcn: 'readMarble',
			args: ['marble1'],
			txId: tx_id
		};
		var results = await channel.sendTransactionProposal(request);
```

* Invoke the `readMarblePrivateDetails` function that reads from the private database for 
`collectionMarblePrivateDetails`, where prices is stored.
```
		var request = {
			targets: peerNames,
			chaincodeId: chaincodeId,
			fcn: 'readMarblePrivateDetails',
			args: ['marble1'],
			txId: tx_id
		};
		var results = await channel.sendTransactionProposal(request);
```

### Purge private data
The Hyperledger Fabric allows client applications to optionally purge the private data in a collection by setting the 
`blockToLive` property. This option may be needed when private data include personal or confidential information
and transacting parties want to have a limited lifespan for these data.

When `blockToLive` is set to a non-zero value in the collection definition file, Fabric will automatically purge the related
private data after the specified number of blocks are committed. Client applications do not need to call any API.
