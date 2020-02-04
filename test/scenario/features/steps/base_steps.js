/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Long = require('long');
const {format} = require('util');
const testUtil = require('../lib/utils');
const {Client, User} = require('fabric-common');

function assertNoErrors(endorsementResults) {
	if (endorsementResults.errors && endorsementResults.errors.length > 0) {
		for (const error of endorsementResults.errors) {
			testUtil.logMsg(`Failed to get successful response from peer : ${error.message}`);
		}
		throw Error('failed endorsement');
	}
}

module.exports = function () {
	this.Then(/^endorse chaincode (.+?) channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, channel_name) => {
			const step = 'NodeSDK-Base Endorsement';

			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			// building a user object will be external to the new NodeSDK-Base
			const user = getUser();

			// This is like the old Client object in that it will be the starting point for
			// building the client objects needed by the application.  The result client
			// instance will be used to create channels and store the client side connection
			// information like the GRPC settings and the client side Mutual TLS cert and key.
			const client = Client.newClient('myclient');
			const tlsEnrollment = await getTLS_enrollment(user);
			client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
			// The channel object will be used to represent the peers and orderers
			// and channel event hubs, the fabric network of the channel. Will be used
			// to build any channel related protos (channel header). Will be the focal
			// point for endorsements and queries on the channel. The channel object
			// must be built by the client so that any peer or orderer object created
			// by the discovery action on the channel will be able to get the connection
			// information.
			const channel = client.newChannel(channel_name);

			// The peers and orderers will be built by the client so that common
			// connection information will come from the client object, like the mutual TLS cert/key
			const peer1 = client.newEndorser('peer1');
			const peer2 = client.newEndorser('peer2');
			const orderer = client.newCommitter('orderer');
			const eventer = client.newEventer('peer1-events');

			try {
				// New object for NodeSDK-Base, "IdentityContext", this object
				// combines the old "TransactionID" and the Clients "UserContext"
				// into a single transaction based object needed for giving the
				// endorsement transaction an unique transaction ID, and nonce,
				// and also the user identity required when building the outbound
				// request for the fabric network
				// The user identity used must also be a signing identity unless
				// the signing is being done external to the NodeSDK-Base.
				const idx = client.newIdentityContext(user);

				// unique connection information will be used to build an endpoint
				// used on connect()
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});

				// new call with NodeSDK-Base, the connect will take the unique
				// endpoint settings, like URL and TLS cert of endpoint.
				// The connect call will setup a connection to the fabric service.
				await peer1.connect(peer1_endpoint);
				if (await peer1.checkConnection()) {
					testUtil.logMsg('Peer checkConnection test successfully');
				} else {
					testUtil.logAndThrow('Peer checkConnection test failed');
				}

				const peer2_endpoint = client.newEndpoint({
					url: 'grpcs://localhost:8051',
					pem: getPeer2_pem(),
					'ssl-target-name-override': 'peer0.org2.example.com'
				});
				await peer2.connect(peer2_endpoint);

				// This is a new object to NodeSDK-Base. This "Proposal" object will
				// centralize the endorsement operation, including the endorsement results.
				// Proposals must be built from channel and chaincode name
				const endorsement = channel.newEndorsement(chaincode_name);

				// ----- E N D O R S E -----
				// endorsement will have the values needed by the chaincode
				// to perform the endorsement (invoke)
				const build_endorsement_request = {
					args: ['createCar', '2000', 'GMC', 'Savana', 'grey', 'Jones']
				};

				// The endorsement object has the building of the request, the signing
				// and the sending steps broken out into separate API's that must
				// be called individually.
				endorsement.build(idx, build_endorsement_request);
				endorsement.sign(idx);

				// Now that the endorsement is all built and signed, it is ready
				// to be sent to the endorsing peers.
				// First decide on the peers and a request timeout
				const  endorse_request = {
					targets: [peer1, peer2],
					requestTimeout: 300000 // optional
				};

				// New API, the "send" method on the endorsement object
				// will send the signed endorsement to the requested peers.
				const endorse_results = await endorsement.send(endorse_request);
				assertNoErrors(endorse_results);

				// ----- T R A N S A C T I O N   E V E N T -----
				try {
					// same peer endpoint different peer service
					await eventer.connect(peer1_endpoint);
					if (await eventer.checkConnection()) {
						testUtil.logMsg('Eventer checkConnection test successfully');
					} else {
						testUtil.logAndThrow('Eventer checkConnection test failed');
					}
				} catch (error) {
					testUtil.logError(`Failed to connect to channel event hub ${eventer.name}`);
					testUtil.logError(`Failed to connect ${error.stack}`);
					throw error;
				}

				// The event service is channel based
				const event_service = channel.newEventService('myhub');
				event_service.build(idx);
				event_service.sign(idx);
				const  event_request = {
					targets: [eventer],
					requestTimeout: 3000 // optional
				};
				await event_service.send(event_request);


				const event_listener = new Promise((resolve, reject) => {
					const handle = setTimeout(() => {
						reject(new Error('Test application has timed out waiting for tx event'));
						// may want to close the event hub or unregister the tx event listener
					}, 10000);

					event_service.registerTransactionListener(
						endorsement.getTransactionId(),
						(error, event) => {
							clearTimeout(handle);
							if (error) {
								testUtil.logError(`Failed to receive transaction event for ${endorsement.getTransactionId()}`);
								reject(error);
								return;
							}
							testUtil.logMsg(`Successfully received the transaction event for ${event.transactionId} with status of ${event.status} in block number ${event.blockNumber}`);
							resolve('Commit success');
						}
					);
				});

				// ----- C O M M I T -----
				// create an endpoint with all the connection information
				const order_endpoint = client.newEndpoint({
					url: 'grpcs://localhost:7050',
					pem: getOrderer_pem(),
					'ssl-target-name-override': 'orderer.example.com'
				});
				testUtil.logMsg(JSON.stringify(order_endpoint.options));
				// new API to have the orderer object connect with the
				// fabric endpoint that it represents.
				await orderer.connect(order_endpoint);
				if (await orderer.checkConnection()) {
					testUtil.logMsg('Orderer checkConnection test successfully');
				} else {
					testUtil.logAndThrow('Orderer checkConnection test failed');
				}

				const commit = endorsement.newCommit(chaincode_name);
				// The build returns the bytes that may be signed externally
				// instead of signing internally as shown here.
				commit.build(idx);
				// When signing internally the idx must have a user with a signing identity.
				commit.sign(idx);

				const commit_request = {
					targets: [orderer], // could also use the orderer names
					requestTimeout: 3000
				};

				// New API to send the endorsed proposal to the orderer to be committed.
				// Notice that we have not used an "await", therefore we have a promise
				// that will be executed later when we also have the event promise
				const commit_submission =  commit.send(commit_request);

				// ----- start the event listener and then submit the commit
				// results will be returned with when both promises complete
				const commit_results = await Promise.all([event_listener, commit_submission]);
				testUtil.logMsg(format('%s - event results %s', step, commit_results[0]));
				testUtil.logMsg(format('%s - commit results %s', step, commit_results[1].status));

				// ----- Q U E R Y -----
				const query = channel.newQuery(chaincode_name);
				// proposal will have the values needed by the chaincode
				// to perform the endorsement (query)
				const build_query_request = {
					args: ['queryAllCars']
				};

				// The proposal object has the building of the request, the signing
				// and the sending steps broken out into separate API's that must
				// be called individually.
				query.build(idx, build_query_request);
				query.sign(idx);

				// Now that the proposal is all built and signed, it is ready
				// to be sent to the endorsing peers.
				// First decide on the peers and a request timeout
				const  query_request = {
					targets: [peer1, peer2],
					requestTimeout: 3000
				};

				// New API, the "send" method on the proposal object
				// will send the signed proposal to the requested peers.
				const query_results = await query.send(query_request);
				assertNoErrors(query_request);
				for (const result of query_results.queryResults) {
					testUtil.logMsg(` *** query results:: ${result.toString('utf8')}`);
				}

			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw error;
			} finally {
				peer1.disconnect();
				peer2.disconnect();
				orderer.disconnect();
				eventer.disconnect();
				testUtil.logMsg(format('\n\n%s - disconnected all endpoints\n', step));
			}
			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		});

	this.Then(/^discovery on channel (.+?) chaincode (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (channel_name, chaincode_name) => {
			const step = 'NodeSDK-Base Discovery';
			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			try {
				const user = getUser();
				const client = new Client('myclient');
				const channel = client.newChannel(channel_name);
				const tlsEnrollment = await getTLS_enrollment(user);
				client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
				const idx = client.newIdentityContext(user);
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});

				// ----- D I S C O V E R Y -----
				const discovery = channel.newDiscoveryService('mydiscovery');
				const discoverer = client.newDiscoverer('peer1-discovery');

				try {
					testUtil.logMsg(format('\n\n%s TEST 1 - config - START\n', step));

					await discoverer.connect(peer1_endpoint); // use the same endpoint
					// basic test to get a config(msps and orderers) and some local peers
					// no endorsement provided, so no endorsement plan will be returned
					discovery.build(idx);
					discovery.sign(idx);
					const discovery_request = {
						requestTimeout: 5000,
						asLocalhost: true,
						targets: [discoverer]
					};
					const results = await discovery.send(discovery_request);
					testUtil.logMsg('\nDiscovery test 1 results :: ' + JSON.stringify(results));
					// make sure we can run the same request many times
					const results2 = await discovery.send(discovery_request);
					testUtil.logMsg('\n\nDiscovery test 1 results again :: ' + JSON.stringify(results2));
					testUtil.logMsg(format('\n\n%s TEST 1 - config - END\n', step));
				} catch (error) {
					testUtil.logMsg(format('%s - discovery error: %s', step, error));
				} finally {
					discovery.close();
				}

				try {
					testUtil.logMsg(format('\n\n%s TEST 2 - endorsement plan - START\n', step));
					const endorsement = channel.newEndorsement(chaincode_name);
					// make sure we can connect again
					await discoverer.connect(peer1_endpoint); // use the same endpoint
					if (await discoverer.checkConnection()) {
						testUtil.logMsg('Discovery checkConnection test successfully');
					} else {
						testUtil.logAndThrow('Discovery checkConnection test failed');
					}
					// pass in an endorsement, this will provide the chaincode name
					// as an "interest" for the discovery request. The peer's discovery
					// service will then be able to build an endorsement plan.
					discovery.build(idx, {endorsement: endorsement});
					discovery.sign(idx);
					const discovery_request = {
						requestTimeout: 5000,
						asLocalhost: true,
						targets: [discoverer]
					};
					const results = await discovery.send(discovery_request);
					testUtil.logMsg('\nDiscovery test 2 results :: ' + JSON.stringify(results));

					// check the peers discovered
					let peers = channel.getEndorsers(); // gets all peers
					for (const peer of peers) {
						if (await peer.checkConnection()) {
							testUtil.logMsg(`Peer ${peer.name} is connected`);
						} else {
							throw Error(`Peer ${peer.name} is not connected`);
						}
					}

					// check the peers discovered for mspid
					peers = channel.getEndorsers('Org1MSP'); // gets all peers
					for (const peer of peers) {
						if (await peer.checkConnection()) {
							testUtil.logMsg(`Peer in MSPID ${peer.name} is connected`);
						} else {
							throw Error(`Peer in MSPID ${peer.name} is not connected`);
						}
					}

					// check the orderers discovered
					let orderers = channel.getCommitters(); // gets all peers
					if (await orderers[0].checkConnection()) {
						testUtil.logMsg(`Orderer ${orderers[0].name} is connected`);
					} else {
						throw Error(`Orderer ${orderers[0].name} is not connected`);
					}

					// check the orderers discovered for mspid
					orderers = channel.getCommitters('OrdererMSP'); // gets all peers
					if (await orderers[0].checkConnection()) {
						testUtil.logMsg(`Orderer ${orderers[0].name} is connected`);
					} else {
						throw Error(`Orderer ${orderers[0].name} is not connected`);
					}
					testUtil.logMsg(format('\n\n%s TEST 2 - endorsement plan - END\n', step));
				} catch (error) {
					testUtil.logMsg(format('%s - discovery error: %s', step, error));
				} finally {
					discovery.close();
				}
			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw Error('Discovery FAILED');
			}
			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		}
	);

	this.Then(/^discovery endorse chaincode (.+?) channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, channel_name) => {
			const step = 'NodeSDK-Base Discovery Endorsement';
			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			try {
				const user = getUser();
				const client = new Client('myclient');
				const channel = client.newChannel(channel_name);
				const tlsEnrollment = await getTLS_enrollment(user);
				client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
				const idx = client.newIdentityContext(user);
				// application must know the discovery peer's connection information
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});

				const discovery = channel.newDiscoveryService('mydiscovery');
				const discoverer = client.newDiscoverer('peer1-discovery');
				const event_service = channel.newEventService('myevent_service');

				try {
					testUtil.logMsg('\n\nDISCOVERY Endorse TEST 1 -- START\n');
					// ----- D I S C O V E R Y -----
					await discoverer.connect(peer1_endpoint);
					// use the endorsement to build the discovery request
					const endorsement = channel.newEndorsement(chaincode_name);
					discovery.build(idx, {endorsement: endorsement});
					discovery.sign(idx);
					// discovery results will be based on the chaincode of the endorsement
					const discovery_results = await discovery.send({targets: [discoverer], asLocalhost: true});
					testUtil.logMsg('\nDiscovery test 1 results :: ' + JSON.stringify(discovery_results));

					// ----- E N D O R S E -----
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
					assertNoErrors(endorse_results);
					for (const response of endorse_results.responses) {
						testUtil.logMsg(`Successfully got an endorsement status: ${response.response.status}`);
					}

					// ------ E V E N T -------
					const promises = [];
					const eventers = [];
					const found_peers = channel.getEndorsers('Org1MSP');
					for (const found_peer of found_peers) {
						const eventer = client.newEventer(found_peer.name + '-eventer');
						await eventer.connect(found_peer.endpoint);
						eventers.push(eventer);
						testUtil.logMsg(`Successfully created an event hub based on a discovered peer: ${eventer.name}`);
					}

					// default event hub
					event_service.build(idx);
					event_service.sign(idx);
					await event_service.send({targets: eventers});

					const event_listener = new Promise((resolve, reject) => {
						const handle = setTimeout(() => {
							reject(new Error('Test application has timed out waiting for tx event'));
							// may want to close the event hub or unregister the tx event listener
						}, 20000);

						event_service.registerTransactionListener(
							endorsement.getTransactionId(),
							(error, event) => {
								clearTimeout(handle);
								if (error) {
									reject(error);
									return;
								}
								testUtil.logMsg(`Successfully received the transaction event for ${event.transactionId} with status of ${event.status} in block number ${event.blockNumber}`);
								resolve(`Success ${event.transactionId}`);
							}
						);
					});
					promises.push(event_listener);

					// ------ C O M M I T ------
					const commit = channel.newCommit(chaincode_name);
					commit.build(idx, {endorsement: endorsement});
					commit.sign(idx);

					const commit_request = {
						handler: handler, // same handler used for endorsement
						requestTimeout: 5000
					};

					promises.push(commit.send(commit_request));

					// ----- Check results -----
					const commit_event_results =  await Promise.all(promises);
					if (commit_event_results instanceof Error) {
						testUtil.logError('Commit failed :: ' + commit_event_results.stack);
						throw commit_event_results;
					}
					const commit_submission =  commit_event_results.pop();
					if (commit_submission instanceof Error) {
						testUtil.logError('Commit submission failed ' + commit_submission.stack);
						throw commit_submission;
					} else if (commit_submission.status) {
						testUtil.logMsg('Commit submitted successfully ' + commit_submission.status);
					} else {
						throw Error('Commit submission failed - no status available');
					}

					for (const event_result of commit_event_results) {
						testUtil.logMsg('Transaction status ' + event_result);
					}

					const query = channel.newQuery(chaincode_name);
					// ----- Q U E R Y -----
					const build_query_request = {
						args: ['queryAllCars']
					};
					query.build(idx, build_query_request);
					query.sign(idx);

					const  query_request = {
						handler: handler,
						requestTimeout: 3000
					};

					const query_results = await query.send(query_request);
					assertNoErrors(query_results);
					for (const result of query_results.queryResults) {
						testUtil.logMsg(` *** query results:: ${result.toString('utf8')}`);
					}
					testUtil.logMsg('\n\nDISCOVERY Endorse TEST 1 --- END\n');
				} catch (error) {
					testUtil.logMsg(format('%s - discovery error: %s', step, error.stack));
				} finally {
					event_service.close();
					discovery.close();
					channel.close();
				}

			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw Error('Discovery Endorsement FAILED');
			}

			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		}
	);

	// Then events full block with replay on channel mychannel
	this.Then(/^events full block with replay on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (channel_name) => {
			const step = 'NodeSDK-Base full block events with replay';
			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			const user = getUser();
			const client = Client.newClient('myclient');
			const tlsEnrollment = await getTLS_enrollment(user);
			client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
			const channel = client.newChannel(channel_name);
			const eventer = client.newEventer('peer1-events');

			try {
				const idx = client.newIdentityContext(user);
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});
				try {
					await eventer.connect(peer1_endpoint);
				} catch (error) {
					testUtil.logError(`Failed to connect to channel event hub ${eventer.name}`);
					testUtil.logError(`Failed to connect ${error.stack}`);
					throw error;
				}

				const event_service = channel.newEventService('myhub');

				// TEST 1 - all good, get all requested blocks
				// eslint-disable-next-line no-async-promise-executor
				let receiveBlocks = new Promise(async (resolve, reject) => {
					const handle = setTimeout(() => {
						reject(new Error('Test application has timed out waiting for final block event'));
					}, 5000);

					// since we do want to not miss any events be sure to register
					// the block listener before starting the event service
					event_service.registerBlockListener(
						(error, event) => {
							if (error) {
								clearTimeout(handle);
								testUtil.logError(`Failed to receive block event for ${error.toString()}`);
								reject(error);
								return;
							}
							if (event.endBlockReceived) {
								clearTimeout(handle);
								testUtil.logMsg('Received end block event for');
								resolve('Success endBlock received');
								return;
							}
							if (event.blockNumber.lessThan(Long.fromValue(1)) || event.blockNumber.greaterThan(Long.fromValue(3))) {
								clearTimeout(handle);
								testUtil.logError(`Failed - Received block not within requested range ${event.blockNumber.toInt()}`);
								reject(new Error('Received unwanted block'));
							}
							testUtil.logMsg(`Successfully received block ${event.blockNumber}`);
						},
						{
							startBlock: 1,
							endBlock: 3
						}
					);

					// start the event service
					event_service.build(idx, {
						startBlock: 0,
						endBlock: 5
					});
					event_service.sign(idx);
					const  event_request = {
						targets: [eventer],
						requestTimeout: 3000 // optional
					};
					try {
						await event_service.send(event_request);
					} catch (error) {
						clearTimeout(handle);
						testUtil.logError(`Failed to start event service ${error.toString()}`);
						reject(error);
					}
				});

				try {
					const results = await receiveBlocks;
					testUtil.logMsg(format('%s - block event results %s', step, results));
				} catch (blockError) {
					testUtil.logError(`Failed get all the blocks :: ${blockError.toString()}`);
					throw blockError;
				}

				// shut down service action, will also disconnect the service endpoint
				event_service.close();
				try {
					await eventer.connect(peer1_endpoint);
				} catch (error) {
					testUtil.logError(`Failed to connect to channel event hub ${eventer.name}`);
					testUtil.logError(`Failed to connect ${error.stack}`);
					throw error;
				}

				// TEST 2 - get callback with error, due to endblock received
				// eslint-disable-next-line no-async-promise-executor
				receiveBlocks = new Promise(async (resolve, reject) => {
					const handle = setTimeout(() => {
						reject(new Error('Test application has timed out waiting for final block event'));
					}, 5000);

					// since we do want to not miss any events be sure to register
					// the block listener before starting the event service
					event_service.registerBlockListener(
						(error, event) => {
							if (error) {
								clearTimeout(handle);
								if (error.toString().includes('Shutdown due to end block number has been seen')) {
									testUtil.logMsg('Successfully received endblock error');
									resolve('Successfully received endBlock error');
								} else {
									testUtil.logError(`Failed - received ${error.toString()}`);
									reject(error);
								}
								return;
							}
							if (event.endBlockReceived) {
								clearTimeout(handle);
								testUtil.logError('Received end block event for');
								reject('Failed - endBlock received');
								return;
							}
							if (event.blockNumber.lessThan(Long.fromValue(1)) || event.blockNumber.greaterThan(Long.fromValue(3))) {
								clearTimeout(handle);
								testUtil.logError(`Failed - Received block not within requested range ${event.blockNumber.toInt()}`);
								reject(new Error('Received unwanted block'));
							}
							testUtil.logMsg(`Successfully received block ${event.blockNumber}`);
						},
						{
							startBlock: 1,
							endBlock: 3
						}
					);

					// start the event service
					event_service.build(idx, {
						startBlock: 0,
						endBlock: 2
					});
					event_service.sign(idx);
					const  event_request = {
						targets: [eventer],
						requestTimeout: 3000 // optional
					};
					try {
						await event_service.send(event_request);
					} catch (error) {
						clearTimeout(handle);
						testUtil.logError(`Failed to start event service ${error.toString()}`);
						reject(error);
					}
				});

				try {
					const results = await receiveBlocks;
					testUtil.logMsg(format('%s - block event results %s', step, results));
				} catch (blockError) {
					testUtil.logError(`Failed get all the blocks :: ${blockError.toString()}`);
					throw blockError;
				}
			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw error;
			} finally {
				eventer.disconnect();
				testUtil.logMsg(format('\n\n%s - disconnected all endpoints\n', step));
			}
			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		});

	// Then events chaincode event with chaincode fabcar01 on channel mychannel
	this.Then(/^events chaincode event with chaincode (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, channel_name) => {
			const step = 'NodeSDK-Base chaincode event';

			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			const user = getUser();
			const client = Client.newClient('myclient');
			const tlsEnrollment = await getTLS_enrollment(user);
			client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
			const channel = client.newChannel(channel_name);
			const peer1 = client.newEndorser('peer1');
			const peer2 = client.newEndorser('peer2');
			const orderer = client.newCommitter('orderer');
			const eventer = client.newEventer('peer1-events');

			try {
				const idx = client.newIdentityContext(user);
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});

				await peer1.connect(peer1_endpoint);
				if (await peer1.checkConnection()) {
					testUtil.logMsg('Peer checkConnection test successfully');
				} else {
					testUtil.logAndThrow('Peer checkConnection test failed');
				}

				const peer2_endpoint = client.newEndpoint({
					url: 'grpcs://localhost:8051',
					pem: getPeer2_pem(),
					'ssl-target-name-override': 'peer0.org2.example.com'
				});
				await peer2.connect(peer2_endpoint);

				const endorsement = channel.newEndorsement(chaincode_name);

				// ----- E N D O R S E -----
				const build_endorsement_request = {
					args: ['createCar', '2008', 'Ford', 'Focus', 'blue', 'Henry']
				};

				endorsement.build(idx, build_endorsement_request);
				endorsement.sign(idx);

				const  endorse_request = {
					targets: [peer1, peer2],
					requestTimeout: 30000 // optional
				};

				const endorse_results = await endorsement.send(endorse_request);
				assertNoErrors(endorse_results);

				// ----- C H A I N C O D E   E V E N T -----
				try {
					await eventer.connect(peer1_endpoint);
					if (await eventer.checkConnection()) {
						testUtil.logMsg('Eventer checkConnection test successfully');
					} else {
						testUtil.logAndThrow('Eventer checkConnection test failed');
					}
				} catch (error) {
					testUtil.logError(`Failed to connect to channel event hub ${eventer.name}`);
					testUtil.logError(`Failed to connect ${error.stack}`);
					throw error;
				}

				// The event service is channel based
				const event_service = channel.newEventService('myhub');
				event_service.build(idx);
				event_service.sign(idx);
				const  event_request = {
					targets: [eventer],
					requestTimeout: 3000 // optional
				};
				await event_service.send(event_request);

				const event_listener = new Promise((resolve, reject) => {
					const handle = setTimeout(() => {
						reject(new Error('Test application has timed out waiting for tx event'));
						// may want to close the event hub or unregister the tx event listener
					}, 10000);

					event_service.registerChaincodeListener(
						chaincode_name,
						'newcar',
						(error, event) => {
							clearTimeout(handle);
							if (error) {
								testUtil.logError(`Failed to receive transaction event for ${endorsement.getTransactionId()}`);
								reject(error);
								return;
							}
							// all chaincode events matches from this block
							// will be in an array for this listener
							if (event.chaincodeEvents) {
								for (const chaincodeEvent of event.chaincodeEvents) {
									testUtil.logMsg(
										'Successfully received the chaincode event for' +
										`${chaincodeEvent.transactionId} with status of ${chaincodeEvent.status}` +
										` in block number ${event.blockNumber}`
									);
								}
							}
							resolve('Chaincode event success');
						},
						{
							unregister: true
						}
					);
				});

				// ----- C O M M I T -----
				const order_endpoint = client.newEndpoint({
					url: 'grpcs://localhost:7050',
					pem: getOrderer_pem(),
					'ssl-target-name-override': 'orderer.example.com'
				});
				testUtil.logMsg(JSON.stringify(order_endpoint.options));
				await orderer.connect(order_endpoint);
				if (await orderer.checkConnection()) {
					testUtil.logMsg('Orderer checkConnection test successfully');
				} else {
					testUtil.logAndThrow('Orderer checkConnection test failed');
				}

				const commit = endorsement.newCommit(chaincode_name);
				commit.build(idx);
				commit.sign(idx);
				const commit_request = {
					targets: [orderer],
					requestTimeout: 3000
				};

				const commit_submission =  commit.send(commit_request);
				const commit_results = await Promise.all([event_listener, commit_submission]);
				testUtil.logMsg(format('%s - event results %s', step, commit_results[0]));
				testUtil.logMsg(format('%s - commit results %s', step, commit_results[1].status));

			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw error;
			} finally {
				peer1.disconnect();
				peer2.disconnect();
				orderer.disconnect();
				eventer.disconnect();
				testUtil.logMsg(format('\n\n%s - disconnected all endpoints\n', step));
			}
			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		});

	// Then endorse with transient on chaincode fabcar01 on channel mychannel
	this.Then(/^endorse with transient on chaincode (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, channel_name) => {
			const step = 'NodeSDK-Base transient';

			testUtil.logMsg(format('\n\n%s - STARTING\n', step));
			const user = getUser();
			const client = Client.newClient('myclient');
			const tlsEnrollment = await getTLS_enrollment(user);
			client.setTlsClientCertAndKey(tlsEnrollment.cert, tlsEnrollment.key);
			const channel = client.newChannel(channel_name);
			const peer1 = client.newEndorser('peer1');
			const peer2 = client.newEndorser('peer2');

			try {
				const idx = client.newIdentityContext(user);
				const peer1_endpoint =  client.newEndpoint({
					url: 'grpcs://localhost:7051',
					pem: getPeer1_pem(),
					'ssl-target-name-override': 'peer0.org1.example.com'
				});

				await peer1.connect(peer1_endpoint);
				if (await peer1.checkConnection()) {
					testUtil.logMsg('Peer checkConnection test successfully');
				} else {
					testUtil.logAndThrow('Peer checkConnection test failed');
				}

				const peer2_endpoint = client.newEndpoint({
					url: 'grpcs://localhost:8051',
					pem: getPeer2_pem(),
					'ssl-target-name-override': 'peer0.org2.example.com'
				});
				await peer2.connect(peer2_endpoint);

				const endorsement = channel.newEndorsement(chaincode_name);

				// ----- E N D O R S E -----
				const build_endorsement_request = {
					args: ['createCar', '2008', 'Chrysler', 'PT Curser', 'white', 'Sam'],
					transientMap: {test: Buffer.from('extra info')}
				};

				endorsement.build(idx, build_endorsement_request);
				endorsement.sign(idx);

				const  endorse_request = {
					targets: [peer1, peer2],
					requestTimeout: 30000 // optional
				};

				const endorse_results = await endorsement.send(endorse_request);
				assertNoErrors(endorse_results);
				testUtil.logMsg(format('\n\n%s - Successfully endorsed with transient data\n', step));
				for (const endorsement_result of endorse_results.responses) {
					const transient_return = endorsement_result.response.payload.toString('utf8');
					if (transient_return === '"extra info"') {
						testUtil.logMsg('Successfully returned transient data');
					} else {
						throw Error('Failed - Transient data was not handled correctly');
					}
				}

			} catch (error) {
				testUtil.logError('Test failed ' + step + ' with ::' + error.stack);
				throw error;
			} finally {
				peer1.disconnect();
				peer2.disconnect();
				testUtil.logMsg(format('\n\n%s - disconnected all endpoints\n', step));
			}
			testUtil.logMsg(format('\n\n%s - COMPLETE\n', step));
		});
};

function getPeer1_pem() {
	const data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp/tlscacerts/tlsca.org1.example.com-cert.pem'));
	const pem = Buffer.from(data).toString();
	return pem;
}

function getPeer2_pem() {
	const data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp/tlscacerts/tlsca.org2.example.com-cert.pem'));
	const pem = Buffer.from(data).toString();
	return pem;
}

function getOrderer_pem() {
	const data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem'));
	const pem = Buffer.from(data).toString();
	return pem;
}

function getUser() {
	let data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore/key.pem'));
	const keyPEM = Buffer.from(data).toString();
	data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem'));
	const certPEM = Buffer.from(data).toString();

	const user = User.createUser('admin', 'adminpw', 'Org1MSP', certPEM, keyPEM);
	return user;
}

async function getTLS_enrollment(user) {
	const data = fs.readFileSync(path.join(__dirname, '../../../fixtures/crypto-material/crypto-config/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem'));
	const pem = Buffer.from(data).toString();
	const tls_options = {
		trustedRoots: [pem],
		verify: false
	};

	const ca_service_impl = require('fabric-ca-client');
	const ca_service = new ca_service_impl({
		url: 'https://localhost:7054',
		tlsOptions: tls_options,
		caName: 'ca-org1',
		cryptoSuite: user.getCryptoSuite()
	});


	const request = {
		enrollmentID: user.getName(),
		enrollmentSecret: user.getEnrollmentSecret(),
		profile: 'tls'
	};
	const result = await ca_service.enroll(request);
	const enrollment = {
		key: result.key.toBytes(),
		cert: result.certificate
	};

	return enrollment;
}
