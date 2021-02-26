
This tutorial illustrates the use of the service discovery by the Hyperledger Fabric Node.js fabric-network SDK.

For more information on:
* [Fabric Service Discovery](https://hyperledger-fabric.readthedocs.io/en/release-1.4/discovery-overview.html#how-service-discovery-works-in-fabric)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers) and the Fabric discovery service.
and of Node application development, including the use of the
Javascript `promise` and `async await`.

### Overview
The service discovery provided by Hyperledger Fabric helps an application
understand the current view of the network. Service discovery also has insight
into the endorsement policies of chaincodes and is able to provide lists of
peers that are currently active on the network that could be used to endorse a
proposal.
To use the discovery service, the network will be required to be configure with
a least one peer in the connection profile.

#### fabric-network APIs that can use the service discovery
* `gateway.connect` - This method has been enhanced by adding the discovery options.
* `gateway.getNetwork` - This method will initialize the network channel using the
discovery options from the gateway connect. Initialization includes discovering
peers and orderers on the network.
* `contract.addDiscoveryInterest` - This method will add collections and/or
additional chaincodes and collections to the contract's discovery interests.
These will be sent to the peer's discovery service when building an endorsement
plan. This allows the plan to be built based on the policy information of the
contract's chaincodes and collections. The contract will be initialized with
a discovery interest of the contract's associated chaincode name.
* `contract.resetDiscoveryInterest` - This method will re-initialize this
contract's discovery interests to be this contract's associated chaincode name.
Any collections that were added to this chaincode or additional chaincodes
that this chaincode may call must be added.
* `contract.submitTransaction` - When discovery is enabled by the gateway.connect
options, this method will use discovery to help endorse the proposal.
The contract's discovery interests help the peer's discovery service
build an endorsement plan that includes peers that will provide a successful
endorsement that will be able to be committed.
* `transaction.submit` - When discovery is enabled by the gateway.connect
options, this method will use discovery to help endorse the proposal.
The contract's discovery interests help the peer's discovery service
build an endorsement plan that includes peers that will provide a successful
endorsement that will be able to be committed.
* `contract.evaluateTransaction` - When discovery is enabled by the gateway.connect
options, this method will select from the peers that have been discovered during
the network channel initialization.
* `transaction.evaluate` - When discovery is enabled by the gateway.connect
options, this method will select from the peers that have been discovered during
the network channel initialization.

#### fabric-network gateway.connect DiscoveryOption settings
* `discovery.enabled` - boolean - True if discovery should be used; otherwise false.
* `discovery.asLocalhost` - boolean - Convert discovered host addresses to be
'localhost'. Will be needed when running a docker composed fabric network on the
local system; otherwise should be disabled.

### To use
By default the fabric-network will use the service discovery. To enable the
use of discovery, set the discovery 'enabled' attribute to a value of true. The default is true.

```
await gateway.connect(connectionProfile, {discovery: { enabled: true, asLocalhost: false}});
const network = await gateway.getNetwork('mychannel');

```

### To use with docker-compose
When the fabric network is running in a docker-compose and the node.js application
is running outside of the docker containers, it will be necessary to modify the
addresses returned from the discovery service. The discovery service sees the
addresses of the peers and orderers (host names and ports) as they exist in the
virtual systems. When the node.js application is running outside of docker,
it will only know the endpoints as `localhost` and port.
In the docker-compose file, notice how Docker is mapping the port addresses,
these must be same when using service discovery. Using `- 7061:7051` will not
work as the application does not have visibility into the virtual system and
the port address as seen by the peer's discovery service.

Set the `asLocalhost` to true, the default is true.
```
await gateway.connect(connectionProfile, {discovery: { enabled: true, asLocalhost: true}});
const network = await gateway.getNetwork('mychannel');
```

Notice in the following definition of a peer from a docker-compose file.
The port number is the same and has been defined along with the
host name `peer0.org1.example.com:7051` for the peer and gossip settings.
The node.js fabric-client application running outside of of the docker
containers will use `localhost:7051`. There is a mapping of the host name to
'localhost' but there is no mapping of the port address.

NOTE: All port addresses must be unique within the docker compose configuration
due to the mapping of the virtual host name to the `localhost`. All port addresses
must also be mapped within the docker compose to the same external address,
this will require that the fabric environment settings indicate to the peer and
orderer that port address.

```
peer0.org1.example.com:
  container_name: peer0.org1.example.com
  image: hyperledger/fabric-peer
  environment:
	- CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
	- CORE_PEER_ID=peer0.org1.example.com
	- CORE_PEER_ADDRESS=peer0.org1.example.com:7051 // notice how this matches the port mapping below
	- CORE_PEER_LISTENADDRESS=peer0.org1.example.com:7051
	- CORE_PEER_GOSSIP_ENDPOINT=peer0.org1.example.com:7051
	- CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051
	- FABRIC_LOGGING_SPEC=debug
	## the following setting redirects chaincode container logs to the peer container logs
	- CORE_VM_DOCKER_ATTACHSTDOUT=true
	- CORE_PEER_LOCALMSPID=Org1MSP
	- CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/msp/peer
	##
	- CORE_PEER_TLS_ENABLED=true
	- CORE_PEER_TLS_CLIENTAUTHREQUIRED=true
	- CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/msp/peer/tls/key.pem
	- CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/msp/peer/tls/cert.pem
	- CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/msp/peer/cacerts/org1.example.com-cert.pem
	- CORE_PEER_TLS_CLIENTROOTCAS_FILES=/etc/hyperledger/msp/peer/cacerts/org1.example.com-cert.pem
	# # the following setting starts chaincode containers on the same
	# # bridge network as the peers
	# # https://docs.docker.com/compose/networking/
	- CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fixtures_default
  working_dir: /opt/gopath/src/github.com/hyperledger/fabric
  command: peer node start
  ports:
	- 7051:7051 // notice internal and external are the same
  volumes:
	  - /var/run/:/host/var/run/
	  - ./channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/:/etc/hyperledger/msp/peer
  depends_on:
	- orderer.example.com
```

### using chaincode to chaincode calls and collections
The peer's discovery service will require information
on chaincodes, and collections that are involved in the
smart contract to develop a valid endorsement plan.
The contract's chaincode name will be automatically sent to
the peer's discovery service unless the contract indicates that it requires
other chaincodes and collections. These are known as 'discovery interests' to the
peer's discovery service.

If the endorsement will require one or more chaincode to chaincode calls and/or
be over collections, then the application must tell the contract object
instance of these names. This will assist the discovery service in putting
together an endorsement plan based on all the endorsement policies of the
chaincodes and collections involved and the active peers on the network.
The endorsement plan will include those peers that satisfy the endorsement
policies and the collection policies.

The following examples show how to add to the discovery interests when
the chaincode is in one or more collections or the chaincode is calling
other chaincodes.

```
// --------- example 0 --------------------------------------------
// when the smart contract's chaincode will not be calling another chaincode
// and will not be participating on a collection.
const contract = network.getContract('mychaincode1');

// produces discovery interests of:
[
	{name: 'mychaincode1'}
]
```

```
// --------- example 1 --------------------------------------------
// when the smart contract's chaincode will be calling another chaincode
const contract = network.getContract('mychaincode1');

// this adds to the interests
contract.addDiscoveryInterest({name: 'mychaincode2'});

// produces discovery interests of:
[
	{name: 'mychaincode1'},
	{name: 'mychaincode2'}
]
```
```
// --------- example 2 --------------------------------------------
// when the smart contract's chaincode is in a collection
const contract = network.getContract('mychaincode1');

// this adds the collection name to the contract's chaincode interest
contract.addDiscoveryInterest({name: 'mychaincode1', collectionNames: ['mycollection1']});

// produces discovery interests of:
[
	{name: 'mychaincode1', collectionNames: ['mycollection1']}
]
```
```
// --------- example 3 --------------------------------------------
// when the smart contract's chaincode is in multiple collections
// and will be calling another chaincode that is in
// multiple collections
const contract = network.getContract('mychaincode1');

// this adds the collection names to the contract's chaincode interest
contract.addDiscoveryInterest({name: 'mychaincode1', collectionNames: ['mycollection1', 'mycollection2']});

// this adds to the interests
contract.addDiscoveryInterest({name: 'mychaincode2', collectionNames: ['mycollection1', 'mycollection2']});

// produces discovery interests of:
[
	{name: 'mychaincode1', collectionNames: ['mycollection1', 'mycollection2']},
	{name: 'mychaincode2', collectionNames: ['mycollection1', 'mycollection2']}
]
```

If the discovery interests are not correct, use the `resetDiscoveryInterests` method
to return the contract's discovery interests to the default or initial state.
The initial discovery interests will include just the contract's chaincode name.

```
// create contract and default interests
const contract = network.getContract('mychaincode1');
// produces discovery interests of:
[
	{name: 'mychaincode1'}
]

// this adds to the interests
contract.addDiscoveryInterest({name: 'badchaincode'});
// produces discovery interests of:
[
	{name: 'mychaincode1'},
	{name: 'badchaincode'}
]

// this will reset the interests to the default
contract.resetDiscoveryInterests();
// produces discovery interests of:
[
	{name: 'mychaincode1'}
]
```

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
