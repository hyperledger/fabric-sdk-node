/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

import * as BaseUtils from './baseUtils';
import { Constants } from '../../constants';
import { CommonConnectionProfileHelper } from './commonConnectionProfileHelper';
import { StateStore } from './stateStore';

import * as fs from 'fs';
import * as FabricCAServices from 'fabric-ca-client';
import { Client, User, Channel, Endorser, Committer, Eventer, IdentityContext, Endpoint, Endorsement, ProposalResponse, EventService, Commit, Query } from 'fabric-common';
import { stringify } from 'querystring';

const stateStore: StateStore = StateStore.getInstance();

function assertNoErrors(endorsementResults: ProposalResponse): void {
	if (endorsementResults.errors && endorsementResults.errors.length > 0) {
		for (const error of endorsementResults.errors) {
			BaseUtils.logMsg(`Failed to get endorsement : ${error.message}`);
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
			clientMap.set(clientName, { client, user, ccp, clientOrg });
		} else {
			const map: Map<string, any> = new Map<string, any>();
			map.set(clientName, { client, user, ccp, clientOrg });
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

export async function buildChannelRequest(requestName: string, contractName: string, requestArgs: any, clientName: string, channelName: string): Promise<void> {

	// Best have a client object ready and waiting
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const ccp: CommonConnectionProfileHelper = clientObject.ccp;
	const channel: Channel = clientObject.channels.get(channelName);

	// We have arguments
	const argArray: string[] = requestArgs.slice(1, -1).split(',');

	// The peers and orderers will be built by the client so that common
	// connection information will come from the client object, like the mutual TLS cert/key
	const targets: Endorser[] = [];

	try {
		// New object for NodeSDK-Base, "IdentityContext", this object
		// combines the old "TransactionID" and the Clients "UserContext"
		// into a single transaction based object needed for giving the
		// endorsement transaction an unique transaction ID, and nonce,
		// and also the user identity required when building the outbound
		// request for the fabric network
		// The user identity used must also be a signing identity unless
		// the signing is being done external to the NodeSDK-Base.
		const idx: IdentityContext = client.newIdentityContext(clientObject.user);

		// unique connection information will be used to build an endpoint
		// used on connect()
		const peerObjects: any = ccp.getPeersForChannel(channelName);
		const endpoints: Endpoint[] = [];

		for (const peerName of Object.keys(peerObjects)) {
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

		// This is a new object to NodeSDK-Base. This "Proposal" object will
		// centralize the endorsement operation, including the endorsement results.
		// Proposals must be built from channel and chaincode name
		const endorsement: Endorsement = channel.newEndorsement(contractName);

		// ----- E N D O R S E -----
		// endorsement will have the values needed by the chaincode
		// to perform the endorsement (invoke)
		const endorsementRequest: any = {
			args: [...argArray]
		};

		// The endorsement object has the building of the request, the signing
		// and the sending steps broken out into separate API's that must
		// be called individually.
		endorsement.build(idx, endorsementRequest);
		endorsement.sign(idx);

		// We now have an endorsement, save to the ever expanding clientObject
		const request: any = { endorsement, targets, endpoints, idx };
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
		const targetPeers: Endorser[] = requestObject.targets;
		const endpoints: Endpoint[] = requestObject.endpoints;
		const eventer: Eventer = client.newEventer('peer1-events');
		const orderer: Committer = client.newCommitter('orderer');

		try {
			// Build an endorsement request
			const endorsementRequest: any = {
				targets: targetPeers,
				requestTimeout: Constants.INC_LONG
			};

			// Send the signed endorsement to the requested peers.
			const endorsementResponse: ProposalResponse = await endorsement.send(endorsementRequest, {});
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
			const eventRequest: any = {
				targets: [eventer],
				requestTimeout: Constants.INC_MED
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
				const commitSubmission: any =  commit.send(commitRequest, {});
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
			for (const target of targetPeers) {
				target.disconnect();
			}
			orderer.disconnect();
			eventer.disconnect();
			BaseUtils.logMsg(`Disconnected all endpoints for client object ${clientName} and request ${requestName}`);
		}
	} else {
		BaseUtils.logAndThrow(`Request named ${requestName} does not exits on client object for client ${clientName}`);
	}
}

export async function submitChannelRequest(clientName: string, channelName: string, contractName: string, contractArgs: string, queryName: string): Promise<void> {
	// Requires that the endorsement is already built and signed (performed by buildChannelRequest())
	const clientObject: any = retrieveClientObject(clientName);
	const client: Client = clientObject.client;
	const ccp: CommonConnectionProfileHelper = clientObject.ccp;
	const clientOrg: string = clientObject.clientOrg;

	// need a queries object
	if (!clientObject.queries) {
		clientObject.queries = new Map<string, any>();
	}

	// Split args into an array to feed into the buildQueryRequest
	const argArray: string[] = contractArgs.slice(1, -1).split(',');

	if (clientObject.channels.has(channelName)) {
		const channel: Channel = clientObject.channels.get(channelName);
		const idx: IdentityContext = client.newIdentityContext(clientObject.user);

		const peerNames: string[] = ccp.getPeersForOrganization(clientOrg);
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

			// Send query to target peers
			const queryObject: any = {};
			try {
				const queryResponse: ProposalResponse = await query.send(queryRequest, {});

				if (queryResponse.errors.length > 0) {
					// failure
					BaseUtils.logMsg(`Query failure detected`);
					queryObject.results = {
						general: JSON.stringify({
							result: 'FAILURE'
						})
					};
					let inc: number = 0;
					for (const error of queryResponse.errors) {
						queryObject.results[`peer${inc}`] = error.toString();
						inc++;
					}
				} else {
					// Success
					BaseUtils.logMsg(`Query success detected`);
					queryObject.results = {
						general: JSON.stringify({
							result: 'SUCCESS'
						})
					};
					let inc: number = 0;
					for (const result of queryResponse.queryResults) {
						queryObject.results[`peer${inc}`] = JSON.parse(result.toString());
						inc++;
					}
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

function createAdminUserForOrg(ccp: CommonConnectionProfileHelper, orgName: string): User {

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
		const actualResult: string = results[fieldName];
		const isMatch: boolean = (actualResult.localeCompare(JSON.parse(expectedResult)) === 0);
		if (isMatch) {
			BaseUtils.logMsg(`Validated response ${requestName} of type ${fieldName}`, {});
		} else {
			BaseUtils.logAndThrow(`Unexpected response for ${requestName} and type ${fieldName}. Expected ${expectedResult} but had ${actualResult}`);
		}
	} else {
		BaseUtils.logAndThrow(`Response for ${requestName} does not have a results object for validation`);
	}
}
