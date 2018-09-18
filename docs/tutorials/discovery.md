
This tutorial illustrates the use of the service discovery by the Hyperledger Fabric Node.js Client as of 1.2.

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* the configuration of a channel in Hyperledger Fabric and the internal
process of creating and updating see
[Hyperledger Fabric channel configuration](http://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)
* [Service Discovery](https://hyperledger-fabric.readthedocs.io/en/latest/discovery-overview.html)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `promise` and `async await`.

### Overview
The service discovery provided by the Hyperledger Fabric helps an application to
understand the current view of the network. The service discovery also has insight
into the endorsement policy of chaincodes and is able to provide various list of
peers that are currently active on the network that could be used to endorse a
proposal.
To use the service the application will have to connect with just one peer.

#### Modified API's that will use the service discovery
* `channel.initialize()` - This method has been enhanced by adding an option to
query a peer using the new service discovery to initialize the channel object.
* `channel.sendTransactionProposal()` - This method has been enhanced to use the
discovered peers to send the endorsement proposal.
* `channel.sendTransaction()` - This method has been enhanced to use the discovered
orderers to send the signed endorsements.

#### New API's that will use service discovery
* `channel.refresh()` - The channel will be refreshed with new service discovery
results, add new peers, orderers, and MSPs. The call will use the service discovery
settings as provided on the `channel.initialize()` call.
* `channel.getDiscoveryResults()` - The channel will cache the results of the last query
made to the service discovery and make the results available. The call will use
the `discovery-cache-life` setting to determine if the results should be refreshed.
if the results need to be refreshed, the `channel.refresh()` will be called
internally to fetch new service discovery results. The call is used by the
`DiscoveryEndorsementHandler` as it starts to determine the target peers.
* `client.queryPeers()` - A client object will be able to query a target peer
using the discovery service to provide a list of peer endpoints and associated
organizations active on the network at the time of the query. see {@link Client#queryPeers}


#### New configuration settings
* `initialize-with-discovery` - boolean - When the applications calls for the
channel to be initialized, service discovery will be used. (default false)
* `discovery-cache-life` - integer (time in milliseconds) - The amount of time the
service discovery results are considered valid. (default 300000 - 5 minutes)
* `discovery-protocol` - string - The protocol to use when building URL's for the
discovered endpoints. The Discover Service only provides host:port. (default 'grpcs').
* `endorsement-handler` - string - The path to the endorsement handler. Allows for a
custom handler to be used. This handler is used in the `sendTransactionProposal`
method to determine the target peers and how to send the proposal.
(default 'fabric-client/lib/impl/DiscoveryEndorsementHandler.js')
* `commit-handler` - string - The path to the commit handler. Allows for
a custom handler to be used. This handler is used in the `sendTransaction` method
to determine the orderers and how to send the transaction to be committed.
(default 'fabric-client/lib/impl/BasicCommitHandler.js')

### new `EndorsementHandler`
The sending of a proposal to be endorsed may be done using a custom code. The
fabric-client will use by default the file called `DiscoveryEndorsementHandler`.
The endorsement handler may be changed by changing the configuration setting
"endorsement-handler" by doing a `setConfigSetting()` or placing a new line
in configuration JSON file that application has applied to the fabric-client
configuration.
```
Client.setConfigSetting('endorsement-handler', '/path/to/the/handler.js');
--or--
Client.addConfigFile('/path/to/config.json');
// the json file contains the following line
// "endorsement-handler": "/path/to/the/handler.js"
```
A endorsement handler must implement the `api.EndorsementHandler`. When the
channel is instantiated, the channel will read the path setting and create an
instance of the handler for use by the new channel instance.



#### How the `DiscoveryEndorsementHandler` works
The `sendTransactionProposal` will use the peers included in the "targets" to
endorse the proposal. If there is no "targets" parameter the endorsement request
will be handled by the endorsement handler.
The default handler that comes with the fabric-client is designed to use the
results from the fabric discovery service.
The discovery service results will be based on the chaincode of the endorsement
or based on an endorsement hint included in the endorsement request. The hint
may include one or more chaincodes and each chaincode may include one or more
associated collection names.
If there are no service discover results, the handler will send to peers that have been
assigned to the channel with the `endorsingPeer` role (a peer that has been assigned

When the handler processes the discovery results it
assumes that all peers referenced have a
a peer object created and assigned to the channel object.
The service discover handler takes optional parameters that allow the user to specify
peers to be preferred and to be ignored.
The discovery results will include
groups of peers and layouts that specify how many peers from each group it will take
to satisfy the endorsement policy of the proposal chaincode.
The handler will first sort each group of peers, moving
peers on the preferred list to the top, moving peers with a higher ledger block
height up, and removing any peers that need to be ignored. The handler
will then select the first layout and build a list of outbound requests.
The handler looks at each group called out in the layout and selects, starting
the top of sorted group list, the number of peers called out in the layout.
The handler then sends all the request out at once. If any of the request fail
the handler will select another peer from the group list. If the enough successful
endorsements are returned and the layout is satisfied, the handler returns
the results. If there are not enough successful endorsements the handler will
select the next layout and try again or return the results of last attempt.


### new `CommitHandler`
The sending of the endorsements to be committed may be done using custom code.
The fabric-client will use by default the file called `BasicCommitHandler`.
The commit handler may be changed by changing the configuration setting
"commit-handler" by doing a `setConfigSetting()` or placing a new line
in configuration JSON file that application has applied to the fabric-client
configuration.
```
Client.setConfigSetting('commit-handler', '/path/to/the/handler.js');
--or--
Client.addConfigFile('/path/to/config.json');
// the json file contains the following line
// "commit-handler": "/path/to/the/handler.js"
```
A commit handler must implement the `api.CommmitHandler`. When the
channel is instantiated, the channel will read the path setting and create an
instance of the handler for use by the new channel instance.

#### How the `BasicCommitHandler` works
The default handler that comes with the fabric-client will send to one orderer at
a time until it receives a successful submission of the transaction. Sending
a transaction (a set of endorsements) to an orderer does not mean that the transaction
will be committed, it means that the request was built properly and that the
sender has the authority to send the request. The response from the orderer
will indicate that the orderer has accepted the request. The `sendTransaction`
has an optional parameter `orderer` that indicates the orderer to send the
transaction. The handler will use the orderer as specified with the `orderer`
parameter and send to any other orderers. If no orderer is specified the handler
will get the list of orderers assigned to the channel. These orderers may have
been assigned manually to the channel with a `channel.addOrderer()` call or
automatically when using the service discovery.

### To Initialize


By default the fabric-client will not use the service discovery. To enable the
use of the service, set the config setting to true or use the discover parameter
on the `initialize()` call.
```
Client.setConfigSetting('initialize-with-discovery', true);
--or--
Client.addConfigFile('/path/to/config.json');
// the json file contains the following line
//"initialize-with-discovery": true

//--or--

await channel.initialize({discover:true});
```
To use the service discovery on the `initialize()`, a channel must have at
least one peer assigned with the `discovery` role or a target must be provided on
the call. Peers may be assigned automatically by loading a connection profile
or they may have been added manually with the `channel.addPeer()`.
```
await channel.initialize({
	discover: true,
	target: peer
});

//--or--

await channel.initialize({
	discover: true,
	target: 'peer2.org2.example.com' //peer defined in the connection profile
});

//--or--

// no target specified, using the first peer with the discover role
// peer was added to the channel either by the 'addPeer' or when using
// a connection profile
await channel.initialize({
	discover: true
});
```

The return results of initialization with service discover will be the MSP configurations,
the peers, the orderers, and the endorsing plans for all chaincodes on the
channel in JSON format. The results are stored and cached internally and the caller
does not have to do anything with the results, they are provided only for reference.

The initialize call also allows for changing the endorsement handler by specifying
a path to a custom endorsement handler. The handler may be changed independently
of using the service discovery. The default endorsement handler however does use
discover service results to determine the endorsing peers.

```
await channel.initialize({
	endorsementHandler: '/path/to/my/handler.js'
});
```

When the fabric network is running in a docker-compose and the node.js application
is running outside of the docker containers, it will be necessary to modify the
addresses returned from the service discovery. The service discovery sees the
addresses of the peers and orderers as host names and ports, however the node.js
application running outside of docker will only know the endpoints as `localhost`
and port. In the docker-compose file, notice how Docker is mapping the port addresses,
these must be same when using service discovery. Using `- 7061:7051` will not
work as the fabric-client does not have visibility into the docker-compose file.

Notice in the following definition of a peer from a docker-compose file.
The port number is the same and has been defined along with the
host name `peer0.org1.example.com:7051` for the peer and gossip settings.
The node.js fabric-client application running outside of of the docker
containers will use `localhost:7051`.
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
	- CORE_LOGGING_LEVEL=debug
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

The `channel.initialize()` call as new parameter to indicate that the hostname
mapping to localhost should be done. Use the `asLocalhost` with true or false,
the default is false.
```
await channel.initialize({discover:true, asLocalhost:true})
```

##### Using peers added manually to the channel:
Only one peer will now be required to be added to the channel when the applications
programmatically  adds the peers and orderers to build a channel instance.
The peer must have the role `discover`. As with all roles, if the role
is not defined and set to false, the peer will have that role on the channel by
default.

```
const channel = client.newChannel('mychannel');
const peer = client.newPeer(....);
channel.addPeer(peer);
await channel.initialize({discover:true});
```
When the channel is initialized using service discover and peers and orderers are added
to the channel, a peer with the address that was used for service discover
will likely be on the list of discovered peers. A peer with the address used for
service discover will not be added again to the channel as a peer with that address
has already been assigned to the channel.

The name a peer will be known by may be set by using the `name` setting when
creating the peer.
```
const peer = client.newPeer(url, {name: 'peer0', ...});
```

The default name of a peer will be the host name and port if the name parameter
is not provided or for peers added by service discovery.
```
peer0.org1.example.com:7051
```

##### Using peers not added to the channel:
To use the service discovery a starting point is required. The application
may define a peer and pass it on the initialize call. The peer does not
have to be added to the channel instance.

```
const channel = client.newChannel('mychannel');
const peer = client.newPeer(....);
await channel.initialize({discover:true, target:peer});
```
When the channel is initialized using service discover and peers and orderers are added
to the channel, a peer with the address that was used for service discover
will likely be on the list of discovered peers. A peer instance with the address
used for service discover will be added to the channel with the same address that the
peer instance used for service discover.

##### Using connection profile:
When using a connection profile, all the peers and orderers on the network will no
longer need to be provided. Just one peer will be required and assigned to the
channel. The peer must have the role `discover`. As with all roles, if the role
is not defined and set to false, the peer will have that role on the channel by
default.

The following example shows a peer that is going to be used primarily for service discover.

```
channels:
  mychannel:
    peers:
      peer1.org2.example.com:
        endorsingPeer: false
        chaincodeQuery: false
        ledgerQuery: true
        eventSource: false
        discover: true
    peer2.org2.example.com:
        endorsingPeer: true
        chaincodeQuery: true
        ledgerQuery: true
        eventSource: false
        discover: false

peers:
  peer1.org2.example.com:
    url: grpcs://localhost:8051
    grpcOptions:
      ssl-target-name-override: peer1.org2.example.com
    tlsCACerts:
      path: test/fixtures/channel/c...
  peer2.org2.example.com:
    url: grpcs://localhost:8052
    grpcOptions:
      ssl-target-name-override: peer2.org2.example.com
    tlsCACerts:
      path: test/fixtures/channel/c...
```
When a channel is created using the `client.getChannel()` after the client
instance has loaded a connection profile, the fabric-client will create peers
and assign them to the channel. Peers with the the `discover` role will be used
when the `channel.initialize()` is called and no peer is passed as a target.

```
const client = Client.loadFromConfig(...);
const channel = client.getChannel('mychannel');
await channel.initialize({discover:true, asLocalhost:true};
```
If the initialize fails because the peer with the `discover` role is not online,
the application may select another peer.
```
await channel.initialize({discover:true, target:'peer2.org2.example.com'});
```
When the application passes a peer name or a peer instance to the initialize call,
that peer will be used and the `discover` role will not be checked.

The name a peer will be known by is the name used in the yaml file.
```
peer1.org2.example.com:port
```
The name of a peer will be the host name and port for peers added by the
service discovery.
```
peer0.org1.example.com:7051
```
### To Endorse
As discussed above, the `channel.sendTransactionProposal()` will now use a pluggable
handler. The fabric-client will come with a handler that will use service discover.
By default the `endorsement-handler` configuration setting will point to the
`DiscoveryEndorsementHandler`.  If the channel has been initialized using the
service discovery and there are no targets define on the `sendTransactionProposal`
call, the handler will use the service discover results based on the chaincode
of the proposal request to determine the target peers
to perform the endorsements.
```
const tx_id = client.newTransactionID();
const request = {
	chaincodeId : 'example',
	fcn: 'move',
	args: ['a', 'b','100'],
	txId: tx_id
};
await channel.sendTransactionProposal(request);
```

If the endorsement will require one or more chaincode to chaincode calls and/or
be over a collection or two, then the endorsement proposal request must include the
parameter "endorsement_hint". This will assist the discovery service in putting
together an endorsement plan based on all the endorsement policies of chaincodes
and collections involved and the active peers on the network.
The following example shows a chaincode to chaincode call over collections.
Notice how the chaincode that starts the endorsement must also still be included
as the "chaincodeId" of the endorsement request.

```
const hint = { chaincodes: [
	{
		name: "my_chaincode1",
		collection_names: ["my_collection1", "my_collection2"]
	},
	{
		name: "my_chaincode2",
		collection_names: ["my_collection1", "my_collection2"]
	}
]};

const tx_id = client.newTransactionID();
const request = {
	chaincodeId : 'my_chaincode1',
	fcn: 'move',
	args: ['a', 'b','100'],
	txId: tx_id,
	endorsement_hint: hint
};
await channel.sendTransactionProposal(request);
```

The application is able to have specific peers chosen before other peers or
to be not chosen at all for endorsements. The application may add the following
optional settings to the request object.
- `preferred`: An array of strings that represent the names of peers that should
be given priority by the endorsement. This list only applies to endorsements
using the service discovery.
- `ignored`: An array of strings that represent the names of peers that should be
ignored by the endorsement. This list only applies to endorsements using the
service discovery.

```
const request = {
	chaincodeId : 'example',
	fcn: 'move',
	args: ['a', 'b','100'],
	txId: tx_id,
	preferred: ['peer0', 'peer1.org1.exmaple.com:8051'],
	ignored: ['peer1', 'peer2.org2.example.com:8054']
}
```

### To Commit
As discussed above, the `channel.sendTransaction()` will now use a pluggable
handler. The fabric-client will come with a handler that will use all orderers
added to the channel. By default the `commit-handler` configuration setting
will point to the `BasicCommitHandler`. This handler will send the transaction
to each orderer, one at a time, that has been assigned to the channel until it
gets a `SUCCESS` response or until the list is exhausted. The orderers may been
added manually, due to a service discover initialization or combination of the two.
If an orderer is specified on the call, only that orderer will be used.


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
