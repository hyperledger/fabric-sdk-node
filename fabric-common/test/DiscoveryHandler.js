/**
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-throw-literal */

const rewire = require('rewire');
const DiscoveryHandler = rewire('../lib/DiscoveryHandler');
const Client = rewire('../lib/Client');

const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');
const Long = require('long');

const TestUtils = require('./TestUtils');

describe('DiscoveryHandler', () => {
	TestUtils.setCryptoConfigSettings();

	let FakeLogger;
	let revert;
	let sandbox;
	const client = new Client('myclient');
	client._tls_mutual.clientCertHash = Buffer.from('clientCertHash');
	let channel;
	let discovery;
	let discoveryHandler;
	let endorsement_plan;

	const tmpSetDelete = Set.prototype.delete;

	// const pem = '-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n';
	const org1 = [
		'Org1MSP',
		'peer1.org1.example.com:7001',
		'peer2.org1.example.com:7002'
	];
	const org2 = [
		'Org2MSP',
		'peer1.org2.example.com:8001',
		'peer2.org2.example.com:8002'
	];
	const org3 = [
		'Org3MSP',
		'peer1.org3.example.com:9001',
		'peer2.org3.example.com:9002',
		'peer3.org3.example.com:9003'
	];

	const chaincodes = [{name: 'example', version: 'v2'}];
	const highest = Long.fromValue(200);
	const ledger_height = Long.fromValue(100);
	const smaller = Long.fromValue(10);
	const endorsement_plan_template = {
		plan_id: 'example',
		groups: {
			G0: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledger_height, chaincodes, name: org1[2]}
				]
			},
			G1: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledger_height, chaincodes, name: org2[2]}
				]
			},
			G3: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledger_height, chaincodes, name: org1[2]},
					{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledger_height, chaincodes, name: org2[2]},
					{mspid: org3[0], endpoint: org3[1], ledger_height, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledger_height: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledger_height: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{G0: 1, G1: 1}, {G3: 3, G1: 1}]
	};

	/*
	const discovery_plan = {
		msps: {
			OrdererMSP: {
				id: 'OrdererMSP',
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tls_intermediate_certs: ''
			},
			Org2MSP: {
				id: org2[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tls_intermediate_certs: ''
			},
			Org1MSP: {
				id: org1[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tls_intermediate_certs: ''
			},
			Org3MSP: {
				id: org3[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tls_intermediate_certs: ''
			},
		},
		orderers: {
			Org1MSP: {endpoints: [{host: 'orderer.org1.example.com', port: 7150, name: 'orderer.org1.example.com'}]},
			Org2MSP: {endpoints: [{host: 'orderer.org2.example.com', port: 7150, name: 'orderer.org2.example.com'}]},
			Org3MSP: {endpoints: [{host: 'orderer.org3.example.com', port: 7150, name: 'orderer.org3.example.com'}]}
		},
		peers_by_org: {
			Org1MSP: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledger_height, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledger_height, chaincodes, name: org1[2]}
				]
			},
			Org2MSP: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledger_height, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledger_height, chaincodes, name: org2[2]}
				]
			},
			Org3MSP: {
				peers: [
					{mspid: org3[0], endpoint: org3[1], ledger_height, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledger_height, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledger_height, chaincodes, name: org3[3]}
				]
			}
		},
		endorsement_plan: endorsement_plan
	};
	*/

	const good = {response: {status: 200}};
	beforeEach(() => {
		revert = [];
		sandbox = sinon.createSandbox();

		FakeLogger = {
			debug: () => {
			},
			error: () => {
			},
			warn: () => {
			}
		};
		sandbox.stub(FakeLogger);
		revert.push(DiscoveryHandler.__set__('logger', FakeLogger));

		channel = client.newChannel('mychannel');
		const peer11 = client.newEndorser(org1[1], org1[0]);
		peer11.sendProposal = sandbox.stub().resolves(good);
		peer11.connected = true;
		channel.addEndorser(peer11);
		const peer12 = client.newEndorser(org1[2], org1[0]);
		peer12.sendProposal = sandbox.stub().resolves(good);
		peer12.connected = true;
		channel.addEndorser(peer12);

		const peer21 = client.newEndorser(org2[1], org2[0]);
		peer21.sendProposal = sandbox.stub().resolves(good);
		peer21.connected = true;
		channel.addEndorser(peer21);
		const peer22 = client.newEndorser(org2[2], org2[0]);
		peer22.sendProposal = sandbox.stub().resolves(good);
		peer22.connected = true;
		channel.addEndorser(peer22);

		const peer31 = client.newEndorser(org3[1], org3[0]);
		peer31.sendProposal = sandbox.stub().resolves(good);
		peer31.connected = true;
		channel.addEndorser(peer31);
		const peer32 = client.newEndorser(org3[2], org3[0]);
		peer32.sendProposal = sandbox.stub().resolves(good);
		peer32.connected = true;
		channel.addEndorser(peer32);
		const peer33 = client.newEndorser(org3[3], org3[0]);
		peer33.sendProposal = sandbox.stub().resolves(good);
		peer33.connected = true;
		channel.addEndorser(peer33);

		const orderer1 = client.newCommitter('orderer1', 'msp1');
		orderer1.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer1.connected = true;
		channel.addCommitter(orderer1);

		const orderer2 = client.newCommitter('orderer2', 'msp2');
		orderer2.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer2.connected = true;
		channel.addCommitter(orderer2);

		const orderer3 = client.newCommitter('orderer3', 'msp1');
		orderer3.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer3.connected = true;
		channel.addCommitter(orderer3);

		discovery = channel.newDiscoveryService('mydiscovery');
		discovery.getDiscoveryResults = sandbox.stub().resolves({});
		discoveryHandler = new DiscoveryHandler(discovery);

		endorsement_plan = JSON.parse(JSON.stringify(endorsement_plan_template));

	});

	afterEach(() => {
		if (revert.length) {
			revert.forEach(Function.prototype.call, Function.prototype.call);
		}
		sandbox.restore();
		Set.prototype.delete = tmpSetDelete;
	});

	describe('#constructor', () => {
		it('should log on entry', () => {
			new DiscoveryHandler();
			sinon.assert.calledWith(FakeLogger.debug, 'DiscoveryHandler.constructor - start');
		});
		it('should create and have these settings', () => {
			const dh = new DiscoveryHandler('discovery');
			dh.discovery.should.equal('discovery');
		});
	});

	describe('#toString', () => {
		it('should run', () => {
			const output = discoveryHandler.toString();
			output.should.equal('{type:DiscoveryHandler, discoveryService:mydiscovery}');
		});
	});

	describe('#query', () => {
		it('should reject if signedProposal arg is not given', async () => {
			await discoveryHandler.query().should.be.rejectedWith(/Missing signedProposal parameter/);
		});
		it('should reject if endorsers are missing', async () => {
			await discoveryHandler.query('signedProposal', {mspid: 'msp3'}).should.be.rejectedWith(/No endorsers assigned to the channel/);
		});
		it('should run with endorsers assigned by mspid', async () => {
			const results = await discoveryHandler.query('signedProposal', {mspid: 'Org1MSP'});
			results[0].should.deep.equal(good);
			results[1].should.deep.equal(good);
		});
		it('should run with endorsers assigned', async () => {
			const results = await discoveryHandler.query('signedProposal');
			results[0].should.deep.equal(good);
			results[1].should.deep.equal(good);
			results[2].should.deep.equal(good);
		});
		it('should run with endorsers assigned', async () => {
			const error = Error('FAILED');
			channel.getEndorser(org1[1]).sendProposal = sandbox.stub().rejects(error);
			const results = await discoveryHandler.query('signedProposal', {requestTimeout: 2000});
			results[0].should.deep.equal(error);
			results[1].should.deep.equal(good);
			results[2].should.deep.equal(good);
		});
	});

	describe('#commit', () => {
		it('should reject if signedEnvelope arg is not given', async () => {
			await discoveryHandler.commit().should.be.rejectedWith(/Missing signedEnvelope parameter/);
		});
		it('should reject if orderers are missing', async () => {
			await discoveryHandler.commit('signedEnvelope', {mspid: 'msp3'}).should.be.rejectedWith(/No committers assigned to the channel/);
		});
		it('should run with orderers assigned by mspid', async () => {
			const results = await discoveryHandler.commit('signedEnvelope', {mspid: 'msp1', requestTimeout: 2000});
			results.status.should.equal('SUCCESS');
		});
		it('should run with orderers assigned', async () => {
			const results = await discoveryHandler.commit('signedEnvelope');
			results.status.should.equal('SUCCESS');
		});
		it('should run with orderers assigned', async () => {
			const results = await discoveryHandler.commit('signedEnvelope');
			results.status.should.equal('SUCCESS');
		});
		it('should reject orderer returns missing results', async () => {
			channel.removeCommitter(channel.getCommitter('orderer2'));
			channel.removeCommitter(channel.getCommitter('orderer3'));
			channel.getCommitter('orderer1').sendBroadcast = sandbox.stub().resolves();
			await discoveryHandler.commit('signedEnvelope')
				.should.be.rejectedWith(/Failed to send transaction to the committer/);
		});
		it('should reject when status is not correct', async () => {
			channel.getCommitter('orderer2').sendBroadcast = sandbox.stub().resolves({status: 'FAILED'});
			await discoveryHandler.commit('signedEnvelope', {mspid: 'msp2'})
				.should.be.rejectedWith(/Failed to send transaction successfully to the committer status:FAILED/);
		});
		it('should reject when orderer returns an error', async () => {
			channel.getCommitter('orderer2').sendBroadcast = sandbox.stub().rejects(new Error('FAILED with Error'));
			await discoveryHandler.commit('signedEnvelope', {mspid: 'msp2'})
				.should.be.rejectedWith(/FAILED with Error/);
		});
	});

	describe('#endorse', () => {
		it('should reject if signedProposal arg is not given', async () => {
			await discoveryHandler.endorse().should.be.rejectedWith(/Missing signedProposal parameter/);
		});
		it('should reject if no endorsement plans are available', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves();
			await discoveryHandler.endorse('signedProposal').should.be.rejectedWith(/No endorsement plan available/);
		});
		it('should run ok', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._endorse = sandbox.stub().resolves('DONE');
			const results = await discoveryHandler.endorse('signedProposal', {requestTimeout: 2000});
			results.should.equal('DONE');
		});
	});

	describe('#_endorse', () => {
		it('should reject if endorsement_plan arg is not given', async () => {
			await discoveryHandler._endorse().should.be.rejectedWith(/Missing endorsement_plan parameter/);
		});
		it('should reject if proposal arg is not given', async () => {
			await discoveryHandler._endorse('something').should.be.rejectedWith(/Missing proposal parameter/);
		});
		it('should reject if preferred height gap not a number', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves();
			await discoveryHandler._endorse({}, {preferredHeightGap: 'a'}, 'proposal').should.be.rejectedWith(/preferred_height_gap setting is not a number/);
		});
		it('should reject if sort is not valid', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves();
			await discoveryHandler._endorse({}, {sort: 'unknown'}, 'proposal').should.be.rejectedWith(/sort parameter is not valid/);
		});
		it('should run ok', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._modify_groups = sinon.stub();
			discoveryHandler._getRandom = sinon.stub().returns([{}]);
			discoveryHandler._endorse_layout = sandbox.stub().resolves({
				success: true,
				endorsements: 'endorsements'
			});
			const results = await discoveryHandler._endorse({}, {preferredHeightGap: 0}, 'proposal');
			results.should.equal('endorsements');
		});
		it('should run ok', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._modify_groups = sinon.stub();
			discoveryHandler._getRandom = sinon.stub().returns([{}]);
			discoveryHandler._endorse_layout = sandbox.stub().resolves({
				success: false,
				endorsements: ['failed-endorsements']
			});
			const results = await discoveryHandler._endorse({}, {sort: 'ledgerHeight'}, 'proposal');
			results[0].endorsements[0].should.equal('failed-endorsements');
		});
		it('should run ok', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._modify_groups = sinon.stub();
			discoveryHandler._getRandom = sinon.stub().returns([{}]);
			discoveryHandler._endorse_layout = sandbox.stub().resolves({
				success: false,
				endorsements: ['failed-endorsements']
			});
			const results = await discoveryHandler._endorse({}, {sort: 'random'}, 'proposal');
			results[0].endorsements[0].should.equal('failed-endorsements');
		});
	});

	describe('#_endorse_layout', () => {
		it('should run ok', async () => {
			discoveryHandler._build_endorse_group_member = sinon.stub().returns({});
			discoveryHandler._execute_endorsements = sandbox.stub().resolves([{success: true}, {success: true}]);
			// TEST CALL
			const results = await discoveryHandler._endorse_layout(
				0,
				endorsement_plan,
				'proposal',
				2000
			);
			results.success.should.equal(true);
		});
		it('should get false due to required count too large', async () => {
			endorsement_plan.layouts[0].G0 = 3;
			// TEST CALL
			const results = await discoveryHandler._endorse_layout(
				0,
				endorsement_plan,
				'proposal',
				2000
			);
			results.success.should.equal(false);
		});
		it('should get false due to endorsement failure', async () => {
			discoveryHandler._build_endorse_group_member = sinon.stub().returns({});
			discoveryHandler._execute_endorsements = sandbox.stub().resolves([{success: true}, {success: false}]);
			// TEST CALL
			const results = await discoveryHandler._endorse_layout(
				0,
				endorsement_plan,
				'proposal',
				2000
			);
			results.success.should.equal(false);
		});
		it('should get false due to endorsement Error', async () => {
			discoveryHandler._build_endorse_group_member = sinon.stub().returns({});
			discoveryHandler._execute_endorsements = sandbox.stub().resolves([{success: true}, new Error('FAILED')]);
			// TEST CALL
			const results = await discoveryHandler._endorse_layout(
				0,
				endorsement_plan,
				'proposal',
				2000
			);
			results.success.should.equal(false);
		});
	});

	describe('#_execute_endorsements', () => {
		it('should run ok', async () => {
			const endorser_processes = [
				{success: true},
				{success: true},
				{success: true}
			];
			// TEST CALL
			const results = await discoveryHandler._execute_endorsements(
				endorser_processes
			);
			results[0].success.should.equal(true);
		});
		it('should run ok, but log an error', async () => {
			const endorser_processes = [
				{success: true},
				{success: true},
				Error('FAKE')
			];
			// TEST CALL
			const results = await discoveryHandler._execute_endorsements(
				endorser_processes
			);
			results[0].success.should.equal(true);
			results[2].should.be.instanceof(Error);
			sinon.assert.calledWith(FakeLogger.debug, '%s - endorsement failed: %s');
		});
	});

	describe('#_build_endorse_group_member', () => {
		it('should run ok', async () => {
			endorsement_plan.endorsements = {};
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.response.status.should.equal(200);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start', '_build_endorse_group_member >> G0:0');
		});
		it('should run ok and return error when endorser rejects', async () => {
			endorsement_plan.endorsements = {};
			channel.getEndorser(org1[1]).sendProposal = sandbox.stub().rejects(Error('FAILED'));
			channel.getEndorser(org1[2]).sendProposal = sandbox.stub().rejects(Error('FAILED'));
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.message.should.equal('FAILED');
			sinon.assert.called(channel.getEndorser(org1[1]).sendProposal);
			sinon.assert.called(channel.getEndorser(org1[2]).sendProposal);
			sinon.assert.calledWith(FakeLogger.error, '%s - error on endorsement to %s error %s');
		});
		it('should run ok when endorser failed on last layout', async () => {
			endorsement_plan.endorsements = {};
			endorsement_plan.endorsements[org1[1]] = Error('FAILED BEFORE');
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.response.status.should.equal(200);
			sinon.assert.notCalled(channel.getEndorser(org1[1]).sendProposal);
			sinon.assert.called(channel.getEndorser(org1[2]).sendProposal);
			sinon.assert.calledWith(FakeLogger.debug, '%s - existing peer %s endorsement will be used');
		});
		it('should run ok when endorser failed on last layout', async () => {
			endorsement_plan.endorsements = {};
			endorsement_plan.endorsements[org1[1]] = {response: {status: 200}};
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.response.status.should.equal(200);
			sinon.assert.notCalled(channel.getEndorser(org1[1]).sendProposal);
			sinon.assert.notCalled(channel.getEndorser(org1[2]).sendProposal);
			sinon.assert.calledWith(FakeLogger.debug, '%s - existing peer %s endorsement will be used');
		});
		it('should run ok when endorser failed on last layout', async () => {
			endorsement_plan.endorsements = {};
			endorsement_plan.groups.G0.peers[0].in_use = true;
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.response.status.should.equal(200);
			sinon.assert.notCalled(channel.getEndorser(org1[1]).sendProposal);
			sinon.assert.called(channel.getEndorser(org1[2]).sendProposal);
			sinon.assert.calledWith(FakeLogger.debug, '%s - peer in use %s');
		});
		it('should run ok when no endorsement found', async () => {
			endorsement_plan.endorsements = {};
			channel.removeEndorser(channel.getEndorser(org1[1]));
			endorsement_plan.groups.G0.peers[1].in_use = true;
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.message.should.equal('No endorsement available');
			sinon.assert.notCalled(channel.getEndorser(org1[2]).sendProposal);
			sinon.assert.calledWith(FakeLogger.error, '%s - returning an error endorsement, no endorsement made');
			sinon.assert.calledWith(FakeLogger.debug, '%s - peer %s not assigned to this channel');
		});
	});

	describe('#_modify_groups', () => {
		const peer1 = {mspid: 'org1', name: 'peer1', ledger_height: {low: 5, high: 0}};
		const peer2 = {mspid: 'org1', name: 'peer2', ledger_height: {low: 8, high: 0}};
		const peer3 = {mspid: 'org1', name: 'peer3', ledger_height: {low: 10, high: 0}};
		const peer4 = {mspid: 'org2', name: 'peer4', ledger_height: {low: 5, high: 0}};
		const peer5 = {mspid: 'org2', name: 'peer5', ledger_height: {low: 8, high: 0}};
		const peer6 = {mspid: 'org2', name: 'peer6', ledger_height: {low: 10, high: 0}};
		let plan;

		beforeEach(() => {
			plan = {groups:{
				G0: {peers: [peer1, peer2, peer3]},
				G1: {peers: [peer4, peer5, peer6]}}
			};
		});

		it('should run ok', async () => {
			discoveryHandler._modify_groups(
				new Map(), // required
				new Map(), // preferred
				new Map(), // ignored
				new Map(), // required_orgs
				new Map(), // preferred_orgs
				new Map(), // ignored_orgs
				new Long(1), // preferred_height_gap
				'default', // sort
				plan // endorsement_plan
			);
			should.equal(plan.groups.G0.peers.length, 3);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start');
		});
		it('should run ok with no ledger_height_gap', async () => {
			discoveryHandler._modify_groups(
				new Map(), // required
				new Map(), // preferred
				new Map(), // ignored
				new Map(), // required_orgs
				new Map(), // preferred_orgs
				new Map(), // ignored_orgs
				null, // preferred_height_gap
				'default', // sort
				plan // endorsement_plan
			);
			should.equal(plan.groups.G0.peers.length, 3);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start');
		});
		it('should convert ledger_height', async () => {
			discoveryHandler._modify_groups(
				new Map(), // required
				new Map(), // preferred
				new Map(), // ignored
				new Map(), // required_orgs
				new Map(), // preferred_orgs
				new Map(), // ignored_orgs
				null, // preferred_height_gap
				'ledgerHeight', // sort
				plan // endorsement_plan
			);
			should.equal(plan.groups.G0.peers[0].name, 'peer3');
			should.equal(plan.groups.G0.peers[1].name, 'peer2');
			should.equal(plan.groups.G0.peers[2].name, 'peer1');
			sinon.assert.calledWith(FakeLogger.debug, '%s - start');
		});
	});

	describe('#_create_map', () => {
		it('should run ok with undefined', async () => {
			// TEST CALL
			const results = discoveryHandler._create_map();
			results.should.be.instanceof(Map);
		});
		it('should run ok with null', async () => {
			// TEST CALL
			const results = discoveryHandler._create_map(
				null
			);
			results.should.be.instanceof(Map);
		});
		it('should run ok with string', async () => {
			// TEST CALL
			const results = discoveryHandler._create_map(
				'something'
			);
			results.should.be.instanceof(Map);
		});
		it('should run ok with an array', async () => {
			// TEST CALL
			const results = discoveryHandler._create_map(
				[1, 2, 3]
			);
			results.should.be.instanceof(Map);
		});
	});

	describe('#_removePeers', () => {
		it('should ignore endorsers and orgs', async () => {
			// TEST CALL
			const results = discoveryHandler._removePeers(
				discoveryHandler._create_map([org1[1], org2[1]]), // ignored_endorsers
				discoveryHandler._create_map([org3[0]]), // ignored_orgs
				new Map(), // required_endorsers
				new Map(), // required_orgs
				endorsement_plan.groups.G3.peers // peers
			);
			results[0].name.should.be.equal(org1[2]);
			results[1].name.should.be.equal(org2[2]);
			results.length.should.be.equal(2);
		});
		it('should require endorsers and orgs', async () => {
			// TEST CALL
			const results = discoveryHandler._removePeers(
				new Map(), // ignored_endorsers
				new Map(), // ignored_orgs
				discoveryHandler._create_map([org3[2]]), // required_endorsers
				discoveryHandler._create_map([org2[0]]), // required_orgs
				endorsement_plan.groups.G3.peers // peers
			);
			results[0].name.should.be.equal(org2[1]);
			results[1].name.should.be.equal(org2[2]);
			results[2].name.should.be.equal(org3[2]);
			results.length.should.be.equal(3);
		});
	});

	describe('#_findHighest', () => {
		it('should find highest', async () => {
			const peers = [
				{ledger_height: ledger_height},
				{ledger_height: ledger_height},
				{ledger_height: smaller},
				{ledger_height: ledger_height},
				{ledger_height: highest},
				{ledger_height: ledger_height}
			];
			// TEST CALL
			const results = discoveryHandler._findHighest(
				peers // peers
			);
			results.low.should.be.equal(200);
		});
		it('should throw', () => {
			const peers = [
				{ledger_height: ledger_height},
				{ledger_height: ledger_height},
				{ledger_height: smaller},
				{ledger_height: 'bad'},
				{ledger_height: highest},
				{ledger_height: ledger_height}
			];
			(() => {
				// TEST CALL
				discoveryHandler._findHighest(
					peers // peers
				);
			}).should.throw('Unable to find highest block value :: TypeError: peer.ledger_height.greaterThan is not a function');
		});
	});

	describe('#_sortPeerList', () => {
		it('should run all', async () => {
			const peers = [
				{name: 'peer1', ledger_height: ledger_height},
				{name: 'peer2'},
				{name: 'peer3', ledger_height: smaller},
				{name: 'peer4', ledger_height: ledger_height},
				{name: 'peer5', ledger_height: highest},
				{name: 'peer6', ledger_height: ledger_height}
			];
			// TEST CALL
			let results = discoveryHandler._sortPeerList(
				'ledgerHeight',
				peers // peers
			);
			results[5].name.should.be.equal('peer2');
			results[0].name.should.be.equal('peer5');
			results[4].name.should.be.equal('peer3');

			discoveryHandler._getRandom = sinon.stub().returns('random');
			// TEST CALL
			results = discoveryHandler._sortPeerList(
				'random',
				peers // peers
			);
			results.should.contain('random');
		});
	});

	describe('#_splitList', () => {
		it('should run all', async () => {
			const sorted_list = [
				{name: 'peer1', mspid: 'msp1', ledger_height: Long.fromValue(25)},
				{name: 'peer2', mspid: 'msp1', ledger_height: Long.fromValue(20)},
				{name: 'peer3', mspid: 'msp1', ledger_height: Long.fromValue(15)},
				{name: 'peer4', mspid: 'msp3', ledger_height: Long.fromValue(10)},
				{name: 'peer5', mspid: 'msp2', ledger_height: Long.fromValue(20)},
				{name: 'peer6', mspid: 'msp2', ledger_height: Long.fromValue(15)},
				{name: 'peer7', mspid: 'msp3', ledger_height: Long.fromValue(25)},
				{name: 'peer8', mspid: 'msp4', ledger_height: Long.fromValue(20)},
				{name: 'peer9', mspid: 'msp4', ledger_height: Long.fromValue(15)},
				{name: 'peer10', mspid: 'msp5'}
			];
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = Long.fromValue(5);
			const highest_p = Long.fromValue(25);

			// TEST CALL
			const results = discoveryHandler._splitList(
				preferred_endorsers,
				preferred_orgs,
				preferred_height_gap,
				highest_p,
				sorted_list
			);
			results.priority[0].name.should.be.equal('peer1');
			results.priority[1].name.should.be.equal('peer2');
			results.non_priority[0].name.should.be.equal('peer3');
			results.non_priority[1].name.should.be.equal('peer4');
			results.priority[2].name.should.be.equal('peer5');
			results.priority[3].name.should.be.equal('peer6');
			results.priority[4].name.should.be.equal('peer7');
			results.priority[5].name.should.be.equal('peer8');
			results.non_priority[2].name.should.be.equal('peer9');
			results.priority[6].name.should.be.equal('peer10');
		});
		it('should run with no highest', async () => {
			const sorted_list = [
				{name: 'peer1', mspid: 'msp1', ledger_height: Long.fromValue(25)},
				{name: 'peer2', mspid: 'msp1', ledger_height: Long.fromValue(20)},
				{name: 'peer3', mspid: 'msp1', ledger_height: Long.fromValue(15)},
				{name: 'peer4', mspid: 'msp3', ledger_height: Long.fromValue(10)},
				{name: 'peer5', mspid: 'msp2', ledger_height: Long.fromValue(20)},
				{name: 'peer6', mspid: 'msp2', ledger_height: Long.fromValue(15)},
				{name: 'peer7', mspid: 'msp3', ledger_height: Long.fromValue(25)},
				{name: 'peer8', mspid: 'msp4', ledger_height: Long.fromValue(20)},
				{name: 'peer9', mspid: 'msp4', ledger_height: Long.fromValue(15)},
				{name: 'peer10', mspid: 'msp5'},
				{name: 'peer11', mspid: 'msp5'}
			];
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10',
				'peer3'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = Long.fromValue(0);
			const highest_p = Long.fromValue(25);

			// TEST CALL
			const results = discoveryHandler._splitList(
				preferred_endorsers,
				preferred_orgs,
				preferred_height_gap,
				highest_p,
				sorted_list
			);
			results.priority[0].name.should.be.equal('peer1');
			results.non_priority[0].name.should.be.equal('peer2');
			results.priority[1].name.should.be.equal('peer3');
			results.non_priority[1].name.should.be.equal('peer4');
			results.priority[2].name.should.be.equal('peer5');
			results.priority[3].name.should.be.equal('peer6');
			results.priority[4].name.should.be.equal('peer7');
			results.non_priority[2].name.should.be.equal('peer8');
			results.non_priority[3].name.should.be.equal('peer9');
			results.priority[5].name.should.be.equal('peer10');
			results.non_priority[4].name.should.be.equal('peer11');
		});
		it('should run with no ledgerHeight', async () => {
			const sorted_list = [
				{name: 'peer1', mspid: 'msp1', ledger_height: Long.fromValue(25)},
				{name: 'peer2', mspid: 'msp1', ledger_height: Long.fromValue(20)},
				{name: 'peer3', mspid: 'msp1', ledger_height: Long.fromValue(15)},
				{name: 'peer4', mspid: 'msp3', ledger_height: Long.fromValue(10)},
				{name: 'peer5', mspid: 'msp2', ledger_height: Long.fromValue(20)},
				{name: 'peer6', mspid: 'msp2', ledger_height: Long.fromValue(15)},
				{name: 'peer7', mspid: 'msp3', ledger_height: Long.fromValue(25)},
				{name: 'peer8', mspid: 'msp4', ledger_height: Long.fromValue(20)},
				{name: 'peer9', mspid: 'msp4', ledger_height: Long.fromValue(15)},
				{name: 'peer10', mspid: 'msp5'},
				{name: 'peer11', mspid: 'msp5'}
			];
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10',
				'peer3'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = null;
			const highest_p = null;

			// TEST CALL
			const results = discoveryHandler._splitList(
				preferred_endorsers,
				preferred_orgs,
				preferred_height_gap,
				highest_p,
				sorted_list
			);
			results.non_priority[0].name.should.be.equal('peer1');
			results.non_priority[1].name.should.be.equal('peer2');
			results.priority[0].name.should.be.equal('peer3');
			results.non_priority[2].name.should.be.equal('peer4');
			results.priority[1].name.should.be.equal('peer5');
			results.priority[2].name.should.be.equal('peer6');
			results.non_priority[3].name.should.be.equal('peer7');
			results.non_priority[4].name.should.be.equal('peer8');
			results.non_priority[5].name.should.be.equal('peer9');
			results.priority[3].name.should.be.equal('peer10');
			results.non_priority[6].name.should.be.equal('peer11');
		});
	});

	describe('#_getRandom', () => {
		it('should run with peer list', async () => {
			const start_list = [
				{name: 'peer1', mspid: 'msp1', ledger_height: Long.fromValue(25)},
				{name: 'peer2', mspid: 'msp1', ledger_height: Long.fromValue(20)},
				{name: 'peer3', mspid: 'msp1', ledger_height: Long.fromValue(15)},
				{name: 'peer4', mspid: 'msp3', ledger_height: Long.fromValue(10)},
				{name: 'peer5', mspid: 'msp2', ledger_height: Long.fromValue(20)},
				{name: 'peer6', mspid: 'msp2', ledger_height: Long.fromValue(15)},
				{name: 'peer7', mspid: 'msp3', ledger_height: Long.fromValue(25)},
				{name: 'peer8', mspid: 'msp4', ledger_height: Long.fromValue(20)},
				{name: 'peer9', mspid: 'msp4', ledger_height: Long.fromValue(15)},
				{name: 'peer10', mspid: 'msp5'}
			];

			// TEST CALL
			const results = discoveryHandler._getRandom(
				start_list
			);

			results.length.should.be.equal(10);
			for (const item of start_list) {
				let found = false;
				for (const result of results) {
					if (result.name === item.name) {
						found = true;
						break;
					}
				}
				should.equal(found, true, `Endorser ${item.name} was not found`);
			}
		});

		it('should run with int list', async () => {
			const start_list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

			// TEST CALL
			const results = discoveryHandler._getRandom(
				start_list
			);

			results.length.should.be.equal(10);
			for (const item of start_list) {
				let found = false;
				for (const result of results) {
					if (result === item) {
						found = true;
						break;
					}
				}
				should.equal(found, true, `Item ${item} was not found`);
			}
		});
	});
});
