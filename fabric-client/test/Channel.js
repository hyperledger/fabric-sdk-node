/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const sinon = require('sinon');
const chai = require('chai');
const rewire = require('rewire');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const should = chai.should();
const Long = require('long');

const Channel = require('fabric-client/lib/Channel');
const ChannelRewire = rewire('fabric-client/lib/Channel');
const ChannelEventHub = require('fabric-client/lib/ChannelEventHub');
const Chaincode = require('fabric-client/lib/Chaincode');
const Client = require('fabric-client/lib/Client');
const Constants = require('fabric-client/lib/Constants');
const {Identity, SigningIdentity} = require('fabric-common');
const MSP = require('fabric-client/lib/msp/msp');
const MSPManager = require('fabric-client/lib/msp/msp-manager');
const Orderer = require('fabric-client/lib/Orderer');
const Peer = require('fabric-client/lib/Peer');
const TransactionID = require('fabric-client/lib/TransactionID');
const sdk_utils = require('fabric-client/lib/utils.js');

const fabprotos = require('fabric-protos');
const responseProto = fabprotos.protos;
const proposalProto = fabprotos.protos;
const chaincodeProto = fabprotos.protos;
const identitiesProto = fabprotos.msp;
const transactionProto = fabprotos.protos;
const commonProto = fabprotos.common;
const configtxProto = fabprotos.common;
const identityProto = fabprotos.msp;
const gossipProto = fabprotos.gossip;
const ledgerProto = fabprotos.common;
const queryProto = fabprotos.protos;

const fakeHandlerModulePath = 'fabric-client/test/FakeHandler';
const fakeHandler = require(fakeHandlerModulePath).create();

describe('Channel', () => {
	let debugStub;
	const buildPolicyStub = sinon.stub();
	const channelName = 'channel-name';
	let client;
	let channel;
	let mspId;
	let peer1;
	let peer2;
	let orderer1;
	let orderer2;
	let orderer3;

	let stubMsp;
	let stubMspIdentity;
	let stubSigningIdentity;

	mspId = 'mspId';

	beforeEach(() => {
		const FakeLogger = {
			debug : () => {},
			error: () => {}
		};

		const FakePolicy = {
			buildPolicy :buildPolicyStub
		};

		debugStub = sinon.stub(FakeLogger, 'debug');
		ChannelRewire.__set__('logger', FakeLogger);
		ChannelRewire.__set__('Policy', FakePolicy);

		client = new Client();
		channel = new ChannelRewire(channelName, client);
		peer1 = new Peer('grpc://localhost', {name: 'Peer1'});
		peer2 = new Peer('grpc://localhost', {name: 'Peer2'});
		orderer1 = new Orderer('grpc://localhost', {name: 'Orderer1'});
		orderer2 = new Orderer('grpc://localhost', {name: 'Orderer2'});
		orderer3 = sinon.createStubInstance(Orderer);


		stubMspIdentity = sinon.createStubInstance(Identity);
		stubMspIdentity.isValid.returns(true);
		stubMspIdentity.verify.returns(true);

		stubMsp = sinon.createStubInstance(MSP);
		stubMsp.organizational_unit_identifiers = mspId;
		stubMsp.root_certs = Buffer.from('root-certs');
		stubMsp.intermediate_certs = Buffer.from('intermediate-certs');
		stubMsp.admins = Buffer.from('admin');
		stubMsp.tls_root_certs = Buffer.from('tls_root_certs');
		stubMsp.tls_intermediate_certs = Buffer.from('tls_intermediate_certs');
		stubMsp.deserializeIdentity.returns(stubMspIdentity);

		sinon.stub(channel.getMSPManager(), 'getMSP').withArgs(mspId).returns(stubMsp);
		sinon.stub(channel.getMSPManager(), 'getMSPs').returns([stubMsp]);

		stubSigningIdentity = sinon.createStubInstance(SigningIdentity);
		stubSigningIdentity.serialize.returns(Buffer.from('fake-serialized-signing-identity'));
		stubSigningIdentity.sign.callsFake((digest) => `fake-signature-of-${digest}`);
		sinon.stub(client, '_getSigningIdentity').returns(stubSigningIdentity);

	});

	afterEach(() => {
		sinon.restore();
	});

	/**
	 * Create a transaction success proposal response.
	 * @param {Buffer} [payload] Transaction return value.
	 * @returns {ProposalResponse} protobuff
	 */
	function createTransactionResponse(payload) {
		const proposalResponse = createProposalResponse(payload);

		if (payload) {
			proposalResponse.response.payload = payload;
		}

		return proposalResponse;
	}

	/**
	 * Create a transaction error proposal response.
	 * @param {String} [message] Error message.
	 * @returns {ProposalResponse} protobuff
	 */
	function createErrorResponse(message) {
		const proposalResponse = createProposalResponse(message, 500);

		if (typeof message === 'string') {
			proposalResponse.response.message = Buffer.from(message);
		}

		return proposalResponse;
	}

	/**
	 * Create a skeleton proposal response object.
	 * @param {String} results value for the payload.extension.results fields of the proposal response.
	 * @param {number} [status=200] status code for the response, where 200 is OK and 400+ is an error.
	 * @returns {ProposalResponse} protobuff
	 */
	function createProposalResponse(results, status = 200) {
		if (typeof results !== 'string') {
			results = '';
		}

		const extension = new proposalProto.ChaincodeAction();
		extension.response = new responseProto.Response();
		extension.results = Buffer.from(results);

		const payload = new responseProto.ProposalResponsePayload();
		payload.extension = extension.toBuffer();

		const identity = new identitiesProto.SerializedIdentity();
		identity.mspid = mspId;

		const endorsement = new responseProto.Endorsement();
		endorsement.endorser = identity.toBuffer();

		const response = new responseProto.Response();
		response.status = status;

		const proposalResponse = new responseProto.ProposalResponse();
		proposalResponse.response = response;
		proposalResponse.payload = payload.toBuffer();
		proposalResponse.endorsement = endorsement;

		return proposalResponse;
	}

	function createGetConfigBlockResponse(channelGroup = new configtxProto.ConfigGroup()) {
		const proposalResponse = createProposalResponse('GetConfigBlock response');

		const config = new configtxProto.Config();
		config.channel_group = channelGroup;

		const configEnvelope = new configtxProto.ConfigEnvelope();
		configEnvelope.config = config;

		const envelopePayload = new commonProto.Payload();
		envelopePayload.data = configEnvelope.toBuffer();

		const envelope = new commonProto.Envelope();
		envelope.payload = envelopePayload.toBuffer();

		const blockData = new commonProto.BlockData();
		blockData.data = [envelope.toBuffer()];

		const block = new commonProto.Block();
		block.data = blockData;

		proposalResponse.response.payload = block.toBuffer();

		return proposalResponse;
	}

	function createConfigUpdate() {
		const readSet = new configtxProto.ConfigGroup();

		const writeSet = new configtxProto.ConfigGroup();

		const configUpdate = new configtxProto.ConfigUpdate();
		configUpdate.channel_id = channelName;
		configUpdate.read_set = readSet;
		configUpdate.write_set = writeSet;

		return configUpdate;
	}

	describe('#constructor', () => {
		// Default channel name regex is /^[a-z][a-z0-9.-]*$/
		const invalidChannelName = '!INVALID_CHANNEL_NAME!';
		const channelNameCheckProperty = 'channel-name-regx-checker';

		it('throws if no name parameter', () => {
			expect(() => new Channel(undefined, client)).to.throw('name');
		});

		it('throws if name parameter not a string', () => {
			expect(() => new Channel(418, client)).to.throw('name');
		});

		it('throws if name parameters does not match channel-name-regex-checker', () => {
			sinon.stub(sdk_utils, 'getConfigSetting').withArgs(channelNameCheckProperty).returns({
				pattern: '^[a-z]+$',
				flags: 'i'
			});
			expect(() => new Channel(invalidChannelName, client)).to.throw(invalidChannelName);
		});

		it('no regex check of name parameter if configuration contains an empty object', () => {
			sinon.stub(sdk_utils, 'getConfigSetting').withArgs(channelNameCheckProperty).returns({});
			expect(new Channel(invalidChannelName, client)).to.be.an.instanceof(Channel);
		});

		it('no regex check of name parameter if no channel-name-regx-checker configuration present', () => {
			sinon.stub(sdk_utils, 'getConfigSetting').withArgs(channelNameCheckProperty).returns(null);
			expect(new Channel(invalidChannelName, client)).to.be.an.instanceof(Channel);
		});

		it('throws if no clientContext parameter', () => {
			expect(() => new Channel(channelName, undefined)).to.throw('clientContext');
		});
	});

	describe('add/remove peers', () => {
		// getPeer*() and getChannelPeer*() functions should behave identically

		it('new channel has no peers', () => {
			expect(channel.getChannelPeers(), 'getChannelPeer').to.be.empty;
			expect(channel.getPeers(), 'getPeer').to.be.empty;
		});

		it('throws getting a non-existent peer', () => {
			const peerName = 'NON_EXISTENT_PEER';
			expect(() => channel.getChannelPeer(peerName), 'getChannelPeer').to.throw(peerName);
			expect(() => channel.getPeer(peerName), 'getPeer').to.throw(peerName);
		});

		it('can get added peer', () => {
			channel.addPeer(peer1, 'mspId');

			expect(channel.getChannelPeer(peer1.getName()), 'getChannelPeer').to.exist;
			expect(channel.getPeer(peer1.getName()), 'getPeer').to.exist;
		});

		it('channel has only added peer', () => {
			channel.addPeer(peer1, 'mspId');

			const channelPeerNames = channel.getChannelPeers().map((peer) => peer.getName());
			expect(channelPeerNames, 'getChannelPeers').to.deep.equal([peer1.getName()]);

			const peerNames = channel.getPeers().map((peer) => peer.getName());
			expect(peerNames, 'getPeers').to.deep.equal([peer1.getName()]);
		});

		it('throws getting removed peer', () => {
			channel.addPeer(peer1, 'mspId');
			channel.removePeer(peer1);

			expect(() => channel.getChannelPeer(peer1.getName()), 'getChannelPeer').to.throw(peer1.getName());
			expect(() => channel.getPeer(peer1.getName()), 'getPeer').to.throw(peer1.getName());
		});

		it('channel does not have removed peer', () => {
			channel.addPeer(peer1, 'mspId');
			channel.removePeer(peer1);

			expect(channel.getChannelPeers(), 'getChannelPeer').to.be.empty;
			expect(channel.getPeers(), 'getPeer').to.be.empty;
		});

		it('throws adding a duplicate peer with replace parameter unset', () => {
			channel.addPeer(peer1, 'mspId');
			expect(() => channel.addPeer(peer1, 'mspId')).to.throw().with.property('name', 'DuplicatePeer');
		});

		it('allows adding a duplicate peer with replace parameter set', () => {
			channel.addPeer(peer1, 'mspId');
			channel.addPeer(peer1, 'mspId', null, true);

			expect(channel.getChannelPeers().length).to.equal(1);
		});

		it('sets specified roles on added peer', () => {
			const roles = {
				endorsingPeer: false,
				chaincodeQuery: false,
				ledgerQuery: false,
				eventSource: false,
				discover: false
			};
			channel.addPeer(peer1, 'mspId', roles);

			const channelPeer = channel.getChannelPeer(peer1.getName());

			Object.getOwnPropertyNames(roles).forEach((role) => {
				expect(channelPeer.isInRole(role), role).to.equal(roles[role]);
			});
		});
	});

	describe('#getPeersForOrg', () => {
		it('returns empty array for non-existent org', () => {
			expect(channel.getPeersForOrg('no-such-msp-id')).to.be.empty;
		});

		it('returns peers for org', () => {
			const org1 = 'org1';
			const org2 = 'org2';
			channel.addPeer(peer1, org1);
			channel.addPeer(peer2, org2);

			const org1PeerNames = channel.getPeersForOrg(org1).map((peer) => peer.getName());
			expect(org1PeerNames, 'org1').to.deep.equal([peer1.getName()]);

			const org2PeerNames = channel.getPeersForOrg(org2).map((peer) => peer.getName());
			expect(org2PeerNames, 'org2').to.deep.equal([peer2.getName()]);
		});

		it('uses org from client if none supplied', () => {
			const org1 = 'org1';
			const org2 = 'org2';
			client.loadFromConfig({
				version: '1.0',
				client: {
					organization: 'Org1'
				},
				organizations: {
					'Org1': {
						mspid: org1
					}
				}
			});
			channel.addPeer(peer1, org1);
			channel.addPeer(peer2, org2);

			const peerNames = channel.getPeersForOrg().map((peer) => peer.getName());
			expect(peerNames).to.deep.equal([peer1.getName()]);
		});
	});

	describe('add/remove orderers', () => {
		it('new channel has no orderers', () => {
			expect(channel.getOrderers()).to.be.empty;
		});

		it('throws getting a non-existent peer', () => {
			const ordererName = 'NON_EXISTENT_ORDERER';
			expect(() => channel.getChannelPeer(ordererName)).to.throw(ordererName);
		});

		it('can get added orderer', () => {
			channel.addOrderer(orderer1);
			expect(channel.getOrderer(orderer1.getName())).to.exist;
		});

		it('channel has only added orderer', () => {
			channel.addOrderer(orderer1);

			const ordererNames = channel.getOrderers().map((orderer) => orderer.getName());
			expect(ordererNames).to.deep.equal([orderer1.getName()]);
		});

		it('throws getting removed orderer', () => {
			channel.addOrderer(orderer1);
			channel.removeOrderer(orderer1);

			expect(() => channel.getOrderer(orderer1.getName())).to.throw(orderer1.getName());
		});

		it('channel does not have removed orderer', () => {
			channel.addOrderer(orderer1);
			channel.removeOrderer(orderer1);

			expect(channel.getOrderers()).to.be.empty;
		});

		it('throws adding a duplicate orderer with replace parameter unset', () => {
			channel.addOrderer(orderer1);
			expect(() => channel.addOrderer(orderer1)).to.throw().with.property('name', 'DuplicateOrderer');
		});

		it('allows adding a duplicate peer with replace parameter set', () => {
			channel.addOrderer(orderer1);
			channel.addOrderer(orderer1, true);

			expect(channel.getOrderers().length).to.equal(1);
		});
	});

	describe('#close', () => {
		it('calls close on all channel peers', () => {
			const peers = [peer1, peer2];
			peers.forEach((peer) => {
				sinon.spy(peer, 'close');
				channel.addPeer(peer, `${peer.getName()}Org`);
			});

			channel.close();

			peers.forEach((peer) => {
				expect(peer.close.calledOnce, peer.getName()).to.be.true;
			});
		});

		it('calls close on all orderers', () => {
			const orderers = [orderer1, orderer2];
			orderers.forEach((orderer) => {
				sinon.spy(orderer, 'close');
				channel.addOrderer(orderer);
			});

			channel.close();

			orderers.forEach((orderer) => {
				expect(orderer.close.calledOnce, orderer.getName()).to.be.true;
			});
		});
	});

	describe('#getName', () => {
		it('returns the channel name', () => {
			expect(channel.getName()).to.equal(channelName);
		});
	});

	describe('#newChannelEventHub', () => {
		it('returns a channel event hub for a peer', () => {
			expect(channel.newChannelEventHub(peer1)).to.be.an.instanceof(ChannelEventHub);
		});

		it('returns a channel event hub for a named peer assigned to the channel', () => {
			channel.addPeer(peer1);
			expect(channel.newChannelEventHub(peer1.getName())).to.be.an.instanceof(ChannelEventHub);
		});

		it('throws for a named peer not assigned to the channel', () => {
			const peerName = 'NON_EXISTENT_PEER';
			expect(() => channel.newChannelEventHub(peerName)).to.throw(peerName);
		});
	});

	describe('#getChannelEventHub', () => {
		it('throws for non-string name parameter', () => {
			expect(() => channel.getChannelEventHub(418)).to.throw('name');
		});

		it('returns a channel event hub for a named peer assigned to the channel', () => {
			channel.addPeer(peer1);
			expect(channel.getChannelEventHub(peer1.getName())).to.be.an.instanceof(ChannelEventHub);
		});

		it('returns the same channel event hub on subsequent calls', () => {
			channel.addPeer(peer1);
			const channelEventHub = channel.newChannelEventHub(peer1.getName());
			expect(channel.getChannelEventHub(peer1.getName())).to.deep.equal(channelEventHub);
		});

		it('throws for a peer not assigned to the channel', () => {
			const peerName = 'NON_EXISTENT_PEER';
			expect(() => channel.getChannelEventHub(peerName)).to.throw(peerName);
		});
	});

	describe('#getChannelEventHubsForOrg', () => {
		function assertChannelEventHubsMatchPeers(eventHubs, peers) {
			eventHubs.forEach((eventHub) => {
				expect(eventHub).to.be.an.instanceof(ChannelEventHub);
			});

			const eventHubNames = eventHubs.map((eventHub) => eventHub.getName());
			const peerNames = peers.map((peer) => peer.getName());
			expect(eventHubNames).to.deep.equal(peerNames);
		}

		it('returns empty results if no peers in org', () => {
			expect(channel.getChannelEventHubsForOrg('NON_EXISTENT_ORG')).to.be.empty;
		});

		it('returns channel event hubs for peers in a given organization', () => {
			const org1 = 'org1';
			const org2 = 'org2';
			channel.addPeer(peer1, org1);
			channel.addPeer(peer2, org2);

			const eventHubs = channel.getChannelEventHubsForOrg(org1);

			assertChannelEventHubsMatchPeers(eventHubs, [peer1]);
		});

		it('returns channel event hubs for channel\'s orgnanization if no organization specified', () => {
			const org1 = 'org1';
			const org2 = 'org2';
			client.loadFromConfig({
				version: '1.0',
				client: {
					organization: 'Org1'
				},
				organizations: {
					'Org1': {
						mspid: org1
					}
				}
			});
			channel.addPeer(peer1, org1);
			channel.addPeer(peer2, org2);

			const eventHubs = channel.getChannelEventHubsForOrg();

			assertChannelEventHubsMatchPeers(eventHubs, [peer1]);
		});

		it('does not return channel event hubs for peers that are not event sources', () => {
			const org = 'org';
			channel.addPeer(peer1, org);
			channel.addPeer(peer2, org, {eventSource: false});

			const eventHubs = channel.getChannelEventHubsForOrg(org);

			assertChannelEventHubsMatchPeers(eventHubs, [peer1]);
		});
	});

	describe('organizations', () => {
		let mspManager;

		beforeEach(() => {
			mspManager = new MSPManager();
		});

		it('set/get MSP manager', () => {
			channel.setMSPManager(mspManager);
			const result = channel.getMSPManager();
			expect(result).to.equal(mspManager);
		});

		it('returns empty array if no member services providers', () => {
			channel.setMSPManager(mspManager);
			const orgs = channel.getOrganizations();
			expect(orgs).to.be.an('array').that.is.empty;
		});

		it('returns member services provider IDs from MSP manager', () => {
			const mspId1 = 'mspId1';
			const mspId2 = 'mspId2';
			mspManager.addMSP({id: mspId1});
			mspManager.addMSP({id: mspId2});
			channel.setMSPManager(mspManager);

			const orgs = channel.getOrganizations();

			expect(orgs).to.have.deep.members([{id: mspId1}, {id: mspId2}]);
		});
	});

	describe('#toString', () => {
		it('include channel name', () => {
			const result = channel.toString();
			expect(result).to.have.string(channel.getName());
		});

		it('include peers', () => {
			channel.addPeer(peer1, 'org1');
			channel.addPeer(peer2, 'org2');

			const result = channel.toString();

			[peer1, peer2].forEach((peer) => {
				expect(result).to.have.string(peer.toString());
			});
		});

		it('include orderers', () => {
			channel.addOrderer(orderer1);
			channel.addOrderer(orderer2);

			const result = channel.toString();

			[orderer1, orderer2].forEach((orderer) => {
				expect(result).to.have.string(orderer.toString());
			});
		});
	});

	describe('#compareProposalResponseResults', () => {
		it('throws if argument is not an array', () => {
			expect(() => channel.compareProposalResponseResults()).to.throw('proposal_responses must be an array');
		});

		it('throws if argument is an empty array', () => {
			expect(() => channel.compareProposalResponseResults([])).to.throw('proposal_responses is empty');
		});

		it('returns true for a single poposal response', () => {
			const proposalResponse1 = createProposalResponse('foo');
			const result = channel.compareProposalResponseResults([proposalResponse1]);
			expect(result).to.be.true;
		});

		it('returns true for matching poposal responses', () => {
			const proposalResponse1 = createProposalResponse('foo');
			const proposalResponse2 = createProposalResponse('foo');
			const result = channel.compareProposalResponseResults([proposalResponse1, proposalResponse2]);
			expect(result).to.be.true;
		});

		it('returns false for non-matching poposal responses', () => {
			const proposalResponse1 = createProposalResponse('foo');
			const proposalResponse2 = createProposalResponse('bar');
			const result = channel.compareProposalResponseResults([proposalResponse1, proposalResponse2]);
			expect(result).to.be.false;
		});

		it('returns false if any proposal responses are Error objects', () => {
			const proposalResponse1 = createProposalResponse('foo');
			const proposalResponse2 = new Error('bah');
			const result = channel.compareProposalResponseResults([proposalResponse1, proposalResponse2]);
			expect(result).to.be.false;
		});
	});

	describe('#generateUnsignedProposal', () => {
		mspId = 'org1';
		const certificate = 'fake-cert';
		const admin = false;
		let request;

		beforeEach(() => {
			request = {
				fcn: 'functionName',
				args: ['a', 'b', 'c'],
				chaincodeId: 'chaincode-id',
			};
		});

		function getArgsFromProposal(proposal) {
			const payload = proposalProto.ChaincodeProposalPayload.decode(proposal.getPayload());
			const invocationSpec = chaincodeProto.ChaincodeInvocationSpec.decode(payload.getInput());
			const argBuffers = invocationSpec.chaincode_spec.getInput().getArgs();
			return argBuffers.map((buffer) => buffer.toString('utf8'));
		}

		it('throws if request is missing', () => {
			expect(() => channel.generateUnsignedProposal(null, mspId, certificate, admin)).to.throw('request');
		});

		it('throws if request.args is not an array', () => {
			request.args = undefined;
			expect(() => channel.generateUnsignedProposal(request, mspId, certificate, admin)).to.throw('args');
		});

		it('throws if request.chaincodeId is missing', () => {
			delete request.chaincodeId;
			expect(() => channel.generateUnsignedProposal(request, mspId, certificate, admin)).to.throw('chaincodeId');
		});

		it('returns proposal with args array of [functionName, requestArgs...]', () => {
			const result = channel.generateUnsignedProposal(request, mspId, certificate, admin);
			const args = getArgsFromProposal(result.proposal);

			const expectedArgs = Array.of(request.fcn, ...request.args);
			expect(args).to.be.an('array')
				.that.deep.equals(expectedArgs);
		});

		it('returns a proposal with function name "invoke" if no request.fcn is missing', () => {
			delete request.fcn;

			const result = channel.generateUnsignedProposal(request, mspId, certificate, admin);
			const args = getArgsFromProposal(result.proposal);

			const expectedArgs = Array.of('invoke', ...request.args);
			expect(args).to.be.an('array')
				.that.deep.equals(expectedArgs);
		});

		it('returns a proposal with request.argbytes appended to args array', () => {
			const argbytesValue = 'argbytes';
			request.argbytes = Buffer.from(argbytesValue);

			const result = channel.generateUnsignedProposal(request, mspId, certificate, admin);
			const args = getArgsFromProposal(result.proposal);

			const expectedArgs = Array.of(request.fcn, ...request.args, argbytesValue);
			expect(args).to.be.an('array')
				.that.deep.equals(expectedArgs);
		});

		it('returns a transaction ID', () => {
			const result = channel.generateUnsignedProposal(request, mspId, certificate, admin);
			expect(result.txId).to.be.an.instanceOf(TransactionID);
		});

		it('returns admin transaction ID if admin parameter is true', () => {
			const result = channel.generateUnsignedProposal(request, mspId, certificate, true);
			expect(result.txId.isAdmin()).to.be.true;
		});

		it('returns non-admin transaction ID if admin parameter is false', () => {
			const result = channel.generateUnsignedProposal(request, mspId, certificate, false);
			expect(result.txId.isAdmin()).to.be.false;
		});
	});

	describe('#verifyProposalResponse', () => {
		it('throws if proposal_response is missing', () => {
			expect(() => channel.verifyProposalResponse(null)).to.throw('Missing proposal response');
		});

		it('throws if parameter is not a ProposalResponse', () => {
			expect(() => channel.verifyProposalResponse({})).to.throw('ProposalResponse');
		});

		it('throws if parameter is not a ProposalResponse', () => {
			expect(() => channel.verifyProposalResponse([])).to.throw('ProposalResponse');
		});

		it('throws for unknown MSP ID in proposal response', () => {
			channel.getMSPManager().getMSP.withArgs(mspId).returns(null);
			const proposalResponse = createProposalResponse('messsage');

			expect(() => channel.verifyProposalResponse(proposalResponse)).to.throw(mspId);
		});

		it('returns false if MSP unable to deserialize identity', () => {
			stubMsp.deserializeIdentity.returns(null);
			const proposalResponse = createProposalResponse('messsage');

			const result = channel.verifyProposalResponse(proposalResponse);

			expect(result).to.be.false;
		});

		it('returns false if identity not valid', () => {
			const proposalResponse = createProposalResponse('messsage');
			stubMspIdentity.isValid.returns(false);

			const result = channel.verifyProposalResponse(proposalResponse);

			expect(result).to.be.false;
		});

		it('returns false if signature not valid', () => {
			const proposalResponse = createProposalResponse('messsage');
			stubMspIdentity.verify.returns(false);

			const result = channel.verifyProposalResponse(proposalResponse);

			expect(result).to.be.false;
		});

		it('returns false if signature verification errors', () => {
			const proposalResponse = createProposalResponse('messsage');
			stubMspIdentity.verify.throws('VerifyError', 'test');

			const result = channel.verifyProposalResponse(proposalResponse);

			expect(result).to.be.false;
		});

		it('returns true for valid proposal response', () => {
			const proposalResponse = createProposalResponse('messsage');
			const result = channel.verifyProposalResponse(proposalResponse);
			expect(result).to.be.true;
		});

		it('returns false if the proposal response is an error', () => {
			const proposalResponse = new Error('sadface');
			const result = channel.verifyProposalResponse(proposalResponse);
			expect(result).to.be.false;
		});
	});

	describe('#generateUnsignedTransaction', () => {
		let transactionRequest;

		beforeEach(() => {
			transactionRequest = {
				proposalResponses: [createProposalResponse('message')],
				proposal: new proposalProto.Proposal(),
				txId: sinon.createStubInstance(TransactionID)
			};
		});

		it('throws if request missing', () => {
			expect(() => channel.generateUnsignedTransaction(null)).to.throw('request');
		});

		it('throws if request.proposalResponses is not an array', () => {
			transactionRequest.proposalResponses = undefined;
			expect(() => channel.generateUnsignedTransaction(transactionRequest)).to.throw('"proposalResponses"');
		});

		it('throws if request.proposal missing', () => {
			delete transactionRequest.proposal;
			expect(() => channel.generateUnsignedTransaction(transactionRequest)).to.throw('"proposal"');
		});

		it('throws if no endorsed proposal responses', () => {
			transactionRequest.proposalResponses = [];
			expect(() => channel.generateUnsignedTransaction(transactionRequest)).to.throw('no valid endorsements');
		});

		it('throws if no endorsed proposal responses', () => {
			transactionRequest.proposalResponses[0].response.status = 418;
			expect(() => channel.generateUnsignedTransaction(transactionRequest)).to.throw('no valid endorsements');
		});

		it('returns a transaction payload containing first input proposal response payload', () => {
			const payload = channel.generateUnsignedTransaction(transactionRequest);
			const transaction = transactionProto.Transaction.decode(payload.getData());
			const transactionAction = transaction.getActions()[0];
			const actionPayload = transactionProto.ChaincodeActionPayload.decode(transactionAction.getPayload());
			const endorsedAction = actionPayload.getAction();
			const proposalResponsePayload = responseProto.ProposalResponsePayload.decode(endorsedAction.getProposalResponsePayload());

			const expectedPayload = responseProto.ProposalResponsePayload.decode(transactionRequest.proposalResponses[0].getPayload());

			expect(proposalResponsePayload.toBuffer().equals(expectedPayload.toBuffer())).to.be.true;
		});
	});

	describe('#sendSignedProposal', () => {
		it('returns results of calling sendProposal() on peers as an array', async () => {
			const proposalResult1 = {_fake: 'peer1'};
			const proposalResult2 = {_fake: 'peer2'};
			sinon.stub(peer1, 'sendProposal').resolves(proposalResult1);
			sinon.stub(peer2, 'sendProposal').resolves(proposalResult2);

			const signedProposal = {
				targets: [peer1, peer2],
				signedProposal: Buffer.from('signedProposal')
			};
			const results = await channel.sendSignedProposal(signedProposal, 1000);

			expect(results).to.have.members([proposalResult1, proposalResult2]);
		});
	});

	describe('#initialize', () => {
		it('throws if no request parameter and no peer added', () => {
			return expect(channel.initialize()).to.be.rejectedWith('target');
		});
		it('should throw if peer.discover returns an error', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, new Error('Forced error message'), null);
			return expect(channel.initialize({discover: true, target: peer1})).to.be.rejectedWith('Forced error message');
		});

		it('successful with peer added and no request parameter', () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());

			channel.addPeer(peer1, 'mspid');
			return expect(channel.initialize()).to.be.fulfilled;
		});

		it('successful with two peers added and peer name supplied as request target parameter', () => {
			sinon.stub(peer1, 'sendProposal').resolves('proposal sent to wrong peer');
			sinon.stub(peer2, 'sendProposal').resolves(createGetConfigBlockResponse());

			channel.addPeer(peer1, 'org1');
			channel.addPeer(peer2, 'org2');
			const request = {
				target: peer2.getName()
			};
			return expect(channel.initialize(request)).to.be.fulfilled;
		});

		it('successful with no peer added and a Peer supplied as request target parameter', () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());

			const request = {
				target: peer1
			};
			return expect(channel.initialize(request)).to.be.fulfilled;
		});

		it('successful with no peer added and a ChannelPeer supplied as request target parameter', () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());
			channel.addPeer(peer1, 'mspid');
			const channelPeer = channel.getChannelPeer(peer1.getName());
			channel.removePeer(peer1);

			const request = {
				target: channelPeer
			};
			return expect(channel.initialize(request)).to.be.fulfilled;
		});

		it('throws if specified target peer name does not exist', () => {
			const request = {
				target: 'NON_EXISTENT_PEER_NAME'
			};
			return expect(channel.initialize(request)).to.be.rejectedWith(request.target);
		});

		it('throws if specified target peer is not a Peer or ChannelPeer', () => {
			const request = {
				target: {}
			};
			return expect(channel.initialize(request)).to.be.rejectedWith('Target peer is not a valid peer object instance');
		});

		it('specified endorsement handler is initialized', async () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());
			const initializeSpy = sinon.spy(fakeHandler, 'initialize');

			const request = {
				target: peer1,
				endorsementHandler: fakeHandlerModulePath
			};
			await channel.initialize(request);

			sinon.assert.called(initializeSpy);
		});

		it('specified commit handler is initialized', async () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());
			const initializeSpy = sinon.spy(fakeHandler, 'initialize');

			const request = {
				target: peer1,
				commitHandler: fakeHandlerModulePath
			};
			await channel.initialize(request);

			sinon.assert.called(initializeSpy);
		});

		it('successful with no commit handler specified and no commit handler configuration', () => {
			sinon.stub(peer1, 'sendProposal').resolves(createGetConfigBlockResponse());
			const getConfigSettingStub = sinon.stub(sdk_utils, 'getConfigSetting');
			getConfigSettingStub.withArgs('commit-handler').returns(null);
			getConfigSettingStub.callThrough();

			const request = {
				target: peer1,
			};
			return expect(channel.initialize(request)).to.be.fulfilled;
		});

		it('configuration update', () => {
			const configUpdate = createConfigUpdate();
			const request = {
				configUpdate: configUpdate.toBuffer()
			};
			return expect(channel.initialize(request)).to.be.fulfilled;
		});

		it('throws if request.discover is not a boolean', () => {
			return expect(channel.initialize({discover: 'true'})).to.be.rejectedWith('Request parameter "discover" must be boolean');
		});

		it('set channel._use_discovery if request.asLocalHost is given', async () => {
			sinon.stub(channel, '_initialize');
			await channel.initialize({discover: true});
			expect(channel._use_discovery).to.be.true;
		});

		it('throws if request.asLocalHost is not a boolean', () => {
			return expect(channel.initialize({asLocalhost: 'true'})).to.be.rejectedWith('Request parameter "asLocalhost" must be boolean');
		});

		it('set channel._as_localhost if request.asLocalHost is given', async () => {
			sinon.stub(channel, '_initialize');
			await channel.initialize({asLocalhost: true});
			expect(channel._as_localhost).to.be.true;
		});

		it('throws if discovery is set and target peer has no msp information', () => {
			sinon.stub(peer1, 'sendDiscovery').resolves({results: []});
			return expect(channel.initialize({discover: true, target: peer1})).to.be.rejectedWith('No MSP information found');
		});

		it('should set the clientTlsCertHash if the cert has is available', async () => {
			const setClientTlsCertHashStub = sinon.stub();
			ChannelRewire.__set__('fabprotos.discovery.AuthInfo.prototype.setClientTlsCertHash', setClientTlsCertHashStub);
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			const getClientCertHash = sinon.stub(channel._clientContext, 'getClientCertHash').returns('hash');
			const init = await channel.initialize({discover: true, target: peer1});
			sinon.assert.calledWith(getClientCertHash, true);
			sinon.assert.calledWith(setClientTlsCertHashStub, 'hash');
			expect(init.orderers).to.deep.equal({[mspId]: {endpoints: [{name: `${orderer1._endpoint.addr}:${orderer1._endpoint.port}`, host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}});
		});

		it('finds orderers', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.orderers).to.deep.equal({[mspId]: {endpoints: [{name: `${orderer1._endpoint.addr}:${orderer1._endpoint.port}`, host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}});
		});

		it('sets discovery interests', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {msps: {[mspId]: stubMsp}},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			const interest = {chaincodes: [{name: 'mynewcc'}]};
			const interestKey = JSON.stringify(interest);
			expect(channel._discovery_interests.get(interestKey)).to.deep.equal(interest);
		});

		it('finds endorsement plans', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {msps: {[mspId]: stubMsp}},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
						cc_query_res: {content: [{
							chaincode: {name: 'mynewcc'},
							endorsers_by_groups: {group1: {peers: [peer2]}},
							layouts: [{quantities_by_group: ['layout']}]
						}]}
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.endorsement_plans[0].chaincode).to.deep.equal({name: 'mynewcc'});
			const group = init.endorsement_plans[0].groups.group1;
			expect(JSON.stringify(group.peers)).to.equal(JSON.stringify([{
				'mspid': 'org1',
				'endpoint': 'grpc://localhost',
				'ledger_height': {
					'low': 1,
					'high': 0,
					'unsigned': true
				},
				'chaincodes': [
					{
						'name': 'mynewcc',
						'version': ''
					}
				],
				'name': 'grpc://localhost'
			}]));
			expect(init.endorsement_plans[0].layouts).to.deep.equal([{'0': 'layout'}]);
			expect(init.endorsement_plans[0].plan_id).to.equal('{"chaincodes":[{"name":"mynewcc"}]}');
		});

		it('finds endorsement plans without chaincode', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {msps: {[mspId]: stubMsp}},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
						cc_query_res: {}
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.endorsement_plans).to.deep.equal([]);
		});

		it('finds no endorsement plans when cc_query_res.content is not an array', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {msps: {[mspId]: stubMsp}},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
						cc_query_res: {content: 'not an array'}
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.endorsement_plans).to.deep.equal([]);
		});

		it('should log an error if _getTargetDiscovery throws an error', () => {
			return expect(channel.initialize({discover: true})).to.be.rejectedWith('"target" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network');
		});
	});

	describe('#_initialize', () => {});

	describe('_buildDiscoveryMSPs', () => {});

	describe('#_buildDiscoveryOrderers', () => {});

	describe('#_buildDiscoveryPeers', () => {});

	describe('#_buildDiscoveryEndorsementPlan', () => {});

	describe('#_discover', () => {
	});

	describe('#getDiscoveryResults', () => {
		it('should throw discovery is not turned on', async () => {
			sinon.stub(channel, '_initialize');
			await channel.initialize();
			return expect(channel.getDiscoveryResults({})).to.be.rejectedWith('This Channel has not been initialized or not initialized with discovery support');
		});

		it('returns discovery results', async () => {
			const discoveryResponse = {
				interests: [{name: 'mycc'}],
				peer: peer1,
				results: [{config_result: {msps: {[mspId]: stubMsp}}}],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			const discoveryResults = await channel.getDiscoveryResults({});
			expect(discoveryResults.msps).to.deep.equal({
				[mspId]: {
					admins: 'admin',
					id: 'org1',
					intermediateCerts: 'intermediate-certs',
					orgs: mspId,
					rootCerts: 'root-certs',
					tls_intermediate_certs: 'tls_intermediate_certs',
					tls_root_certs: 'tls_root_certs',
				}
			});
			expect(discoveryResults.orders).to.be.undefined;
			expect(discoveryResults.endorsement_plans).to.deep.equal([]);
			expect(discoveryResults.timestamp).to.exist;
		});
	});


	describe('#getEndorsementPlan', () => {
		it('should return null if no endorsement plans are found', async () => {
			sinon.stub(channel, '_initialize').resolves('initialize-result');
			channel.initialize({discover: true});
			expect(await channel.getEndorsementPlan({chaincodes: []})).to.equal(null);
		});

		it('should call getDiscoveryResults', async () => {
			sinon.stub(channel, '_initialize').resolves('initialize-result');
			const mySpy = sinon.spy(channel, 'getDiscoveryResults');
			channel.initialize({discover: true});
			await channel.getEndorsementPlan({chaincodes: []});
			sinon.assert.calledOnce(mySpy);
		});
	});

	describe('#refresh', () => {
		it('should call initialize and return the result', async () => {
			sinon.stub(channel, '_initialize').resolves('initialize-result');
			const result = await channel.refresh();
			sinon.assert.calledWith(channel._initialize, channel._last_refresh_request);
			result.should.equal('initialize-result');
		});

		it('should log if Channel._initialize throws an error', async () => {
			sinon.stub(channel, '_initialize').rejects(new Error('initialize-failed'));
			try {
				await channel.refresh();
			} catch (err) {
				err.message.should.equal('initialize-failed');
			}
		});
	});

	describe('#getOrganizations', () => {});

	describe('#setMSPManager', () => {});

	describe('#getMSPManager', () => {});

	describe('#addPeer', () => {});

	describe('#remoePeer', () => {});

	describe('#gePeer', () => {});

	describe('#getChannelPeers', () => {});

	describe('#addOrderer', () => {});

	describe('#removeOrderer', () => {});

	describe('#getOrderer', () => {});

	describe('#getOrderers', () => {});

	describe('#newChannelEventHub', () => {});

	describe('#getChannelEventHub', () => {});

	describe('#getChannelEventHubsForOrg', () => {});

	describe('#getGenesisBlock', () => {

		it('should generate a new transaction id', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.orderers).to.deep.equal({[mspId]: {endpoints: [{name: `${orderer1._endpoint.addr}:${orderer1._endpoint.port}`, host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}});
			orderer3.sendDeliver.returns('genesis-block');
			const block = await channel.getGenesisBlock();
			sinon.assert.called(channel._clientContext.getTargetOrderer);
			sinon.assert.called(channel._clientContext._getSigningIdentity);
			sinon.assert.calledWith(orderer3.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
			sinon.assert.calledWith(orderer3.sendDeliver, sinon.match.has('signature', sinon.match.instanceOf(Buffer)));
			expect(block).to.equal('genesis-block');
		});

		it('should use the provided transaction id', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			const init = await channel.initialize({discover: true, target: peer1});
			expect(init.orderers).to.deep.equal({[mspId]: {endpoints: [{name: `${orderer1._endpoint.addr}:${orderer1._endpoint.port}`, host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}});
			orderer3.sendDeliver.returns('genesis-block');
			const txId = client.newTransactionID();
			const block = await channel.getGenesisBlock({txId});
			sinon.assert.called(channel._clientContext.getTargetOrderer);
			sinon.assert.called(channel._clientContext._getSigningIdentity);
			sinon.assert.calledWith(orderer3.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
			sinon.assert.calledWith(orderer3.sendDeliver, sinon.match.has('signature', sinon.match.instanceOf(Buffer)));
			expect(block).to.equal('genesis-block');
		});
	});

	describe('#_discover', () => {
		it('should throw if the request parameter is not set', () => {
			return expect(channel._discover()).to.be.rejectedWith('"request" parameter is not set');
		});

		it('should accept the request.useAdmin flag', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			sinon.spy(channel._clientContext._getSigningIdentity);

			await channel._discover({useAdmin: true, target: peer1});
			sinon.assert.calledWith(channel._clientContext._getSigningIdentity, true);
		});

		it('should accept the request.local flag', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: {properties: {ledger_height: 1, chaincodes: [{name: 'mynewcc'}]}}}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}},
						},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			sinon.spy(channel._clientContext._getSigningIdentity);

			await channel._discover({useAdmin: false, target: peer1, local: true});
			sinon.assert.calledWith(channel._clientContext._getSigningIdentity, false);
			sinon.assert.calledWith(debugStub, '%s - adding local peers query', '_discover');
		});

		it('should accept the request.config flag', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			await channel._discover({target: peer1, config: true});
			sinon.assert.calledWith(debugStub, '%s - adding config query', '_discover');
		});

		it('should throw if discovery returns no results', () => {
			const discoveryResponse = {};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.rejectedWith('Discovery has failed to return results');
		});

		it('should throw if discovery returns no results and response is an Error object', () => {
			const discoveryResponse = new Error();
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.rejectedWith('Discovery has failed to return results');
		});

		it('should throw if discovery returns no results and connection failed', async () => {
			const discoveryResponse = new Error();
			discoveryResponse.connectFailed = true;
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			sinon.stub(peer1, 'close');

			await expect(channel._discover({target: peer1})).to.be.rejectedWith('Discovery has failed to return results');
			sinon.assert.called(peer1.close);
		});

		it('should throw if a discovery result is null', () => {
			const discoveryResponse = {results: [null]};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.rejectedWith('Channel:channel-name Discovery error:Discover results are missing');
		});

		it('should throw if a discovery result result field is "error"', () => {
			const discoveryResponse = {results: [{result: 'error', error: {content: 'fake error'}}]};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.rejectedWith('fake error');
		});

		it('should not thow if no config_result is given', () => {
			const discoveryResponse = {
				peer: peer1,
				results: [{}],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			return expect(channel._discover({target: peer1})).to.be.fulfilled;
		});

		it('should not error given an empty result.config_result', () => {
			const discoveryResponse = {
				peer: peer1,
				results: [{config_result: null}],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			return expect(channel._discover({target: peer1})).to.be.fulfilled;
		});

		it('should not error given an empty result.config_result.msps', () => {
			const discoveryResponse = {
				peer: peer1,
				results: [{config_result: {}}],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			return expect(channel._discover({target: peer1})).to.be.fulfilled;
		});

		it('should throw if anything errors whilst building the discovery config', () => {
			const discoveryResponse = {
				peer: peer1,
				results: [{config_result: {
					msps: {[mspId]: {}}
				}}],
			};
			debugStub.withArgs('%s - found organization %s', '_processDiscoveryConfigResults', 'org1').callsFake(() => {
				throw new Error('forced error');
			});
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			return expect(channel._discover({target: peer1})).to.be.eventually.deep.equal({msps: {}, orderers: undefined});
		});

		it('should not throw if members.peer_by_org is null', () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: {}}
						},
						members: {peers_by_org: null},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			return expect(channel._discover({target: peer1})).to.be.fulfilled;
		});

		it('should ignore everything if top level state info is null', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = null;
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}},
						},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.fulfilled;
		});

		it('should ignore ledger height if state info is null', async () => {
			peer2.identity = new identityProto.SerializedIdentity({mspid: mspId}).toBuffer();
			peer2.membership_info = {payload: new gossipProto.GossipMessage({alive_msg: {membership: {endpoint: peer2.getUrl()}}}).toBuffer()};
			peer2.chaincodes = [{name: 'mynewcc'}];
			peer2.state_info = {payload: new gossipProto.GossipMessage({state_info: null}).toBuffer()};
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}},
						},
						members: {peers_by_org: {[mspId]: {peers: [peer2]}}},
					}
				],
			};
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);

			return expect(channel._discover({target: peer1})).to.be.rejectedWith('Malformed state_info');
		});
	});

	describe('#_processDiscoveryChaincodeResults', () => {});

	describe('#_processDiscoveryResults', () => {});

	describe('#_processDiscoveryMembershipResults', () => {});

	describe('#_processPeers', () => {});

	describe('#_processPeers', () => {});

	describe('#_buildOrdererName', () => {
		it('should match an existing orderer', () => {
			const orderer = sinon.createStubInstance(Orderer);
			orderer.getUrl.returns('grpcs://peer:7051');
			orderer.getName.returns('orderer');
			sinon.stub(channel, '_buildUrl').returns('grpcs://peer:7051');
			channel._orderers = [orderer];
			const mspid = 'mspid';
			const host = 'peer';
			const port = '7051';
			const request = {};
			const name = channel._buildOrdererName(mspid, host, port, {}, request);
			name.should.equal('orderer');
		});

		it('should throw an error if orderer is not found and there is missing information', () => {
			const orderer = sinon.createStubInstance(Orderer);
			sinon.stub(channel, '_buildUrl').returns('grpcs://peer:7051');
			channel._orderers = [orderer];
			const mspid = 'mspid';
			const host = 'peer';
			const port = '7051';
			const request = {};
			(() => {
				channel._buildOrdererName(mspid, host, port, {}, request);
			}).should.throw(Error, 'No TLS cert information available');
		});

		it('should add a new orderer if all information is available', () => {
			const mspid = 'mspid';
			const host = 'peer';
			const port = '7051';
			const request = {};
			sinon.stub(channel, 'addOrderer');
			const name = channel._buildOrdererName(mspid, host, port, {mspid}, request);
			sinon.assert.called(channel.addOrderer);
			name.should.equal('peer:7051');
		});
	});

	describe('#_buildPeerName', () => {
		it('should match an existing peer', () => {
			const peer = sinon.createStubInstance(Peer);
			sinon.stub(channel, '_buildUrl').returns('grpcs://peer:7051');
			peer.getUrl.returns('grpcs://peer:7051');
			peer.getName.returns('peerName');
			channel._channel_peers = [peer];
			const request = {asLocalHost: true};
			const name = channel._buildPeerName('peer:7051', 'mspid', null, request);
			sinon.assert.calledWith(channel._buildUrl, 'peer', '7051', request);
			name.should.equal('peerName');
		});

		it('should throw an error if peer is not found and there is information missing', () => {
			const peer = sinon.createStubInstance(Peer);
			sinon.stub(channel, '_buildUrl').returns('grpcs://peer:7053');
			channel._channel_peers = [peer];
			(() => {
				channel._buildPeerName('peer:7051', 'mspid', null, 'request');
			}).should.throw(Error, 'No TLS cert information available');
		});

		it('should add a new peer if all information is available', () => {
			const mspid = 'mspid';
			const name = channel._buildPeerName('peer:7051', mspid, {mspid}, 'request');
			name.should.equal('peer:7051');
		});
	});

	describe('#_buildUrl', () => {
		it('should build the peer url', () => {
			channel._as_localhost = false;
			const url = channel._buildUrl('somehost', '7050', {});
			expect(url).to.equal('grpcs://somehost:7050');
		});
	});

	describe('#_buildOptions', () => {
		it('should return the build options', () => {
			client = sinon.createStubInstance(Client);
			channel._clientContext = client;
			const msp = {tls_root_certs: 'ROOT_CERT'};
			const pem = 'ROOT_CERT';
			const name = 'name';
			sinon.stub(channel, '_buildTlsRootCerts').returns('ROOT_CERT');
			const buildOptions = channel._buildOptions(name, 'url', 'host', msp);
			sinon.assert.calledWith(channel._buildTlsRootCerts, msp);
			sinon.assert.calledWith(client.addTlsClientCertAndKey, {name, pem, 'ssl-target-name-override': 'host'});
			buildOptions.should.deep.equal({pem, name, 'ssl-target-name-override': 'host'});
		});
	});

	describe('#_buildTlsRootCerts', () => {
		it('should return the root certs if they are in the msp', () => {
			const msp = {tls_root_certs: 'ROOT_CERT'};
			channel._buildTlsRootCerts(msp).should.deep.equal('ROOT_CERT');
		});

		it('should return the intermediate certs if they are in the msp', () => {
			const msp = {tls_intermediate_certs: 'INTERMEDIATE_CERT'};
			channel._buildTlsRootCerts(msp).should.deep.equal('INTERMEDIATE_CERT');
		});

		it('should return both root and intermediate certs if they are in the msp', () => {
			const msp = {tls_root_certs: 'ROOT_CERT', tls_intermediate_certs: 'INTERMEDIATE_CERT'};
			channel._buildTlsRootCerts(msp).should.deep.equal('ROOT_CERTINTERMEDIATE_CERT');
		});
	});

	describe('#_buildProtoChaincodeInterest', () => {
		it('should throw if the chaincode name is not a string', () => {
			expect(() => {
				channel._buildProtoChaincodeInterest({chaincodes: [{name: null}]});
			}).to.throw('Chaincode name must be a string');
		});

		it('should throw if the collection_names is not an array', () => {
			expect(() => {
				channel._buildProtoChaincodeInterest({chaincodes: [{name: 'mycc', collection_names: 'not an array'}]});
			}).to.throw('collection_names must be an array of strings');
		});

		it('should throw if the collection_names contains something that is not a string', () => {
			expect(() => {
				channel._buildProtoChaincodeInterest({chaincodes: [{name: 'mycc', collection_names: ['string', null]}]});
			}).to.throw('The collection name must be a string');
		});
	});

	describe('#_merge_hints', () => {
		it('should return false if no hints are given', () => {
			channel._merge_hints().should.be.false;
		});

		it('should convert non-array hints to arrays and add it to the hints', () => {
			const hint = {hint: 'hint'};
			channel._merge_hints(hint).should.be.true;
			channel._discovery_interests.get(JSON.stringify(hint)).should.deep.equal(hint);
		});

		it('should should return true if hint exists', () => {
			const hint = {hint: 'hint'};
			const hints = [hint];
			channel._discovery_interests.set(JSON.stringify(hint), hint);
			channel._merge_hints(hints).should.be.false;
		});
	});

	describe('#buildDiscoveryInterest', () => {
		it('should return a discovery interest and call _buildDiscoveryInterest', () => {
			const name = 'chaincodeName';
			const collection_names = ['cc'];
			const chaincodeCall = {name, collection_names};
			sinon.stub(channel, '_buildDiscoveryChaincodeCall').returns(chaincodeCall);
			channel._buildDiscoveryInterest('name', collection_names).should.deep.equal({chaincodes: [chaincodeCall]});
		});
	});

	describe('#_buildDiscoveryChaincodeCall', () => {
		it('should throw an error if name is not a string', () => {
			(() => {
				channel._buildDiscoveryChaincodeCall(null, []);
			}).should.throw(Error, 'Chaincode name must be a string');
		});

		it('should throw an error if collection_names is not an array', () => {
			(() => {
				channel._buildDiscoveryChaincodeCall('chaincodeName', {});
			}).should.throw(Error, 'Collections names must be an array of strings');
		});

		it('should throw an error if collection_names contains non-string values', () => {
			(() => {
				channel._buildDiscoveryChaincodeCall('chaincodeName', [null]);
			}).should.throw(Error, 'The collection name must be a string');
		});

		it('should return the chaincode calls if collection_names are not set', () => {
			channel._buildDiscoveryChaincodeCall('chaincodeName', null).should.deep.equal({name: 'chaincodeName'});
		});

		it('should return the chaincode call when correct parameters are given', () => {
			const name = 'chaincodeName';
			const collection_names = ['collection'];
			channel._buildDiscoveryChaincodeCall('chaincodeName', collection_names).should.deep.equal({name, collection_names});
		});
	});

	describe('#joinChannel', () => {

		it('should throw if request is missing', () => {
			expect(() => channel.joinChannel()).to.throw(/Missing all required input request parameters/);
		});

		it('should throw if request.txId is missing', () => {
			expect(() => channel.joinChannel({})).to.throw(/Missing txId input parameter with the required transaction identifier/);
		});

		it('should throw if genesis block is missing', () => {
			expect(() => channel.joinChannel({txId: 1})).to.throw(/Missing block input parameter with the required genesis block/);
		});

		it('should throw if targets is missing', () => {
			expect(() => channel.joinChannel({txId: 1, block: 'something'})).to.throw(/"targets" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network/);
		});

		it('should throw if invalid target', () => {
			expect(() => channel.joinChannel({txId: 1, block: 'something', targets: [{}]})).to.throw(/Target peer is not a valid peer object instance/);
		});

		it('should throw if not existing target', () => {
			expect(() => channel.joinChannel({txId: 1, block: 'something', targets: 'penguin'})).to.throw(/Peer with name "penguin" not assigned to this channel/);
		});

		it('should be rejected is sendPeersProposal fails', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			const err = new Error('forced error');
			sinon.stub(peer1, 'sendProposal').callsFake(() => {
				throw err;
			});
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer3);
			const request = {
				txId: client.newTransactionID(),
				block: {toBuffer: () => new Buffer('{}')},
				targets: [peer1],
			};
			const res = await channel.joinChannel(request);
			expect(res).to.deep.equal([err]);
		});
	});

	describe('#getChannelConfig', () => {
		it('should throw if responses from the transaction proposal arent an array', () => {
			// sinon.stub(peer1, 'sendProposal').resolves(createTransactionResponse(Buffer.from('result')));
			// sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(ChannelRewire, 'sendTransactionProposal').resolves([]);
			return expect(channel.getChannelConfig(peer1)).to.be.rejectedWith('Payload results are missing from the get channel config');
		});

		it('should throw if response is an instance of error', () => {
			sinon.stub(ChannelRewire, 'sendTransactionProposal').resolves([[new Error('forced error')]]);
			return expect(channel.getChannelConfig(peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if response is not status 200', () => {
			sinon.stub(ChannelRewire, 'sendTransactionProposal').resolves([[{response: {payload: '', status: 500}}]]);
			return expect(channel.getChannelConfig(peer1)).to.be.rejectedWith('{"response":{"payload":"","status":500}}');
		});
	});

	describe('#getChannelConfigFromOrderer', () => {
		it('should throw if orderer.sendDeliver returns nothing', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer1);
			sinon.stub(orderer1, 'sendDeliver').returns(null);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			await expect(channel.getChannelConfigFromOrderer()).to.be.rejectedWith('Failed to retrieve latest block');
			sinon.assert.calledWith(orderer1.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
		});

		it('should throw if orderer.sendDeliver second call returns nothing', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer1);
			sinon.stub(orderer1, 'sendDeliver').onCall(0).returns({
				header: {},
				metadata: {
					metadata: [
						null,
						commonProto.Metadata.encode('{value: []}')
					]
				}});
			orderer1.sendDeliver.onCall(1).returns(null);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			await expect(channel.getChannelConfigFromOrderer()).to.be.rejectedWith('Config block was not found');
			sinon.assert.calledWith(orderer1.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
		});

		it('should throw if config block data length is 0', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer1);
			sinon.stub(orderer1, 'sendDeliver').onCall(0).returns({
				header: {},
				metadata: {
					metadata: [
						null,
						commonProto.Metadata.encode('{value: []}')
					]
				}});
			orderer1.sendDeliver.onCall(1).returns({
				header: {number: 1},
				data: {data: []}
			});
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			await expect(channel.getChannelConfigFromOrderer()).to.be.rejectedWith('Config block must only contain one transaction');
			sinon.assert.calledWith(orderer1.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
		});

		it('should throw if config block type is not config', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer1);
			sinon.stub(orderer1, 'sendDeliver').onCall(0).returns({
				header: {},
				metadata: {
					metadata: [
						null,
						commonProto.Metadata.encode('{value: []}')
					]
				}});
			const envelope = new commonProto.Envelope();
			const payload = new commonProto.Payload();
			const header = new commonProto.Header();
			const channelHeader = new commonProto.ChannelHeader();
			header.channel_header = channelHeader.toBuffer();
			payload.header = header.toBuffer();
			envelope.payload = payload.toBuffer();
			envelope.signature = envelope.signature.toBuffer();
			orderer1.sendDeliver.onCall(1).returns({
				header: {number: 1},
				data: {
					data: [
						envelope.toBuffer()
					]
				}
			});
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			await expect(channel.getChannelConfigFromOrderer()).to.be.rejectedWith('Block must be of type "CONFIG" (1), but got "0" instead');
			sinon.assert.calledWith(orderer1.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
		});

		it('should return a valid config envelope', async () => {
			const discoveryResponse = {
				peer: peer1,
				results: [
					{
						config_result: {
							msps: {[mspId]: stubMsp},
							orderers: {[mspId]: {endpoint:[{host:orderer1._endpoint.addr, port:orderer1._endpoint.port}]}}
						},
					}
				],
			};
			sinon.stub(channel._clientContext, 'getTargetOrderer').returns(orderer1);
			sinon.stub(orderer1, 'sendDeliver').onCall(0).returns({
				header: {},
				metadata: {
					metadata: [
						null,
						commonProto.Metadata.encode('{value: []}')
					]
				}});
			const envelope = new commonProto.Envelope();
			const payload = new commonProto.Payload();
			const header = new commonProto.Header();
			const channelHeader = new commonProto.ChannelHeader({
				type: 1,
				version: 1,
				timestamp: {seconds: 1, nanos: 1},
				channel_id: 'mychannel',
				tx_id: 'tx_id',
				epoch: 1,
				extension: '',
				tls_cert_hash:''
			});
			const data = new configtxProto.ConfigEnvelope();
			data.setConfig({});
			header.setChannelHeader(channelHeader.toBuffer());
			payload.setHeader(header);
			payload.setData(data.toBuffer());
			envelope.setPayload(payload.toBuffer());
			orderer1.sendDeliver.onCall(1).returns({
				header: {number: 1},
				data: {data: [envelope.toBuffer()]}
			});
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1._discoveryClient, 'discover').callsArgWith(1, null, discoveryResponse);
			await channel.initialize({discover: true, target: peer1});
			const configEnvelope = await channel.getChannelConfigFromOrderer();
			expect(JSON.stringify(configEnvelope)).to.deep.equal(
				JSON.stringify({
					config: {
						sequence: Long.fromValue(0, true),
						channel_group: null
					},
					last_update: null
				})
			);
			sinon.assert.calledWith(orderer1.sendDeliver, sinon.match.has('payload', sinon.match.instanceOf(Buffer)));
		});
	});

	describe('#queryInfo', () => {

		it('should throw if no peer parameter passed', () => {
			return expect(channel.queryInfo()).to.be.rejectedWith('"target" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network');
		});

		it('should throw if no peer Object passed', () => {
			return expect(channel.queryInfo([peer1])).to.be.rejectedWith('"target" parameter is an array, but should be a singular peer object or peer name according to the common connection profile loaded by the client instance');
		});

		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryInfo(peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryInfo(peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryInfo(peer1)).to.be.rejectedWith('Payload results are missing from the query channel info');
		});

		it('should return decoded blockchain info', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: ''
				}
			});
			const blockchainInfo = await channel.queryInfo(peer1);
			expect(blockchainInfo.height).to.be.deep.equal(ledgerProto.BlockchainInfo.decode('').height);
			expect(blockchainInfo.currentBlockHash).to.be.deep.equal(ledgerProto.BlockchainInfo.decode('').currentBlockHash);
			expect(blockchainInfo.previousBlockHash).to.be.deep.equal(ledgerProto.BlockchainInfo.decode('').previousBlockHash);
		});
	});

	describe('#queryBlockByTxId', () => {
		it('should throw if a tx_id is not given', () => {
			return expect(channel.queryBlockByTxID(null, peer1)).to.be.rejectedWith('tx_id as string is required');
		});

		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryBlockByTxID('tx_id', peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryBlockByTxID('tx_id', peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryBlockByTxID('tx_id', peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should return decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlockByTxID('tx_id', peer1);
			expect(block).to.deep.equal({header: {number: '0', previous_hash: '', data_hash: ''}, data: {data: []}, metadata: {metadata: []}});
		});

		it('should return non-decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlockByTxID('tx_id', peer1, false, true);
			expect(block).to.deep.equal(b.toBuffer());
		});
	});

	describe('#queryBlockByHash', () => {
		const blockhashBytes = new Buffer('hash');
		it('should throw if a blockHash is not given', () => {
			return expect(channel.queryBlockByHash(null, peer1)).to.be.rejectedWith('Blockhash bytes are required');
		});

		it('should throw if a peer is not given', () => {
			return expect(channel.queryBlockByHash(blockhashBytes)).to.be.rejectedWith('"target" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network');
		});

		it('should throw if a peer Object is not given', () => {
			return expect(channel.queryBlockByHash(blockhashBytes, [peer1])).to.be.rejectedWith('parameter is an array, but should be a singular peer object');
		});

		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryBlockByHash(blockhashBytes, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryBlockByHash(blockhashBytes, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryBlockByHash(blockhashBytes, peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should return decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlockByHash(blockhashBytes, peer1);
			expect(block).to.deep.equal({header: {number: '0', previous_hash: '', data_hash: ''}, data: {data: []}, metadata: {metadata: []}});
		});

		it('should return non-decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlockByHash(blockhashBytes, peer1, false, true);
			expect(block).to.deep.equal(b.toBuffer());
		});
	});

	describe('#queryBlock', () => {
		const blockNum = 1;
		it('should throw if a blockHash is not given', () => {
			return expect(channel.queryBlock(null, peer1)).to.be.rejectedWith('Block number must be a positive integer');
		});

		it('should throw if a blockHash is given as string', () => {
			return expect(channel.queryBlock('y u no integer?', peer1)).to.be.rejectedWith('Block number must be a positive integer');
		});

		it('should throw if a blockHash is given as double', () => {
			return expect(channel.queryBlock(1.8934, peer1)).to.be.rejectedWith('Block number must be a positive integer');
		});

		it('should throw if a blockHash is given as negative', () => {
			return expect(channel.queryBlock(-1, peer1)).to.be.rejectedWith('Block number must be a positive integer');
		});

		it('should throw if a peer array given', () => {
			return expect(channel.queryBlock(1, [peer1])).to.be.rejectedWith('"target" parameter is an array, but should be a singular peer object');
		});

		it('should throw if no peer given', () => {
			return expect(channel.queryBlock(1, undefined)).to.be.rejectedWith('"target" parameter not specified and no peers are set on this Channel');
		});

		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryBlock(blockNum, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryBlock(blockNum, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryBlock(blockNum, peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should return decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlock(blockNum, peer1);
			expect(block).to.deep.equal({header: {number: '0', previous_hash: '', data_hash: ''}, data: {data: []}, metadata: {metadata: []}});
		});

		it('should return non-decoded block', async () => {
			const b = new commonProto.Block();
			const header = new commonProto.BlockHeader();
			const data = new commonProto.BlockData();
			b.setHeader(header);
			b.setData(data);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: b.toBuffer()
				}
			});
			const block = await channel.queryBlock(blockNum, peer1, false, true);
			expect(block).to.deep.equal(b.toBuffer());
		});
	});

	describe('#queryTransaction', () => {
		const txId = 'tx_id';
		it('should throw if a tx_id is not given', () => {
			return expect(channel.queryTransaction(null, peer1)).to.be.rejectedWith('Missing "tx_id" parameter');
		});

		it('should throw if a peer is not given', () => {
			return expect(channel.queryTransaction(txId, null)).to.be.rejectedWith('"target" parameter not specified and no peers are set');
		});

		it('should throw if a peer array is given', () => {
			return expect(channel.queryTransaction(txId, [peer1])).to.be.rejectedWith('"target" parameter is an array, but should be a singular peer object or peer name according to the common connection profile loaded by the client instance');
		});

		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryTransaction(txId, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryTransaction(txId, peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryTransaction(txId, peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should return decoded transaction', async () => {
			const t = new transactionProto.ProcessedTransaction();
			const envelope = new commonProto.Envelope();
			const payload = new commonProto.Payload();
			const header = new commonProto.Header();
			const channelHeader = new commonProto.ChannelHeader();
			header.channel_header = channelHeader.toBuffer();
			payload.header = header.toBuffer();
			envelope.payload = payload.toBuffer();
			envelope.signature = envelope.signature.toBuffer();
			t.setTransactionEnvelope(envelope);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: t.toBuffer()
				}
			});
			const transaction = await channel.queryTransaction(txId, peer1);
			sinon.match({
				'validationCode': 0,
				'transactionEnvelope': {
					'signature': sinon.match.instanceOf(Buffer),
					'payload': {
						'header': {
							'channel_header': {
								'type': 0,
								'version': 0,
								'timestamp': 'null',
								'channel_id': '',
								'tx_id': '',
								'epoch': '0',
								'extension': sinon.match.instanceOf(Buffer),
								'typeString': 'MESSAGE'
							},
							'signature_header': {
								'creator': {
									'Mspid': '',
									'IdBytes': ''
								},
								'nonce': sinon.match.instanceOf(Buffer)
							}
						},
						'data': {}
					}
				}
			}).test(transaction);
		});

		it('should return non-decoded block', async () => {
			const t = new transactionProto.ProcessedTransaction();
			const envelope = new commonProto.Envelope();
			const payload = new commonProto.Payload();
			const header = new commonProto.Header();
			const channelHeader = new commonProto.ChannelHeader();
			header.channel_header = channelHeader.toBuffer();
			payload.header = header.toBuffer();
			envelope.payload = payload.toBuffer();
			envelope.signature = envelope.signature.toBuffer();
			t.setTransactionEnvelope(envelope);
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: t.toBuffer()
				}
			});
			const transaction = await channel.queryTransaction(txId, peer1, false, true);
			expect(transaction).to.deep.equal(t.toBuffer());
		});
	});

	describe('#queryInstantiatedChaincodes', () => {
		it('should throw if the response is an error', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves(new Error('forced error'));
			return expect(channel.queryInstantiatedChaincodes(peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500, message: 'forced error'}});
			return expect(channel.queryInstantiatedChaincodes(peer1)).to.be.rejectedWith('forced error');
		});

		it('should throw if we dont get a status 200 or a message', () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({response: {status: 500}});
			return expect(channel.queryInstantiatedChaincodes(peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should throw if the payload results are missing', async () => {
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({});
			return expect(channel.queryInstantiatedChaincodes(peer1)).to.be.rejectedWith('Payload results are missing from the query');
		});

		it('should return decoded query response', async () => {
			const r = new queryProto.ChaincodeQueryResponse({chaincodes: [{name: 'mycc'}]});
			sinon.stub(peer1, 'waitForReady').resolves();
			sinon.stub(peer1, 'sendProposal').resolves({
				response: {
					status: 200,
					payload: r.toBuffer()
				}
			});
			const response = await channel.queryInstantiatedChaincodes(peer1);
			sinon.match({
				'chaincodes':[
					{'name':'mycc', 'version':'', 'path':'', 'input':'', 'escc':'', 'vscc':'', 'id':{'buffer': sinon.match.instanceOf(Buffer), 'offset':0, 'markedOffset':-1, 'limit':0, 'littleEndian':false, 'noAssert':false}}
				]}).test(response);
		});
	});

	describe('#queryCollectionsConfig', () => {});

	describe('#sendInstantiateProposal', () => {
		it('should call _sendChaincodeProposal', () => {
			sinon.stub(channel, '_sendChaincodeProposal');
			channel.sendInstantiateProposal('request', 10);
			sinon.assert.calledWith(channel._sendChaincodeProposal, 'request', 'deploy', 10);
		});
	});

	describe('#sendUpgradeProposal', () => {
		it('should call _sendChaincodeProposal', () => {
			sinon.stub(channel, '_sendChaincodeProposal');
			channel.sendUpgradeProposal('request', 10);
			sinon.assert.calledWith(channel._sendChaincodeProposal, 'request', 'upgrade', 10);
		});
	});

	describe('#_sendChaincodeProposal', () => {

		let mockPeers;
		let txId;

		beforeEach(() => {
			mockPeers = [
				sinon.createStubInstance(Peer),
				sinon.createStubInstance(Peer)
			];
			sinon.stub(channel, '_getTargets').returns(mockPeers);
			txId = client.newTransactionID();
		});

		it('should send an instantiate request with no function name and no arguments', async () => {
			const [, proposal] = await channel.sendInstantiateProposal({
				chaincodeType: 'node',
				chaincodeId: 'fabcar',
				chaincodeVersion: '1.0.0',
				txId
			});
			const payload = fabprotos.protos.ChaincodeProposalPayload.decode(proposal.payload);
			const input = fabprotos.protos.ChaincodeInvocationSpec.decode(payload.input);
			const args = input.chaincode_spec.input.args;
			args.should.have.lengthOf(6);
			const cds = fabprotos.protos.ChaincodeDeploymentSpec.decode(args[2]);
			cds.chaincode_spec.chaincode_id.name.should.equal('fabcar');
			cds.chaincode_spec.chaincode_id.version.should.equal('1.0.0');
			cds.chaincode_spec.input.args.should.have.lengthOf(0);
		});

		it('should send an instantiate request with a function name and no arguments', async () => {
			const [, proposal] = await channel.sendInstantiateProposal({
				chaincodeType: 'node',
				chaincodeId: 'fabcar',
				chaincodeVersion: '1.0.0',
				fcn: 'initLedger',
				txId
			});
			const payload = fabprotos.protos.ChaincodeProposalPayload.decode(proposal.payload);
			const input = fabprotos.protos.ChaincodeInvocationSpec.decode(payload.input);
			const args = input.chaincode_spec.input.args;
			args.should.have.lengthOf(6);
			const cds = fabprotos.protos.ChaincodeDeploymentSpec.decode(args[2]);
			cds.chaincode_spec.chaincode_id.name.should.equal('fabcar');
			cds.chaincode_spec.chaincode_id.version.should.equal('1.0.0');
			cds.chaincode_spec.input.args.should.have.lengthOf(1);
			cds.chaincode_spec.input.args[0].toBuffer().toString().should.equal('initLedger');
		});

		it('should send an instantiate request with no function name and some arguments', async () => {
			const [, proposal] = await channel.sendInstantiateProposal({
				chaincodeType: 'node',
				chaincodeId: 'fabcar',
				chaincodeVersion: '1.0.0',
				args: ['hello', 'world'],
				txId
			});
			const payload = fabprotos.protos.ChaincodeProposalPayload.decode(proposal.payload);
			const input = fabprotos.protos.ChaincodeInvocationSpec.decode(payload.input);
			const args = input.chaincode_spec.input.args;
			args.should.have.lengthOf(6);
			const cds = fabprotos.protos.ChaincodeDeploymentSpec.decode(args[2]);
			cds.chaincode_spec.chaincode_id.name.should.equal('fabcar');
			cds.chaincode_spec.chaincode_id.version.should.equal('1.0.0');
			cds.chaincode_spec.input.args.should.have.lengthOf(2);
			cds.chaincode_spec.input.args[0].toBuffer().toString().should.equal('hello');
			cds.chaincode_spec.input.args[1].toBuffer().toString().should.equal('world');
		});

		it('should send an instantiate request with a function name and some arguments', async () => {
			const [, proposal] = await channel.sendInstantiateProposal({
				chaincodeType: 'node',
				chaincodeId: 'fabcar',
				chaincodeVersion: '1.0.0',
				fcn: 'initLedger',
				args: ['hello', 'world'],
				txId
			});
			const payload = fabprotos.protos.ChaincodeProposalPayload.decode(proposal.payload);
			const input = fabprotos.protos.ChaincodeInvocationSpec.decode(payload.input);
			const args = input.chaincode_spec.input.args;
			args.should.have.lengthOf(6);
			const cds = fabprotos.protos.ChaincodeDeploymentSpec.decode(args[2]);
			cds.chaincode_spec.chaincode_id.name.should.equal('fabcar');
			cds.chaincode_spec.chaincode_id.version.should.equal('1.0.0');
			cds.chaincode_spec.input.args.should.have.lengthOf(3);
			cds.chaincode_spec.input.args[0].toBuffer().toString().should.equal('initLedger');
			cds.chaincode_spec.input.args[1].toBuffer().toString().should.equal('hello');
			cds.chaincode_spec.input.args[2].toBuffer().toString().should.equal('world');
		});


	});

	describe('#_verifyChaincodeRequest', () => {
		const chaincode = sinon.createStubInstance(Chaincode);

		it('should check for a request input object parameter', async () => {
			try {
				channel._verifyChaincodeRequest();
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter');
			}
			try {
				channel._verifyChaincodeRequest({});
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter "chaincode"');
			}
			try {
				chaincode.hasHash.returns(false);
				channel._verifyChaincodeRequest({chaincode: chaincode});
				should.fail();
			} catch (err) {
				err.message.should.equal('Chaincode definition must include the chaincode hash value');
			}
		});

	});

	describe('#allowChaincodeForOrg', () => {
		it('should require a request object parameter', async () => {
			try {
				await channel.allowChaincodeForOrg();
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter');
			}
		});
		it('should require a request.chaincode object parameter', async () => {
			try {
				await channel.allowChaincodeForOrg({});
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter "chaincode"');
			}
		});
		it('should require a request.chaincode._hash object parameter', async () => {
			try {
				const chaincode = client.newChaincode('mychaincode', 'v1');
				await channel.allowChaincodeForOrg({chaincode: chaincode});
				should.fail();
			} catch (err) {
				err.message.should.equal('Chaincode definition must include the chaincode hash value');
			}
		});
	});

	describe('#CommitChaincode', () => {
		it('should require a request object parameter', async () => {
			try {
				await channel.CommitChaincode();
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter');
			}
		});
		it('should require a request.chaincode object parameter', async () => {
			try {
				await channel.CommitChaincode({});
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required request parameter "chaincode"');
			}
		});
		it('should require a request.chaincode._hash object parameter', async () => {
			try {
				const chaincode = client.newChaincode('mychaincode', 'v1');
				await channel.CommitChaincode({chaincode: chaincode});
				should.fail();
			} catch (err) {
				err.message.should.equal('Chaincode definition must include the chaincode hash value');
			}
		});
	});

	describe('#sendTransactionProposal', () => {
		it('should throw if no proposal request object', () => {
			return expect(channel.sendTransactionProposal()).to.be.rejectedWith('Missing input request object on the proposal request');
		});

		it('should throw if no args in proposal request object', () => {
			return expect(channel.sendTransactionProposal({
				chaincodeId: 'blah',
				fcn: 'invoke',
				txId: 'blah'
			})).to.be.rejectedWith('Missing "args" in Transaction');
		});


		it('should throw if no chaincodeId in proposal request object', () => {
			return expect(channel.sendTransactionProposal({
				fcn: 'init',
				args: ['a', '100', 'b', '200'],
				txId: 'blah'
			})).to.be.rejectedWith('Missing "chaincodeId" parameter');
		});


		it('should throw if no txID in proposal request object', () => {
			return expect(channel.sendTransactionProposal({
				chaincodeId: 'blah',
				fcn: 'init',
				args: ['a', '100', 'b', '200']
			})).to.be.rejectedWith('Missing "txId" parameter in the proposal request');
		});

	});

	describe('Channel.sendTransactionProposal', () => {});

	describe('#sendTransaction', () => {

		it('should throw if no transaction request object', () => {
			return expect(channel.sendTransaction()).to.be.rejectedWith('Missing input request object on the transaction request');
		});

		it('should throw if proposals in request object', () => {
			return expect(channel.sendTransaction({proposalResponses: 'blah'})).to.be.rejectedWith('Missing "proposal" parameter in transaction request');
		});

		it('should throw if no proposalResponses in request object', () => {
			return expect(channel.sendTransaction({proposal: 'blah'})).to.be.rejectedWith('Missing "proposalResponses" parameter in transaction request');
		});

		it('should throw if no endorsements in request object', () => {
			return expect(channel.sendTransaction({proposal: 'blah', proposalResponses: {response: {status: 500}}})).to.be.rejectedWith('no valid endorsements found');
		});

	});

	describe('#sendSignedTransation', () => {});

	describe('#buildEnvelope', () => {});

	describe('#queryByChaincode', () => {
		const peer1Result = 'PEER1_RESULT';
		const peer2Result = 'PEER2_RESULT';
		let request;
		let spySendTransactionProposal;

		beforeEach(() => {
			sinon.stub(peer1, 'sendProposal').resolves(createTransactionResponse(Buffer.from(peer1Result)));
			sinon.stub(peer2, 'sendProposal').resolves(createTransactionResponse(Buffer.from(peer2Result)));

			spySendTransactionProposal = sinon.spy(ChannelRewire, 'sendTransactionProposal');

			request = {
				targets: [peer1, peer2],
				chaincodeId: 'chaincodeId',
				fcn: 'fcn',
				args: ['arg1', 'arg2']
			};
		});

		it('throws if no request object', () => {
			return expect(channel.queryByChaincode()).to.be.rejectedWith('Missing request object for this queryByChaincode call.');
		});

		it('throws if poorly defined request object', () => {
			return expect(channel.queryByChaincode({})).to.be.rejectedWith('"targets" parameter not specified and no peers are set on this Channel instance or specfied for this channel in the network');
		});

		it('uses supplied transaction ID', async () => {
			const txId = client.newTransactionID();
			request.txId = txId;

			await channel.queryByChaincode(request);

			sinon.assert.calledWith(spySendTransactionProposal, sinon.match.has('txId', txId));
		});

		it('creates a transaction ID if none supplied', async () => {
			await channel.queryByChaincode(request);
			sinon.assert.calledWith(spySendTransactionProposal, sinon.match.has('txId', sinon.match.instanceOf(TransactionID)));
		});

		it('returns valid peer response payloads', async () => {
			const results = await channel.queryByChaincode(request);

			const resultStrings = results.map((buffer) => buffer.toString());
			expect(resultStrings).to.have.members([peer1Result, peer2Result]);
		});

		it('returns error peer response messages', async () => {
			const errorMessage = 'ALL YOUR BASE ARE BELONG TO ME';
			peer1.sendProposal.resolves(createErrorResponse(errorMessage));
			request.targets = [peer1];

			const results = await channel.queryByChaincode(request);

			expect(results).to.have.lengthOf(1);
			const result = results[0];
			expect(result).to.be.an.instanceof(Error);
			expect(result.message).to.equal(errorMessage);
		});

		it('returns error peer response without message', async () => {
			peer1.sendProposal.resolves(createErrorResponse());
			request.targets = [peer1];

			const results = await channel.queryByChaincode(request);

			expect(results).to.have.lengthOf(1);
			const result = results[0];
			expect(result).to.be.an.instanceof(Error);
		});

		it('returns peer invocation failures', async () => {
			const peerError = new Error('peer invocation error');
			peer1.sendProposal.rejects(peerError);
			request.targets = [peer1];

			const results = await channel.queryByChaincode(request);

			expect(results).to.have.lengthOf(1);
			const result = results[0];
			expect(result).to.be.an.instanceof(Error);
			expect(result.message).to.equal(peerError.message);
		});

		it('throws if no request supplied', async () => {
			expect(channel.queryByChaincode()).to.be.rejectedWith('Missing request');
		});
	});

	describe('#_getTargetForQuery', () => {});

	describe('#_getTargetForDiscovery', () => {});

	describe('#_getTargets', () => {});

	describe('#_getOrderer', () => {

		const innerClient = new Client();
		const innerChannel = new Channel('does-not-matter', innerClient);
		const innerOrderer = new Orderer('grpc://somehost.com:1234');
		innerChannel.addOrderer(innerOrderer);

		it('should throw if no orderers assigned', () => {
			expect(() => channel._getOrderer()).to.throw(/No Orderers assigned to this channel/);
		});

		it('should throw if no named orderer assigned', () => {
			expect(() => channel._getOrderer('penguin')).to.throw(/Orderer penguin not assigned to the channel/);
		});

		it('should throw if no valid argument', () => {
			expect(() => channel._getOrderer({})).to.throw(/Orderer is not a valid orderer object instance/);
		});

		it('should return an existing orderer', () => {
			innerChannel._getOrderer().should.equal(innerOrderer);
		});


	});

	describe('#_buildEndorsementPolicy', () => {

		it('should call static Policy.buildPolicy() with passed args', () => {
			channel._buildEndorsementPolicy('myPolicy');
			sinon.assert.calledOnce(buildPolicyStub);
			const args = buildPolicyStub.getCall(0).args;
			args[0].should.deep.equal([stubMsp]);
			args[1].should.equal('myPolicy');
		});

	});

	describe('#_getProposalResponseResults', () => {});

	describe('#loadConfigGroup', () => {});

	describe('#loadConfigValue', () => {});

	describe('#sendTokenCommand(static)', () => {
		let sandbox;
		let revert;
		let _buildSignedTokenCommandStub;
		let sendTokenCommandToPeerStub;

		const channelId = 'mychannel';
		const timeout = 100;
		const mockRequest = {tokenCommand: 'x', txId: 'y'};
		const mockSignedCommand = new fabprotos.token.SignedCommand();
		const mockCommandResponse = new fabprotos.token.CommandResponse();
		const clientStub = sinon.createStubInstance(Client);
		const peerStub = sinon.createStubInstance(Peer);
		const targets = [peerStub];

		beforeEach(() => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};
			debugStub = sinon.stub(FakeLogger, 'debug');

			revert = [];
			sandbox = sinon.createSandbox();

			_buildSignedTokenCommandStub = sandbox.stub();
			sendTokenCommandToPeerStub = sandbox.stub();

			_buildSignedTokenCommandStub.returns(mockSignedCommand);
			sendTokenCommandToPeerStub.returns(mockCommandResponse);

			revert.push(ChannelRewire.__set__('Channel._buildSignedTokenCommand', _buildSignedTokenCommandStub));
			revert.push(ChannelRewire.__set__('token_utils.sendTokenCommandToPeer', sendTokenCommandToPeerStub));
			revert.push(ChannelRewire.__set__('logger', FakeLogger));
		});

		afterEach(() => {
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
			sandbox.restore();
		});

		it('should return a command response', async () => {
			const response = await ChannelRewire.sendTokenCommand(mockRequest, [peerStub], channelId, clientStub, timeout);
			expect(response).to.deep.equal(mockCommandResponse);

			sinon.assert.calledOnce(_buildSignedTokenCommandStub);
			sinon.assert.calledOnce(sendTokenCommandToPeerStub);

			sinon.assert.calledWith(_buildSignedTokenCommandStub, mockRequest, channelId, clientStub);
			sinon.assert.calledWith(sendTokenCommandToPeerStub, targets, mockSignedCommand, timeout);

			sinon.assert.calledWith(debugStub, '%s - start');
		});

		it('should throw an error if _buildSignedTokenCommand fails', async () => {
			try {
				const fakeError = new Error('forced build command error');
				_buildSignedTokenCommandStub.throws(fakeError);
				await ChannelRewire.sendTokenCommand(mockRequest, [peerStub], channelId, clientStub, timeout);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(_buildSignedTokenCommandStub);
				sinon.assert.notCalled(sendTokenCommandToPeerStub);
				err.message.should.equal('forced build command error');
			}
		});

		it('should throw an error if sendTokenCommandToPeer fails',  async () => {
			try {
				const fakeError = new Error('forced send command error');
				sendTokenCommandToPeerStub.throws(fakeError);
				await ChannelRewire.sendTokenCommand(mockRequest, [peerStub], channelId, clientStub, timeout);
				should.fail();
			} catch (err) {
				sinon.assert.calledOnce(_buildSignedTokenCommandStub);
				sinon.assert.calledOnce(sendTokenCommandToPeerStub);
				err.message.should.equal('forced send command error');
			}
		});
	});

	describe('#sendTokenCommand', () => {
		let sandbox;
		let revert;
		let mockRequest;
		let _getTargetsStub;
		let staticSendTokenCommandStub;

		const channelId = 'mychannel';
		const timeout = 100;
		const mockCommandResponse = new fabprotos.token.CommandResponse();
		const mockTargets = [sinon.createStubInstance(Peer)];
		const clientStub = sinon.createStubInstance(Client);

		beforeEach(() => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};
			debugStub = sinon.stub(FakeLogger, 'debug');

			revert = [];
			sandbox = sinon.createSandbox();

			staticSendTokenCommandStub = sandbox.stub();
			staticSendTokenCommandStub.returns(mockCommandResponse);

			// create channel instance
			channel = new ChannelRewire(channelId, clientStub);

			revert.push(ChannelRewire.__set__('Channel.sendTokenCommand', staticSendTokenCommandStub));
			revert.push(ChannelRewire.__set__('logger', FakeLogger));

			mockRequest = {tokenCommand: 'a', txId: 'b', targets: mockTargets};
		});

		afterEach(() => {
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
			sandbox.restore();
		});

		it('should return a command response when request has targets', async () => {
			const response = await channel.sendTokenCommand(mockRequest, timeout);
			expect(response).to.deep.equal(mockCommandResponse);

			sinon.assert.calledOnce(staticSendTokenCommandStub);

			sinon.assert.calledWith(staticSendTokenCommandStub, mockRequest, mockTargets, channelId, clientStub, timeout);
			sinon.assert.calledWith(debugStub, '%s - start');
		});

		it('should return a command response when request has no targets', async () => {
			// undefine mockRequest.targets and create _getTargetsStub
			mockRequest.targets = undefined;
			_getTargetsStub = sinon.stub(channel, '_getTargets');
			_getTargetsStub.returns(mockTargets);

			const response = await channel.sendTokenCommand(mockRequest, timeout);
			expect(response).to.deep.equal(mockCommandResponse);

			sinon.assert.calledOnce(_getTargetsStub);
			sinon.assert.calledOnce(staticSendTokenCommandStub);

			sinon.assert.calledWith(_getTargetsStub, undefined, Constants.NetworkConfig.PROVER_PEER_ROLE);
			sinon.assert.calledWith(staticSendTokenCommandStub, mockRequest, mockTargets, channelId, clientStub, timeout);
			sinon.assert.calledWith(debugStub, '%s - start');
		});

		it('should throw an error if request is mssing', async () => {
			try {
				mockRequest.tokenTransaction = undefined;
				await channel.sendTokenCommand();
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "request" parameter on the sendTokenCommand call');
			}
		});

		it('should throw an error if request.txId is mssing', async () => {
			try {
				mockRequest.txId = undefined;
				await channel.sendTokenCommand(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "txId" in request on the sendTokenCommand call');
			}
		});

		it('should throw an error if request.tokenCommand is mssing', async () => {
			try {
				mockRequest.tokenCommand = undefined;
				await channel.sendTokenCommand(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "tokenCommand" in request on the sendTokenCommand call');
			}
		});

		it('should throw an error if getTargets fails', async () => {
			try {
				const fakeError = new Error('forced get targets error');
				sinon.stub(channel, '_getTargets').throws(fakeError);
				await channel.sendTokenCommand(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced get targets error');
			}
		});

		it('should throw an error if staticSendTokenCommandStub fails', async () => {
			try {
				const fakeError = new Error('forced static send command error');
				staticSendTokenCommandStub.throws(fakeError);
				await channel.sendTokenCommand(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced static send command error');
			}
		});
	});

	describe('#sendTokenTransaction', () => {
		let sandbox;
		let revert;
		let clientStub;
		let ordererStub;
		let txIdStub;
		let _buildTokenTxEnvelopeStub;
		let mockRequest;

		const channelId = 'mychannel';
		const timeout = 100;
		const isAdmin = false;
		const mockEnvelope = new fabprotos.common.Envelope();
		const mockResponse = {status: 'SUCCESS'};
		const signingIdentityStub = sinon.createStubInstance(SigningIdentity);

		beforeEach(() => {
			const FakeLogger = {
				debug : () => {},
				error: () => {}
			};
			debugStub = sinon.stub(FakeLogger, 'debug');

			revert = [];
			sandbox = sinon.createSandbox();

			// prepare stubs
			_buildTokenTxEnvelopeStub = sandbox.stub();
			_buildTokenTxEnvelopeStub.returns(mockEnvelope);
			revert.push(ChannelRewire.__set__('Channel._buildTokenTxEnvelope', _buildTokenTxEnvelopeStub));
			revert.push(ChannelRewire.__set__('logger', FakeLogger));

			ordererStub = sinon.createStubInstance(Orderer);
			ordererStub.sendBroadcast.returns(mockResponse);

			clientStub = sinon.createStubInstance(Client);
			clientStub._getSigningIdentity.returns(signingIdentityStub);
			clientStub.getTargetOrderer.returns(ordererStub);

			// create channel instance
			channel = new ChannelRewire(channelId, clientStub);

			// prepare mockRequest
			txIdStub = sinon.createStubInstance(TransactionID);
			txIdStub.isAdmin.returns(isAdmin);
			mockRequest = {tokenTransaction: 'x', txId: txIdStub};
		});

		afterEach(() => {
			if (revert.length) {
				revert.forEach(Function.prototype.call, Function.prototype.call);
			}
			sandbox.restore();
		});

		it('should return a response with SUCCESS status', async () => {
			sinon.spy(channel._clientContext._getSigningIdentity);
			sinon.spy(channel._clientContext.getTargetOrderer);
			sinon.spy(ordererStub.sendBroadcast);

			const response = await channel.sendTokenTransaction(mockRequest, timeout);
			expect(response.status).to.deep.equal('SUCCESS');

			sinon.assert.calledOnce(_buildTokenTxEnvelopeStub);
			sinon.assert.calledWith(_buildTokenTxEnvelopeStub, mockRequest, channelId, clientStub, signingIdentityStub, isAdmin);
			sinon.assert.calledWith(channel._clientContext._getSigningIdentity, isAdmin);
			sinon.assert.calledWith(ordererStub.sendBroadcast, mockEnvelope, timeout);
			sinon.assert.calledWith(debugStub, '%s - start');
		});

		it('should throw an error if request is mssing', async () => {
			try {
				mockRequest.tokenTransaction = undefined;
				await channel.sendTokenTransaction();
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "request" parameter on the sendTokenTransaction call');
			}
		});

		it('should throw an error if request.txId is mssing', async () => {
			try {
				mockRequest.txId = undefined;
				await channel.sendTokenTransaction(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "txId" in request on the sendTokenTransaction call');
			}
		});

		it('should throw an error if request.tokenTransaction is mssing', async () => {
			try {
				mockRequest.tokenTransaction = undefined;
				await channel.sendTokenTransaction(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('Missing required "tokenTransaction" in request on the sendTokenTransaction call');
			}
		});

		it('should throw an error if _buildTokenTxEnvelope throws an error', async () => {
			try {
				const fakeError = new Error('forced build envelope error');
				_buildTokenTxEnvelopeStub.throws(fakeError);
				await channel.sendTokenTransaction(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced build envelope error');
			}
		});

		it('should throw an error if client getTargetOrderer throws an error', async () => {
			try {
				const fakeError = new Error('forced get orderer error');
				clientStub.getTargetOrderer.throws(fakeError);
				await channel.sendTokenTransaction(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced get orderer error');
			}
		});

		it('should throw an error if order sendBroadcast throws an error', async () => {
			try {
				const fakeError = new Error('forced send broadcast error');
				ordererStub.sendBroadcast.throws(fakeError);
				await channel.sendTokenTransaction(mockRequest, timeout);
				should.fail();
			} catch (err) {
				err.message.should.equal('forced send broadcast error');
			}
		});
	});

	describe('#_buildSignedTokenCommand', () => {
		let clientStub;
		let signingIdentityStub;
		let txIdStub;
		let request;
		let command;

		const channelId = 'mychannel';
		const signature = Buffer.from('command-signature');
		const serializedCreator = Buffer.from('serialized-creator');
		const nonce = Buffer.from('txid-nonce');
		const clientCertHash = Buffer.from('');

		beforeEach(() => {
			// create stubs to return mock data
			signingIdentityStub = sinon.createStubInstance(SigningIdentity);
			signingIdentityStub.sign.returns(signature);
			signingIdentityStub.serialize.returns(serializedCreator);

			clientStub = sinon.createStubInstance(Client);
			clientStub._getSigningIdentity.returns(signingIdentityStub);
			clientStub.getClientCertHash.returns(clientCertHash);

			txIdStub = sinon.createStubInstance(TransactionID);
			txIdStub.getNonce.returns(nonce);

			// create token command request
			command = new fabprotos.token.Command();
			const importRequest = new fabprotos.token.ImportRequest();
			command.set('import_request', importRequest);
			request = {tokenCommand: command, txId: txIdStub};
		});

		it('should return a signed command', () => {
			const signedCommand = Channel._buildSignedTokenCommand(request, channelId, clientStub);

			// verify signature
			expect(signedCommand.signature.toBuffer()).to.deep.equal(signature);

			// decode it first so that we can get timestamp since it is dynamic value
			const decodedCommand = fabprotos.token.Command.decode(signedCommand.command);

			// construct expected header and copy timestamp from decoded command
			const expectedHeader = new fabprotos.token.Header();
			expectedHeader.setChannelId(channelId);
			expectedHeader.setCreator(serializedCreator);
			expectedHeader.setNonce(nonce);
			expectedHeader.setTlsCertHash(clientCertHash);
			expectedHeader.timestamp = decodedCommand.header.timestamp;

			// verify command (including header)
			command.header = expectedHeader;
			expect(decodedCommand.toBuffer()).to.deep.equal(command.toBuffer());
		});

		it('should throw an error if signingIndentity fails to sign', () => {
			(() => {
				const fakeError = new Error('forced sign error');
				signingIdentityStub.sign.throws(fakeError);
				Channel._buildSignedTokenCommand(request, channelId, clientStub);
			}).should.throw(Error, 'forced sign error');
		});

		it('should throw an error if signingIndentity fails to serialize', () => {
			(() => {
				const fakeError = new Error('forced serialize error');
				signingIdentityStub.serialize.throws(fakeError);
				Channel._buildSignedTokenCommand(request, channelId, clientStub);
			}).should.throw(Error, 'forced serialize error');
		});
	});

	describe('#_buildTokenTxEnvelope', () => {
		let clientStub;
		let signingIdentityStub;
		let txIdStub;
		let request;
		let tokenTx;

		const channelId = 'mychannel';
		const signature = Buffer.from('command-signature');
		const serializedCreator = Buffer.from('serialized-creator');
		const nonce = Buffer.from('txid-nonce');
		const clientCertHash = Buffer.from('');

		beforeEach(() => {
			// create stubs to return mock data
			signingIdentityStub = sinon.createStubInstance(SigningIdentity);
			signingIdentityStub.sign.returns(signature);
			signingIdentityStub.serialize.returns(serializedCreator);

			clientStub = sinon.createStubInstance(Client);
			clientStub._getSigningIdentity.returns(signingIdentityStub);
			clientStub.getClientCertHash.returns(clientCertHash);

			txIdStub = sinon.createStubInstance(TransactionID);
			txIdStub.getNonce.returns(nonce);
			txIdStub.getTransactionID.returns('mock-txid');

			// prepare token transaction request
			tokenTx = new fabprotos.token.TokenTransaction();
			tokenTx.set('plain_action', new fabprotos.token.PlainTokenAction());
			request = {tokenTransaction: tokenTx, txId: txIdStub};
		});

		it('should return a signed envelope', () => {
			const envelope = Channel._buildTokenTxEnvelope(request, channelId, clientStub, signingIdentityStub, false);
			const payload = fabprotos.common.Payload.decode(envelope.payload);

			// verify signature
			expect(envelope.signature.toBuffer()).to.deep.equal(signature);

			// verify payload has correct token transaction
			expect(payload.data.toBuffer()).to.deep.equal(tokenTx.toBuffer());

			// verify channel header
			const expectedChannelHeader = new fabprotos.common.ChannelHeader();
			expectedChannelHeader.setType(fabprotos.common.HeaderType.TOKEN_TRANSACTION);
			expectedChannelHeader.setVersion(1);
			expectedChannelHeader.setChannelId(channelId);
			expectedChannelHeader.setTxId('mock-txid');
			expectedChannelHeader.setTlsCertHash(clientCertHash);

			// update expectedChannelHeader with timestamp
			const channelHeader = fabprotos.common.ChannelHeader.decode(payload.header.channel_header);
			expectedChannelHeader.timestamp = channelHeader.timestamp;

			// verify channel header
			expect(channelHeader.toBuffer()).to.deep.equal(expectedChannelHeader.toBuffer());

			// verify signature header
			const expectedSignatureHeader = new fabprotos.common.SignatureHeader();
			expectedSignatureHeader.setCreator(serializedCreator);
			expectedSignatureHeader.setNonce(nonce);
			expect(payload.header.signature_header.toBuffer()).to.deep.equal(expectedSignatureHeader.toBuffer());
		});

		it('should throw an error if signingIndentity fails to sign', () => {
			(() => {
				const fakeError = new Error('forced sign error');
				signingIdentityStub.sign.throws(fakeError);
				Channel._buildTokenTxEnvelope(request, channelId, clientStub, signingIdentityStub, false);
			}).should.throw(Error, 'forced sign error');
		});

		it('should throw an error if signingIndentity fails to serialize', () => {
			(() => {
				const fakeError = new Error('forced serialize error');
				signingIdentityStub.serialize.throws(fakeError);
				Channel._buildTokenTxEnvelope(request, channelId, clientStub, signingIdentityStub, false);
			}).should.throw(Error, 'forced serialize error');
		});
	});
});

describe('ChannelPeer', () => {
	let ChannelPeer;
	let peer;
	let channel;
	let eventHub;
	let instance;
	beforeEach(() => {
		ChannelPeer = ChannelRewire.__get__('ChannelPeer');
		peer = sinon.createStubInstance(Peer);
		peer.getName.returns('peerName');
		peer.getUrl.returns('http://someurl');
		channel = sinon.createStubInstance(Channel);
		eventHub = sinon.createStubInstance(ChannelEventHub);
		instance = new ChannelPeer('mspId', channel, peer);
		instance._channel_event_hub = eventHub;
	});

	describe('#constructor', () => {
		it('should throw an error if the channel parameter is missing', () => {
			(() => {
				new ChannelPeer('mspid');
			}).should.throw(Error, 'Missing Channel parameter');
		});

		it('should throw an error if the peer parameter is missing', () => {
			(() => {
				new ChannelPeer('mspid', sinon.createStubInstance(Channel));
			}).should.throw(Error, 'Missing Peer parameter');
		});

		it('should set the correct class properties', () => {
			const channelStub = sinon.createStubInstance(Channel);
			const peerStub = sinon.createStubInstance(Peer);
			peerStub.getName.returns('peerName');
			const channelPeer = new ChannelPeer('mspId', channelStub, peerStub);
			channelPeer._mspid.should.equal('mspId');
			channelPeer._name.should.equal('peerName');
			channelPeer._channel.should.equal(channelStub);
			channelPeer._peer.should.equal(peerStub);
			channelPeer._roles.should.deep.equal({});
		});

		it('should set the correct roles', () => {
			const channelStub = sinon.createStubInstance(Channel);
			const peerStub = sinon.createStubInstance(Peer);
			peerStub.getName.returns('peerName');
			const channelPeer = new ChannelPeer('mspId', channelStub, peerStub, {'role1': 'role1'});
			channelPeer._roles.should.deep.equal({role1: 'role1'});
		});
	});

	describe('#close', () => {
		it('should close the peer connection', () => {
			instance._channel_event_hub = null;
			instance.close();
			sinon.assert.called(peer.close);
		});

		it('should close the connection to the event hub', () => {
			instance.close();
			sinon.assert.called(instance._channel_event_hub.close);
		});
	});

	describe('#getMspId', () => {
		it('should return the mspid', () => {
			instance.getMspid().should.equal('mspId');
		});
	});

	describe('#getName', () => {
		it('should return the name', () => {
			instance.getName().should.equal('peerName');
		});
	});

	describe('#getUrl', () => {
		it('should return the peer url', () => {
			instance.getUrl().should.equal('http://someurl');
		});
	});

	describe('#setRole', () => {
		it('should set a role', () => {
			instance.setRole('aSetRole', 'theRole');
			instance._roles.should.deep.equal({aSetRole: 'theRole'});
		});
	});

	describe('#isInRole', () => {
		it('should throw an error if no role is given', () => {
			(() => {
				instance.isInRole();
			}).should.throw(Error, 'Missing "role" parameter');
		});

		it('should return true if role not found', () => {
			instance.isInRole('someRole').should.be.true;
		});

		it('should return the role if found', () => {
			instance._roles = {someRole: 'theRole'};
			instance.isInRole('someRole').should.equal('theRole');
		});
	});

	describe('#isInOrg', () => {
		it('should return true if no mspId is given', () => {
			instance._mspid = null;
			instance.isInOrg().should.be.true;
		});

		it('should check if the mspid matches', () => {
			instance.isInOrg('mspId').should.be.true;
		});
	});

	describe('#getChannelEventHub', () => {
		it('should return the event hub if it is set', () => {
			instance.getChannelEventHub().should.equal(eventHub);
		});

		it('should create a new event hub if one is not set', () => {
			instance._channel_event_hub = null;
			const newEventHub = instance.getChannelEventHub();
			newEventHub.should.be.instanceof(ChannelEventHub);
			newEventHub._channel.should.equal(channel);
			newEventHub._peer.should.equal(peer);
		});
	});

	describe('#getPeer', () => {
		it('should return the peer', () => {
			instance.getPeer().should.equal(peer);
		});
	});

	describe('#sendProposal', () => {
		it('should return the proposal request', () => {
			peer.sendProposal.returns('proposal');
			instance.sendProposal('proposal', 'request').should.equal('proposal');
			sinon.assert.calledWith(peer.sendProposal, 'proposal', 'request');
		});
	});

	describe('#sendDiscovery', () => {
		it('should return the discovery request', () => {
			peer.sendDiscovery.returns('discovery');
			instance.sendDiscovery('request', 'timeout').should.equal('discovery');
			sinon.assert.calledWith(peer.sendDiscovery, 'request', 'timeout');
		});
	});

	describe('#toString', () => {
		it('should call peer.toString', () => {
			instance.toString();
			sinon.assert.called(peer.toString);
		});
	});
});
