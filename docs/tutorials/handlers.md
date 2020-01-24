
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
The fabric-common provides the ability for custom code that will handle the
endorsement process and the submitting of endorsements to the orderer.
There are three plug points defined, the {@link Endorsement#send},
the {@link Query#send}, and the {@link Commit#send}.
The fabric-common will pass
control to the handler to complete the processing. The custom code may
decide to retry, try another end point, or use discovery to help
complete the task.

### Service Handler
fabric-common includes a handler called `DiscoveryHandler`.
The included handler was designed to be used with the Hyperledger Fabric's
discovery service. The discovery service will provide the peers and orderers
required for endorsing and committing transactions automatically.

A custom service handler should extend the {@link ServiceHandler} and be passed
to the `send` method of the service in the options object attribute `handler`.

The following shows how to get a discovery handler from the discover service
and then use that handler on the endorsement call.

```
	// connect to the peer with discover service
	await discoverer.connect(peer1_endpoint);
	// use the endorsement to build the discovery request
	const endorsement = channel.newEndorsement(chaincode_name);
	discovery.build(idx, {endorsement: endorsement});
	discovery.sign(idx);
	// discovery results will be based on the chaincode of the endorsement
	const discovery_results = await discovery.send({targets: [discoverer], asLocalhost: true});
	testUtil.logMsg('\nDiscovery test 1 results :: ' + JSON.stringify(discovery_results));

	// input to the build a proposal request
	const build_proposal_request = {
		args: ['createCar', '2000', 'GMC', 'Savana', 'grey', 'Jones']
	};

	endorsement.build(idx, build_proposal_request);
	endorsement.sign(idx);

	const handler = discovery.newHandler();

	// do not specify 'targets', use a handler instead
	const  endorse_request = {
		handler: handler,
		requestTimeout: 30000
	};

	const endorse_results = await endorsement.send(endorse_request);
```

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
