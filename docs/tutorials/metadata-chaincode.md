
This tutorial illustrates the use of adding metadata to your chaincode installation.
As of v1.1 the only metadata are the indexes that may be added to a CouchDB state
database of your channel ledger.

For more information:
* [getting started with Hyperledger Fabric](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html)
* [setting up a CouchDB as the state database](http://hyperledger-fabric.readthedocs.io/en/latest/couchdb_as_state_database.html)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `Promise`.

### Overview
Fabric 1.1 has introduced the capability of defining indexes in a CouchDB state
database to help improve performance of your queries made in your chaincode.
The index definitions need to be in JSON format and in files with a .json extension.
These definitions will be included in the chaincode installation package that
is sent to the Fabric peer.

#### Modified API's that allow for metadata
* `client.installChaincode()` - There is a new attribute ('metadataPath') that
may be included in the installation request. The value of the `metadataPath` is
a string representing the absolute path to the directory structure containing
the JSON index files.

### Installing chaincode
The following example will install the chaincode 'my_chaincode' and include
index files.
```
let targets = buildTargets(); //build the list of peers that will require this chaincode
let chaincode_path = path.resolve(__dirname, '../chaincode/src/node_cc/my_chaincode');
let metadata_path = path.resolve(__dirname, '../chaincode/my_indexes');

// send proposal to install
var request = {
	targets: targets,
	chaincodePath: chaincode_path,
	metadataPath: metadata_path, // notice this is the new attribute of the request
	chaincodeId: 'my_chaincode',
	chaincodeType: 'node',
	chaincodeVersion: 'v1'
};

client.installChaincode(request).then((results) => {
	var proposalResponses = results[0];
	// check the results
}, (err) => {
	console.log('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
});
```
The following shows the path used as the `metadataPath` above. This is the
required directory structure required under the path.
The `indexes` directory will hold the files with the index definitions.
The required directory structure and files with a 'json' extension will be
included in the chaincode installation package under the 'META_INF' package
directory. 'META-INF' should not be included in your local directory structure.

```
 ..
  <> chaincode
  │
  └─── <> my_indexes // here is where the 'metadataPath' will point to
       │
       └─── <> statedb //starting here are the required directories
            │
            └─── <> couchdb
                 │
                 └─── <> indexes // this directory will contain the index files
                         index-owner.json   // these will be the index files and must
                         index-address.json // have the file extension of 'json'
```
Each index must be defined in its own text file with an extension of `*.json`
and contain the index definition formatted in JSON following the
[CouchDB index JSON syntax](http://docs.couchdb.org/en/2.1.1/api/database/find.html#db-index).
```
{"index":{"fields":["docType","owner"]},"ddoc":"indexOwnerDoc", "name":"indexOwner","type":"json"}
```
<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
