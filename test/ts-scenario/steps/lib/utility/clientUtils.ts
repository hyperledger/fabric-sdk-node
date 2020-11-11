/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import * as FabricCAServices from 'fabric-ca-client';
import {
	Channel, Client, Commit, Committer, Endorsement, Endorser,
	Endpoint, Eventer, EventService, Discoverer, DiscoveryService,
	IdentityContext, ProposalResponse, Query, User, DiscoveryHandler,
	StartRequestOptions, SendEventOptions
} from 'fabric-common';
import * as fs from 'fs';
import * as Long from 'long';
import {Constants} from '../../constants';
import * as BaseUtils from './baseUtils';
import {CommonConnectionProfileHelper} from './commonConnectionProfileHelper';
import {StateStore} from './stateStore';

const stateStore: StateStore = StateStore.getInstance();

function assertNoErrors(endorsementResults: ProposalResponse): void {
	if (endorsementResults.errors && endorsementResults.errors.length > 0) {
		for (const error of endorsementResults.errors) {
			BaseUtils.logMsg(`Failed to get endorsement with error: ${error.message} and proposal response:`, endorsementResults);
		}
		throw Error('failed endorsement');
	}
}

export async function createAdminClient(clientName: string, ccp: CommonConnectionProfileHelper, clientOrg: string): Promise<void> {

	// check if the client already exists
	const clientMap: Map<string, any> | undefined = stateStore.get(Constants.CLIENTS);

	if (clientMap && clientMap.has(clientName)) {
		BaseUtils.logMsg(`Client named ${clientName} already exists`);
	} else {
		BaseUtils.logMsg(`Creating client named ${clientName} for organization ${clientOrg}`);

		// Get a user
		const user: User = createAdminUserForOrg(ccp, clientOrg);

		// Form client with user
		const client: Client = Client.newClient(clientName);
		const enrollResponse: FabricCAServices.IEnrollResponse = await getTlsEnrollmentResponseForOrgUser(user, clientOrg, ccp);
		client.setTlsClientCertAndKey(enrollResponse.certificate, enrollResponse.key.toBytes());

		// persist client in state store for use later
		if (clientMap) {
			clientMap.set(clientName, {client, user, ccp, clientOrg});
		} else {
			const map: Map<string, any> = new Map<string, any>();
			map.set(clientName, {client, user, ccp, clientOrg});
			stateStore.set(Constants.CLIENTS, map);
		}
		BaseUtils.logMsg(`Created client named ${clientName} and persisted in state store`);
	}
}

export function createChannelWithClient(clientName: string, channelName: string): void {
	const clientObject: any = retrieveClientObject(clientName);
	// Does this client have a channel associated?
	if (clientObject.channels && clientObject.channels.has(channelName)) {
		BaseUtils.logMsg(`Client channel named ${channelName} already exists`);
	} else {
		// Build channel and append to client channels map
		const channel: Channel = (clientObject.client as Client).newChannel(channelName);

		if (clientObject.channels) {
			clientObject.channels.set(channelName, channel);
		} else {
			const channelMap: Map<string, Channel> = new Map();
			channelMap.set(channelName, channel);
			clientObject.channels = channelMap;
		}
		BaseUtils.logMsg(`Channel ${channelName} has been persisted with client ${clientName}`);
	}
}

export function retrieveClientObject(clientName: string): any {
	const clientMap: Map<string, any> | undefined = stateStore.get(Constants.CLIENTS);
	if (clientMap && clientMap.has(clientName)) {
		return clientMap.get(clientName);
	} else {
		const msg: string = `Required client named ${clientName} does not exist`;
		BaseUtils.logMsg(msg);
		throw new Error(msg);
	}
}

export async function buildChannelRequest(requestName: string, contractName: string, requestArgs: any, clientName: string, channelName: string, useDiscovery: boolean): Promise<void> {

	// Best have a client object ready and waiting
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const ccp: CommonConnectionProfileHelper = clientObject.ccp;
	const channel: Channel = clientObject.channels.get(channelName);

	// New object for NodeSDK-Base, "IdentityContext", this object
	// combines the old "TransactionID" and the Clients "UserContext"
	// into a single transaction based object needed for giving the
	// endorsement transaction an unique transaction ID, and nonce,
	// and also the user identity required when building the outbound
	// request for the fabric network
	// The user identity used must also be a signing identity unless
	// the signing is being done external to the NodeSDK-Base.
	const idx: IdentityContext = client.newIdentityContext(clientObject.user);

	// We have arguments
	const argArray: string[] = requestArgs.slice(1, -1).split(',');
	let initRequired: boolean = false;
	if (argArray[0].includes('init')) {
		initRequired = true;
	}

	// The peers and orderers will be built by the client so that common
	// connection information will come from the client object, like the mutual TLS cert/key
	const targets: Endorser[] = [];
	let discoveryHandler: DiscoveryHandler;

	try {
		// This is a new object to NodeSDK-Base. This "Proposal" object will
		// centralize the endorsement operation, including the endorsement results.
		// Proposals must be built from channel and chaincode name
		const endorsement: Endorsement = channel.newEndorsement(contractName);

		// ---- setup DISCOVERY
		endorsement.setNoPrivateReads(true);
		endorsement.addCollectionInterest('_implicit_org_Org1MSP');
		const discovery: DiscoveryService = channel.newDiscoveryService('mydiscovery');
		const discoverer: Discoverer = client.newDiscoverer('peer1-discovery');

		// ----- E N D O R S E -----
		// endorsement will have the values needed by the chaincode
		// to perform the endorsement (invoke)
		const endorsementRequest: any = {
			args: [...argArray],
			init: initRequired
		};

		// The endorsement object has the building of the request, the signing
		// and the sending steps broken out into separate API's that must
		// be called individually.
		endorsement.build(idx, endorsementRequest);
		endorsement.sign(idx);

		// unique connection information will be used to build an endpoint
		// used on connect()
		const peerNames: any = ccp.getPeersForChannel(channelName);
		const endpoints: Endpoint[] = [];

		for (const peerName of peerNames) {
			const peerObject: any = ccp.getPeer(peerName);
			const endpoint: Endpoint = client.newEndpoint({
				'url': peerObject.url,
				'pem': fs.readFileSync(peerObject.tlsCACerts.path).toString(),
				'ssl-target-name-override': peerObject.grpcOptions['ssl-target-name-override'],
			});

			endpoints.push(endpoint);

			const peer: Endorser = client.newEndorser(peerObject.grpcOptions['ssl-target-name-override']);
			await peer.connect(endpoint, {});
			targets.push(peer);

			const connectionOk: boolean = await peer.checkConnection();
			if (connectionOk) {
				BaseUtils.logMsg('Peer checkConnection test successfully');
			} else {
				BaseUtils.logAndThrow('Peer checkConnection test failed');
			}
		}

		// ----- D I S C O V E R Y -----
		await discoverer.connect(endpoints[0]);
		// use the endorsement to build the discovery request
		discovery.build(idx, {endorsement: endorsement});
		discovery.sign(idx);
		// discovery results will be based on the chaincode of the endorsement
		const discoveryResults = await discovery.send({targets: [discoverer], asLocalhost: true});

		discoveryHandler = discovery.newHandler();

		// We now have all we need, save to the clientObject
		const request: any = {endorsement, endpoints, idx, discoveryResults};

		if (useDiscovery) {
			request.handler = discoveryHandler;

			// check the peers on the channel have the chaincode
			const peers = channel.getEndorsers();
			for (const peer of peers) {
				if (peer.hasChaincode(contractName)) {
					BaseUtils.logMsg(`Peer ${peer.name} has chaincode ${contractName}`);
				} else {
					BaseUtils.logAndThrow(`Peer ${peer.name} does not have chaincode ${contractName}`);
				}
			}
		} else {
			request.targets = targets;
		}

		if (clientObject.requests) {
			clientObject.requests.set(requestName, request);
		} else {
			const map: Map<string, any> = new Map();
			map.set(requestName, request);
			clientObject.requests = map;
		}
	} catch (error) {
		BaseUtils.logMsg(`failure in buildChannelRequest: ${error.toString()}`, {});
		for (const target of targets) {
			target.disconnect();
		}
		throw error;
	}
}

export async function commitChannelRequest(requestName: string, clientName: string, channelName: string): Promise<void> {
	// Requires that the endorsement is already built and signed (performed by buildChannelRequest())
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;

	if (clientObject.requests && clientObject.requests.has(requestName) && clientObject.channels.has(channelName)) {
		const channel: Channel = clientObject.channels.get(channelName);
		const requestObject: any = clientObject.requests.get(requestName);
		const ccp: CommonConnectionProfileHelper = clientObject.ccp;
		const endorsement: Endorsement = requestObject.endorsement;
		const discoveryHandler = requestObject.handler;
		const targetPeers: Endorser[] = requestObject.targets;
		const endpoints: Endpoint[] = requestObject.endpoints;
		const eventer: Eventer = client.newEventer('peer1-events');
		const orderer: Committer = client.newCommitter('orderer');

		try {
			// Build an endorsement request
			const endorsementRequest: any = {
				targets: targetPeers,
				handler: discoveryHandler,
				requestTimeout: Constants.HUGE_TIME
			};

			// Send the signed endorsement to the requested peers.
			const endorsementResponse: ProposalResponse = await endorsement.send(endorsementRequest);
			assertNoErrors(endorsementResponse);

			// Connect to 'Eventer'
			try {
				await eventer.connect(endpoints[0], {});
				if (await eventer.checkConnection()) {
					BaseUtils.logMsg('Eventer checkConnection test successfully');
				} else {
					BaseUtils.logAndThrow('Eventer checkConnection test failed');
				}
			} catch (error) {
				BaseUtils.logError(`Failed to connect to channel event hub ${eventer.toString()}`);
				BaseUtils.logError(`Failed to connect ${error.stack}`);
				throw error;
			}

			// The event service is channel based
			const eventService: EventService = channel.newEventService(Constants.EVENT_HUB_DEFAULT_NAME);
			eventService.build(requestObject.idx, {});
			eventService.sign(requestObject.idx);
			const eventRequest: SendEventOptions = {
				targets: [eventer],
				requestTimeout: 10000
			};
			await eventService.send(eventRequest);

			const eventListener: any = new Promise((resolve: any, reject: any): any => {
				const handle: NodeJS.Timeout = setTimeout(() => {
					eventer.disconnect();
					// may want to unregister the tx event listener
					reject(new Error('Test application has timed out waiting for tx event'));
				}, Constants.INC_LONG);

				eventService.registerTransactionListener(
					endorsement.getTransactionId(),
					(error: any, event: any): any => {
						clearTimeout(handle);
						if (error) {
							BaseUtils.logError(`Failed to receive transaction event for ${endorsement.getTransactionId()}`, {});
							reject(error);
						}
						BaseUtils.logMsg(`Successfully received the transaction event for ${event.transactionId} with status of ${event.status} in block number ${event.blockNumber}`, {});
						resolve('Commit success');
					},
					{}
				);
			});

			// ----- C O M M I T  S T A G E -----
			// create an endpoint with all the connection information
			const ordererName: string = ccp.getOrderersForChannel(channelName)[0];
			const ordererObject: any = ccp.getOrderer(ordererName);
			const orderEndpoint: Endpoint = client.newEndpoint({
				'url': ordererObject.url,
				'pem': fs.readFileSync(ordererObject.tlsCACerts.path).toString(),
				'ssl-target-name-override': ordererObject.grpcOptions['ssl-target-name-override'],
			});

			// Connect to orderer
			await orderer.connect(orderEndpoint, {});
			if (await orderer.checkConnection()) {
				BaseUtils.logMsg('Orderer checkConnection test successfully', {});
			} else {
				BaseUtils.logAndThrow('Orderer checkConnection test failed');
			}

			// Create, build, sign the commit
			// - The build returns the bytes that may be signed externally
			// -When signing internally the idx must have a user with a signing identity.
			const commit: Commit = endorsement.newCommit();
			commit.build(requestObject.idx, {});
			commit.sign(requestObject.idx);

			const commitRequest: any = {
				targets: [orderer], // could also use the orderer names
				requestTimeout: 3000
			};

			try {
				// Send commit, having started the event listener, wait for all
				const commitSubmission: any = commit.send(commitRequest);
				const commitResults: any[] = await Promise.all([eventListener, commitSubmission]);

				requestObject.results = {
					general: JSON.stringify({
						result: 'SUCCESS'
					}),
					commit: JSON.stringify({
						status: commitResults[1].status
					}),
					event: JSON.stringify({
						result: commitResults[0]
					})
				};
				BaseUtils.logMsg(' - commitChannelRequest complete');
			} catch (error) {
				// Swallow error as we might be testing a failure path, but modify request object with error msg and status
				requestObject.results = {
					general: JSON.stringify({
						result: 'FAILURE',
						msg: error.toString(),
					})
				};
			}
		} catch (error) {
			BaseUtils.logError('sendChannelRequest failed with error', error.stack);
			throw error;
		} finally {
			BaseUtils.logMsg(' - commitChannelRequest finally');

			if (targetPeers) {
				for (const target of targetPeers) {
					target.disconnect();
				}
			}
			orderer.disconnect();
			eventer.disconnect();
			BaseUtils.logMsg(`- disconnected all endpoints for client object ${clientName} and request ${requestName}`);
		}
	} else {
		BaseUtils.logAndThrow(`Request named ${requestName} does not exits on client object for client ${clientName}`);
	}
}

export async function queryChannelRequest(clientName: string, channelName: string, contractName: string, contractArgs: string, queryName: string, checkSendingtoContract: boolean): Promise<void> {
	BaseUtils.logMsg(' -- starting clientUtils.queryChannelRequest');

	// Requires that the endorsement is already built and signed (performed by buildChannelRequest())
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const ccp: CommonConnectionProfileHelper = clientObject.ccp;

	// need a queries object
	if (!clientObject.queries) {
		clientObject.queries = new Map<string, any>();
	}

	// Split args into an array to feed into the buildQueryRequest
	const argArray: string[] = contractArgs.slice(1, -1).split(',');

	if (clientObject.channels.has(channelName)) {
		const channel: Channel = clientObject.channels.get(channelName);
		const idx: IdentityContext = client.newIdentityContext(clientObject.user);

		const peerNames: string[] = ccp.getPeersForChannel(channelName);
		const targets: Endorser[] = [];

		for (const peerName of peerNames) {
			const peerObject: any = ccp.getPeer(peerName);
			const endpoint: Endpoint = client.newEndpoint({
				'url': peerObject.url,
				'pem': fs.readFileSync(peerObject.tlsCACerts.path).toString(),
				'ssl-target-name-override': peerObject.grpcOptions['ssl-target-name-override'],
			});

			const peer: Endorser = client.newEndorser(peerObject.grpcOptions['ssl-target-name-override']);
			await peer.connect(endpoint, {});
			targets.push(peer);

			const connectionOk: boolean = await peer.checkConnection();
			if (connectionOk) {
				BaseUtils.logMsg('Peer checkConnection test successfully');
			} else {
				BaseUtils.logAndThrow('Peer checkConnection test failed');
			}
		}

		try {
			// New query with passed contract name
			const query: Query = channel.newQuery(contractName);

			// Build a query request
			const buildQueryRequest: any = {
				args: argArray
			};

			// Build and sign the query
			query.build(idx, buildQueryRequest);
			query.sign(idx);

			// Construct query request
			const queryRequest: any = {
				targets,
				requestTimeout: Constants.INC_LONG
			};

			// if required, set up the peers with chaincode names to cause
			// one error and one result
			if (checkSendingtoContract) {
				if (targets[0]) {
					targets[0].discovered = true;
					BaseUtils.logError('- force peer[0] to fail the hasChaincode test ' + targets[0].name);
				}
			}

			// Send query to target peers
			const queryObject: any = {};
			try {
				const queryResponse: ProposalResponse = await query.send(queryRequest);
				BaseUtils.logError('query submission checking results');
				queryObject.results = {};
				let inc: number = 0;
				if (queryResponse.errors.length > 0) {
					// failure
					BaseUtils.logMsg(`Query failure detected`);
					queryObject.results.general = JSON.stringify({result: 'FAILURE'});
					if (checkSendingtoContract) {
						BaseUtils.logMsg(`Query during chaincodecheck failure detected`);
						queryObject.results['chaincodecheck'] = queryObject.results.general;
					}
					for (const error of queryResponse.errors) {
						queryObject.results[`peer${inc}`] = error.toString();
						BaseUtils.logMsg(`Query failure ${queryObject.results[`peer${inc}`]}`);
						inc++;
					}
				}
				if (queryResponse.queryResults.length > 0) {
					// Success
					BaseUtils.logMsg(`Query success detected`);
					queryObject.results.general = JSON.stringify({result: 'SUCCESS'});
					for (const result of queryResponse.queryResults) {
						queryObject.results[`peer${inc}`] = JSON.parse(result.toString());
						BaseUtils.logMsg(`Query results ${queryObject.results[`peer${inc}`]}`);
						inc++;
					}
				} else {
					BaseUtils.logMsg(`No Query success detected`);
				}
			} catch (error) {
				// Swallow error as we might be testing a failure path, but modify request object with error msg and status
				queryObject.results = {
					general: JSON.stringify({
						result: 'FAILURE',
						msg: error.toString(),
					})
				};
			}
			clientObject.queries.set(queryName, queryObject);
		} catch (error) {
			BaseUtils.logError('query submission failed with error: ', error.stack);
			throw error;
		} finally {
			for (const target of targets) {
				target.disconnect();
			}
		}
	} else {
		BaseUtils.logAndThrow(`Channel named ${channelName} does not exits on client object for client ${clientName}`);
	}
}

export function createAdminUserForOrg(ccp: CommonConnectionProfileHelper, orgName: string): User {

	const org: any = ccp.getOrganization(orgName);
	if (!org) {
		throw new Error(`Could not find organization ${orgName} in configuration`);
	}

	const keyPEM: Buffer = fs.readFileSync(org.adminPrivateKeyPEM.path);
	const certPEM: Buffer = fs.readFileSync(org.signedCertPEM.path);

	// Create user and return
	return User.createUser(Constants.ADMIN_NAME, Constants.ADMIN_PW, org.mspid, certPEM.toString(), keyPEM.toString());
}

async function getTlsEnrollmentResponseForOrgUser(user: User, orgName: string, ccp: CommonConnectionProfileHelper): Promise<FabricCAServices.IEnrollResponse> {

	const caName: string = ccp.getCertificateAuthoritiesForOrg(orgName)[0];
	const ca: any = ccp.getCertificateAuthority(caName);
	const fabricCAPem: string = fs.readFileSync(ca.tlsCACerts.path).toString();
	const fabricCAEndpoint: string = ca.url;

	const tlsOptions: FabricCAServices.TLSOptions = {
		trustedRoots: [fabricCAPem],
		verify: false
	};

	const caService: FabricCAServices = new FabricCAServices(fabricCAEndpoint, tlsOptions, caName, user.getCryptoSuite());

	const request: FabricCAServices.IEnrollmentRequest = {
		enrollmentID: user.getName(),
		enrollmentSecret: user.getEnrollmentSecret(),
		profile: 'tls'
	};

	return await caService.enroll(request);
}

export function validateChannelRequestResponse(clientName: string, isRequest: boolean, requestName: string, fieldName: string, expectedResult: string): boolean | void {
	const clientObject: any = retrieveClientObject(clientName);

	let results: any;
	if (isRequest) {
		if (clientObject.requests && clientObject.requests.has(requestName)) {
			const requestObject: any = clientObject.requests.get(requestName);
			results = requestObject.results;
		} else {
			BaseUtils.logAndThrow(`Request named ${requestName} does not exits on client object for client ${clientName} for validation`);
		}
	} else {
		if (clientObject.queries && clientObject.queries.has(requestName)) {
			const queryObject: any = clientObject.queries.get(requestName);
			results = queryObject.results;
		} else {
			BaseUtils.logAndThrow(`Query named ${requestName} does not exits on client object for client ${clientName} for validation`);
		}
	}

	if (results) {
		const savedResult: any = results[fieldName];
		BaseUtils.logMsg(`clientUtils - fieldName: ${fieldName} - raw results of query = ${savedResult}`);

		let stringResult: string;
		if (savedResult instanceof Buffer) {
			stringResult = savedResult.toString('utf8');
			BaseUtils.logMsg(`clientUtils - results of query was a Buffer = ${stringResult}`);
		} else if (typeof savedResult === 'string') {
			stringResult = savedResult.toString();
			BaseUtils.logMsg(`clientUtils - results of query was a string = ${stringResult}`);
		} else { // must be an object
			stringResult = JSON.stringify(savedResult);
			BaseUtils.logMsg(`clientUtils - results of query was an object = ${stringResult}`);
		}

		const isMatch: boolean = (stringResult.localeCompare(expectedResult) === 0);
		if (isMatch) {
			BaseUtils.logMsg(`Results match for ${requestName} of type ${fieldName}`);
		} else {
			BaseUtils.logAndThrow(`Unexpected response for ${requestName} and type ${fieldName}. Expected ${expectedResult} but had ${stringResult}`);
		}

	} else {
		BaseUtils.logAndThrow(`Response for ${requestName} does not have a results object for validation`);
	}
}

export function validateDiscoveryResponse(clientName: string, requestName: string): boolean | void {
	const clientObject: any = retrieveClientObject(clientName);

	let results: any;
	if (clientObject.requests && clientObject.requests.has(requestName)) {
		const requestObject: any = clientObject.requests.get(requestName);
		results = requestObject.discoveryResults;
	} else {
		BaseUtils.logAndThrow(`Request named ${requestName} does not exits on client object for client ${clientName} for discovery results validation`);
	}

	if (results) {
		BaseUtils.logMsg(`clientUtils - raw discovery results = ${JSON.stringify(results)}`);
		if (results.endorsement_plan && results.endorsement_plan.layouts && results.endorsement_plan.layouts.length > 0) {
			BaseUtils.logMsg(`Response for ${requestName} has an endorsement_plan`);
		} else {
			BaseUtils.logAndThrow(`Response for ${requestName} does not have an endorsement plan`);
		}

	} else {
		BaseUtils.logAndThrow(`Response for ${requestName} does not have a results object for discovery results validation`);
	}
}

export async function createEventService(eventServiceName: string, clientName: string, channelName: string): Promise<void> {

	// Best have a client object ready and waiting
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const channel: Channel = clientObject.channels.get(channelName);
	const idx: IdentityContext = client.newIdentityContext(clientObject.user);

	try {
		const eventService: EventService = channel.newEventService(eventServiceName);
		if (clientObject.eventServices) {
			clientObject.eventServices.set(eventServiceName, {eventService, idx, channelName});
		} else {
			const map: Map<string, any> = new Map();
			map.set(eventServiceName, {eventService, idx, channelName});
			clientObject.eventServices = map;
		}
	} catch (error) {
		BaseUtils.logMsg(`failure in buildEventService: ${error.toString()}`, {});
		throw error;
	}
}

export async function startEventService(
	blockType: 'filtered' | 'full' | 'private' | undefined,
	eventServiceName: string,
	clientName: string,
	startBlock: string,
	endBlock: string,
	start: string): Promise<void> {

	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const ccp: CommonConnectionProfileHelper = clientObject.ccp;
	const eventServiceObject: any = clientObject.eventServices.get(eventServiceName);
	const eventService: EventService = eventServiceObject.eventService;
	const idx: IdentityContext = eventServiceObject.idx;
	const channelName: string = eventServiceObject.channelName;

	const targets: Eventer[] = [];

	try {
		const buildOptions: StartRequestOptions = {
			blockType: blockType
		};
		if (startBlock.localeCompare('NOW') === 0) {
			// do not add start block
		} else {
			buildOptions.startBlock = Number.parseInt(startBlock, 10);
		}
		if (endBlock.localeCompare('END') === 0) {
			// do not add start block
		} else {
			buildOptions.endBlock = Number.parseInt(endBlock, 10);
		}

		eventService.build(idx, buildOptions);
		eventService.sign(idx);

		const peerNames: any = ccp.getPeersForChannel(channelName);
		const endpoints: Endpoint[] = [];

		if (start === 'restart') {
			// we want to use the targets that we used last time
			await eventService.send();
			return;
		}

		for (const peerName of peerNames) {
			const peerObject: any = ccp.getPeer(peerName);
			const endpoint: Endpoint = client.newEndpoint({
				'url': peerObject.url,
				'pem': fs.readFileSync(peerObject.tlsCACerts.path).toString(),
				'ssl-target-name-override': peerObject.grpcOptions['ssl-target-name-override'],
			});

			endpoints.push(endpoint);

			const peer: Eventer = client.newEventer(peerObject.grpcOptions['ssl-target-name-override']);
			await peer.connect(endpoint, {});
			targets.push(peer);

			const connectionOk: boolean = await peer.checkConnection();
			if (connectionOk) {
				BaseUtils.logMsg('Peer checkConnection test successfully');
			} else {
				BaseUtils.logAndThrow('Peer checkConnection test failed');
			}
		}

		await eventService.send({targets: targets});
	} catch (error) {
		BaseUtils.logMsg(`failure in startEventService: ${error.toString()}`, {});
		for (const target of targets) {
			target.disconnect();
		}
		throw error;
	}
}

export async function registerEventListener(
	eventServiceName: string, clientName: string, listenerName: string, type: string,
	startBlock: string, endBlock: string,
	chaincodeEventName: string, chaincodeName: string): Promise<void> {

	const clientObject: any = retrieveClientObject(clientName);
	const eventServiceObject: any = clientObject.eventServices.get(eventServiceName);
	const eventService: EventService = eventServiceObject.eventService;
	let eventListeners: Map<string, any> = eventServiceObject.eventListeners;
	if (!eventListeners) {
		eventListeners = new Map();
		eventServiceObject.eventListeners = eventListeners;
	}

	BaseUtils.logMsg(`Register event listener ${listenerName}`);

	const listenerOptions: any = {};
	if (startBlock.length > 0) {
		listenerOptions.startBlock = Number.parseInt(startBlock, 10);
	}
	if (endBlock.length > 0) {
		listenerOptions.endBlock = Number.parseInt(endBlock, 10);
	}

	try {
		const listenerObject: any = {};
		eventServiceObject.eventListeners.set(listenerName, listenerObject);
		if (type === 'block') {
			BaseUtils.logMsg(`Registering a block event with startBlock ${startBlock} endBlock ${endBlock}`);

			listenerObject.eventListener = eventService.registerBlockListener(
				(error, event) => {
					if (error) {
						BaseUtils.logMsg(`Block listener ERROR received for ${listenerName} :: ${error.toString()}`);
						listenerObject.error = error;
						return;
					}
					if (event?.endBlockReceived) {
						if (event?.blockNumber.equals(Long.fromValue(listenerOptions.endBlock))) {
							BaseUtils.logMsg(`Endblock indication received for ${listenerName}`);
						} else {
							listenerObject.error = Error('invalid "Endblock" indication received');
							BaseUtils.logMsg(`invalid Endblock indication received for ${listenerName} with block number ${event?.blockNumber.toString()}`);
						}
						return;
					}
					if (event?.blockNumber.lessThan(Long.fromValue(listenerOptions.startBlock)) ||
						event?.blockNumber.greaterThan(Long.fromValue(listenerOptions.endBlock))) {
						listenerObject.error = Error('Block received not in range');
					}
					const results = {block: event?.blockNumber.toString()};
					listenerObject.results = {block: event?.blockNumber.toString()};
					BaseUtils.logMsg(`Store block event listener ${listenerName} results of ${JSON.stringify(results)}`);
				},
				listenerOptions
			);
		} else if (type === 'chaincode') {
			BaseUtils.logMsg(`Registering a chaincode event with chaincodeName ${chaincodeName} chaincodeEventName ${chaincodeEventName}`);
			listenerObject.eventListener = eventService.registerChaincodeListener(
				chaincodeName,
				chaincodeEventName,
				(error, event) => {
					if (error) {
						BaseUtils.logMsg(`Chaincode listener ERROR received for ${listenerName} :: ${error.toString()}`);
						if (error.toString().includes('Shutdown due to end block number has been seen')) {
							BaseUtils.logMsg(`Shutdown indication received for ${listenerName} successfully successfully from event service ${eventServiceName}`);
							return;
						}
						listenerObject.error = error;
						return;
					}

					BaseUtils.logMsg(`Chaincode listener event received for ${listenerName} :: ${event}`);

					if (event?.chaincodeEvents) {
						for (const chaincodeEvent of event.chaincodeEvents) {
							const results: any = {};
							results[chaincodeEvent.eventName] = chaincodeEvent.payload ? chaincodeEvent.payload.toString() : '';
							listenerObject.results = results;
							BaseUtils.logMsg(`Store chaincode event listener ${listenerName} results of ${JSON.stringify(results)}`);
						}
					}
				},
				listenerOptions
			);
		} else if (type === 'transaction') {
			BaseUtils.logMsg('Registering a transaction event for all transactions');

			listenerObject.eventListener = eventService.registerTransactionListener(
				'all',
				(error, event) => {
					if (error) {
						if (error.toString().includes('Shutdown due to end block number has been seen')) {
							BaseUtils.logMsg(`Shutdown indication received for ${listenerName} successfully successfully from event service ${eventServiceName}`);
							return;
						}
						listenerObject.error = error;
						return;
					}
					const transactionResults = listenerObject.results;
					transactionResults.transaction = (Number.parseInt(transactionResults.transaction, 10) + 1).toString();
					listenerObject.results = transactionResults;
					BaseUtils.logMsg(`Store event listener ${listenerName} results of ${JSON.stringify(transactionResults)}`);
				},
				listenerOptions
			);
			listenerObject.results = {transaction: '0'};
		} else {
			BaseUtils.logAndThrow(`Event listener type is not known ${type}`);
		}
	} catch (error) {
		BaseUtils.logMsg(`failure in registerEventListener: ${error.toString()}`, {});
		throw error;
	}
}

export async function checkEventListenerResults(
	eventServiceName: string, clientName: string, listenerName: string,
	check: string): Promise<void> {

	const clientObject: any = retrieveClientObject(clientName);
	const eventServiceObject: any = clientObject.eventServices.get(eventServiceName);
	const listenerObject: any = eventServiceObject.eventListeners.get(listenerName);

	if (listenerObject) {
		if (listenerObject.error) {
			BaseUtils.logMsg(`Received an error for ${listenerName} of ${listenerObject.error}`);
			throw listenerObject.error;
		}
		if (listenerObject.results) {
			if (JSON.stringify(listenerObject.results).localeCompare(check) === 0) {
				BaseUtils.logMsg(`Results compare for eventListener ${listenerName}`);
			} else {
				BaseUtils.logAndThrow(`Results do not compare for eventListener ${listenerName} with ${JSON.stringify(listenerObject.results)}`);
			}
		} else {
			BaseUtils.logAndThrow(`No results for eventListener ${listenerName}`);
		}
	} else {
		BaseUtils.logAndThrow(`Listener object not found ${listenerName}`);
	}
}

export async function disconnectEventService(
	eventServiceName: string, clientName: string): Promise<void> {
	const clientObject: any = retrieveClientObject(clientName);
	const eventServiceObject: any = clientObject.eventServices.get(eventServiceName);

	eventServiceObject.eventService.close();
}
