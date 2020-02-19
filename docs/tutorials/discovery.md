
This tutorial illustrates the use of the service discovery by the Hyperledger Fabric Node.js fabric-network SDK.

For more information on:
* [Service Discovery](https://hyperledger-fabric.readthedocs.io/en/release-2.0/discovery-overview.html#how-service-discovery-works-in-fabric)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `promise` and `async await`.

### Overview
The service discovery provided by the Hyperledger Fabric helps an application
understand the current view of the network. Service discovery also has insight
into the endorsement policies of chaincodes and is able to provide lists of
peers that are currently active on the network that could be used to endorse a
proposal.
To use the discovery service, the application will have to define just one peer.

#### fabric-network APIs that can use the service discovery
* `gateway.connect` - This method has been enhanced by adding the discovery options.
* `gateway.getNetwork` - This method will initialize the network channel using the
discovery options from the gateway connect.
* `contract.setDiscoveryInterests` - This method will indicate that this contract
is participating in a collection and that it may be calling other chaincodes.
The peer's discovery service will use this information to build an endorsement
plan that uses the policy information of the contract's chaincodes and collections.
* `contract.submitTransaction` - When discovery is enabled by the gateway.connect
options, this method will use discovery to help endorse the proposal.
* `transaction.submit` - - When discovery is enabled by the gateway.connect
options, this method will use discovery to help endorse the proposal.
* `contract.evaluateTransaction` - When discovery is enabled by the gateway.connect
options, this method will select from the peers that have been discovered during
the network channel initialization.
* `transaction.evaluate` - When discovery is enabled by the gateway.connect
options, this method will select from the peers that have been discovered during
the network channel initialization.

#### fabric-network gateway.connect DiscoveryOption settings
* `discovery.enabled` - boolean - True if discovery should be used; otherwise false.
* `discovery.asLocalHost` - boolean - Convert discovered host addresses to be
'localhost'. Will be needed when running a docker composed fabric network on the
local system; otherwise should be disabled.

### To use
By default the fabric-network will not use the service discovery. To enable the
use of discovery, set the discovery 'enabled' attribute to a value of true.

```
await gateway.connect(connectionProfile, {discovery: { enabled: true, asLocalhost: false}});
const network = await gateway.getNetork('mychannel');

```

### To use with docker-compose
When the fabric network is running in a docker-compose and the node.js application
is running outside of the docker containers, it will be necessary to modify the
addresses returned from the discovery service. The discovery service sees the
addresses of the peers and orderers as host names and ports as they exist in the
virtual systems, however the node.js
application running outside of docker will only know the endpoints as `localhost`
and port. In the docker-compose file, notice how Docker is mapping the port addresses,
these must be same when using service discovery. Using `- 7061:7051` will not
work as the application does not have visibility into the virtual system and
the port address as seen by the peer's discovery service.

Use the `asLocalhost` with true or false, the default is true.
```
await gateway.connect(connectionProfile, {discovery: { enabled: true, asLocalhost: true}});
const network = await gateway.getNetork('mychannel');
```

Notice in the following definition of a peer from a docker-compose file.
The port number is the same and has been defined along with the
host name `peer0.org1.example.com:7051` for the peer and gossip settings.
The node.js fabric-client application running outside of of the docker
containers will use `localhost:7051`. There is a mapping of the host name to
'localhost' but there is no mapping of the port address.
```
peer0.org1.example.com:
  container_name: peer0.org1.example.com
  image: hyperledger/fabric-peer
  environment:
	- CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
	- CORE_PEER_ID=peer0.org1.example.com
	- CORE_PEER_ADDRESS=peer0.org1.example.com:7051
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
	- 7051:7051
  volumes:
	  - /var/run/:/host/var/run/
	  - ./channel/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/:/etc/hyperledger/msp/peer
  depends_on:
	- orderer.example.com
```

### using chaincode to chaincode calls and collections
The peer's discovery service will required information
on the channel, chaincodes, and collections that are involved in the
smart contract to develop a valid endorsement plan.
The contract's channel name and chaincode name will be automatically sent to
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
The discovery interests will be used as is, therefore the contract's chaincode name
should be included along with any collections.
The following examples show how to setup the interests JSON object to
provide to the contract instance when
a chaincode to chaincode call over collections is required.


```
// use the following when the smart contract's chaincode will be
// calling another chaincode
const interest_chaincodes = [
	{name: 'mychaincode1'},
	{name: 'mychaincode2'}
];

// use the following when the smart contract's chaincode is in a
// collection
const interest_chaincode_collection = [
	{
		name: 'mychaincode1',
		collection_names: ['mycollection1']
	}
];

// use the following when the smart contract's chaincode in multiple
// collections and is will be calling another chaincode that is in
// multiple collections
const interest_chaincodes_collections = [
	{
		name: 'mychaincode1',
		collection_names: ['mycollection1', 'mycollection2']
	},
	{
		name: 'mychaincode2',
		collection_names: ['mycollection1', 'mycollection2']
	}
];

const contract = network.getContract('mychaincode1');
contract.setDiscoveryInterests(interest_chaincodes);
```


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
