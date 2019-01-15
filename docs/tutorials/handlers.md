
This tutorial illustrates the use of the handlers by the Hyperledger Fabric Node.js Client as of 1.3.

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
The fabric-client provides the ability for custom code that will handle the
endorsement process and the submitting of endorsements to the orderer.
There are two plug points defined, one on the {@link Channel#sendTransactionProposal}
and one on the {@link Channel#sendTransaction}. The fabric-client will pass
control to the handler to complete the processing. The custom code may
decide to retry, try another end point, or use discovery to complete the
task.

see {@tutorial discovery} on how the default handlers are
used with discovery.

#### Modified API's that will use handlers
* `channel.initialize()` - This method has been enhanced to instantiate
instances of the handlers for use by the channel. The method will get the
paths from the system configuration settings to create and initialize them.
* `channel.sendTransactionProposal()` - This method has been enhanced to use
an `endorsement-handler` if one has been instantiated and initialized.
* `channel.sendTransaction()` - This method has been enhanced to use
a `commit-handler` if one has been instantiated and initialized.



#### New configuration settings
* `endorsement-handler` - string - The path to the endorsement handler. Allows for a
custom handler to be used. This handler is used in the
{@linkcode Channel#sendTransactionProposal sendTransactionProposal()}
method to determine the target peers and how to send the proposal.
(default 'fabric-client/lib/impl/DiscoveryEndorsementHandler.js')
* `commit-handler` - string - The path to the commit handler. Allows for
a custom handler to be used. This handler is used in the
{@linkcode Channel#sendTransaction sendTransaction()} method
to determine the orderers and how to send the transaction to be committed.
(default 'fabric-client/lib/impl/BasicCommitHandler.js')

### new Endorsement Handler
The sending of a proposal to be endorsed may be done using custom code. The
fabric-client will use by default the file called `DiscoveryEndorsementHandler`.
A different endorsement handler may be used by changing the configuration setting
"endorsement-handler" with the `setConfigSetting()` or placing a new line
in configuration JSON file that application has applied to the fabric-client
configuration. This will instantiate a handler
located at the path provide in the attribute for all channels initialized
after the call.
The default handler was designed to be used with discovery to provided automatic
selection of peers and fail over. When used without discovery the handler will
only send to the peers as defined in the targets parameter without fail over.
The handler may also be changed using the `endorsementHandler` attribute on the
`channel.initialize()` request call parameter. This will instantiate a handler
located at the path provide in the attribute just for this channel.
```
// set value in memory
Client.setConfigSetting('endorsement-handler', '/path/to/the/handler.js');
--or--
// the path to an additional config file
Client.addConfigFile('/path/to/config.json');
// the json file contains the following line
// "endorsement-handler": "/path/to/the/handler.js"
--or--
const request = {
	...
	endorsementHandler: "/path/to/the/handler.js",
	...
}
// initialize must be run to use handlers.
channel.initialize(request);
```
A endorsement handler must implement the `api.EndorsementHandler`. When the
channel is initialized, the channel will read the path setting and create an
instance of the handler for use by the new channel instance.

### new `CommitHandler`
The sending of the endorsements to be committed may be done using custom code.
The fabric-client will use by default the file called `BasicCommitHandler`.
The commit handler may be changed by changing the configuration setting
"commit-handler" by doing a `setConfigSetting()` or placing a new line
in configuration JSON file that application has applied to the fabric-client
configuration.
The default handler was designed to be used with discovery to provided automatic
selection of orderers and fail over. When used without discovery the handler will
still provide fail over to all orderers assigned to the channel, sending to
each one in orderer until an orderer response successfully to the transaction
submission. 
The handler may also be changed using the `commitHandler` attribute on the
`channel.initialize()` request call parameter. This will instantiate a handler
located at the path provide in the attribute just for this channel.
```
// set the config value in memory
Client.setConfigSetting('commit-handler', '/path/to/the/handler.js');
--or--
// path of an additional config file
Client.addConfigFile('/path/to/config.json');
// the json file contains the following line
// "commit-handler": "/path/to/the/handler.js"
--or--
const request = {
	...
	commitHandler: "/path/to/the/handler.js",
	...
}
// initialize must be run to use handlers.
channel.initialize(request);
```
A commit handler must implement the `api.CommitHandler`. When the
channel is initialized, the channel will read the path setting and create an
instance of the handler for use by the new channel instance.

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
