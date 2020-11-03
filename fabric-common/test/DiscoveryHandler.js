/*
 * Copyright IBM Corp. All Rights Reserved.
 *
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

	let peer11, peer12, peer21, peer22, peer31, peer32, peer33;
	let orderer1, orderer2, orderer3;

	const pem = '-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n';
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
	const ledgerHeight = Long.fromValue(100);
	const smaller = Long.fromValue(10);
	const endorsement_plan_template = {
		plan_id: 'example',
		groups: {
			G0: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledgerHeight, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledgerHeight, chaincodes, name: org1[2]}
				]
			},
			G1: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledgerHeight, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledgerHeight, chaincodes, name: org2[2]}
				]
			},
			G3: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledgerHeight, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledgerHeight, chaincodes, name: org1[2]},
					{mspid: org2[0], endpoint: org2[1], ledgerHeight, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledgerHeight, chaincodes, name: org2[2]},
					{mspid: org3[0], endpoint: org3[1], ledgerHeight, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledgerHeight: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledgerHeight: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{G0: 1, G1: 1}, {G3: 3, G1: 1}]
	};


	const config_results = {
		msps: {
			OrdererMSP: {
				id: 'OrdererMSP',
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tlsIntermediateCerts: ''
			},
			Org2MSP: {
				id: org2[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tlsIntermediateCerts: ''
			},
			Org1MSP: {
				id: org1[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tlsIntermediateCerts: ''
			},
			Org3MSP: {
				id: org3[0],
				orgs: [],
				rootCerts: pem,
				intermediateCerts: '',
				admins: pem,
				tlsIntermediateCerts: ''
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
					{mspid: org1[0], endpoint: org1[1], ledgerHeight, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledgerHeight, chaincodes, name: org1[2]}
				]
			},
			Org2MSP: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledgerHeight, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledgerHeight, chaincodes, name: org2[2]}
				]
			},
			Org3MSP: {
				peers: [
					{mspid: org3[0], endpoint: org3[1], ledgerHeight, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledgerHeight: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledgerHeight: smaller, chaincodes, name: org3[3]}
				]
			},
			Org4MSP: {
				peers: []
			},
		}
	};

	const organization_plan = JSON.parse(JSON.stringify({
		plan_id: 'required organizations',
		groups: {
			Org1MSP: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledgerHeight, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledgerHeight, chaincodes, name: org1[2]}
				]
			},
			Org2MSP: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledgerHeight, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledgerHeight, chaincodes, name: org2[2]}
				]
			},
			Org3MSP: {
				peers: [
					{mspid: org3[0], endpoint: org3[1], ledgerHeight, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledgerHeight: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledgerHeight: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{Org1MSP: 1, Org2MSP: 1, Org3MSP: 1}]
	}));

	const organization_plan_one = JSON.parse(JSON.stringify({
		plan_id: 'required organizations',
		groups: {
			Org3MSP: {
				peers: [
					{mspid: org3[0], endpoint: org3[1], ledgerHeight, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledgerHeight: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledgerHeight: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{Org3MSP: 1}]
	}));

	const organization_plan_three = JSON.parse(JSON.stringify({
		plan_id: 'all organizations',
		groups: {
			Org1MSP: {
				peers: [
					{mspid: org1[0], endpoint: org1[1], ledgerHeight, chaincodes, name: org1[1]},
					{mspid: org1[0], endpoint: org1[2], ledgerHeight, chaincodes, name: org1[2]}
				]
			},
			Org2MSP: {
				peers: [
					{mspid: org2[0], endpoint: org2[1], ledgerHeight, chaincodes, name: org2[1]},
					{mspid: org2[0], endpoint: org2[2], ledgerHeight, chaincodes, name: org2[2]}
				]
			},
			Org3MSP: {
				peers: [
					{mspid: org3[0], endpoint: org3[1], ledgerHeight, chaincodes, name: org3[1]},
					{mspid: org3[0], endpoint: org3[2], ledgerHeight: highest, chaincodes, name: org3[2]},
					{mspid: org3[0], endpoint: org3[3], ledgerHeight: smaller, chaincodes, name: org3[3]}
				]
			}
		},
		layouts: [{Org1MSP: 1, Org2MSP: 1, Org3MSP: 1}]
	}));

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
		peer11 = client.newEndorser(org1[1], org1[0]);
		peer11.endpoint = {url: 'grpcs://' + org1[1], addr: org1[1]};
		peer11.sendProposal = sandbox.stub().resolves(good);
		peer11.checkConnection = sandbox.stub().resolves(true);
		peer11.connected = true;
		channel.addEndorser(peer11);
		peer12 = client.newEndorser(org1[2], org1[0]);
		peer12.endpoint = {url: 'grpcs://' + org1[2], addr: org1[2]};
		peer12.sendProposal = sandbox.stub().resolves(good);
		peer12.checkConnection = sandbox.stub().resolves(true);
		peer12.connected = true;
		channel.addEndorser(peer12);

		peer21 = client.newEndorser(org2[1], org2[0]);
		peer21.endpoint = {url: 'grpcs://' + org2[1], addr: org2[1]};
		peer21.sendProposal = sandbox.stub().resolves(good);
		peer21.checkConnection = sandbox.stub().resolves(true);
		peer21.connected = true;
		channel.addEndorser(peer21);
		peer22 = client.newEndorser(org2[2], org2[0]);
		peer22.endpoint = {url: 'grpcs://' + org2[2], addr: org2[2]};
		peer22.sendProposal = sandbox.stub().resolves(good);
		peer22.checkConnection = sandbox.stub().resolves(true);
		peer22.connected = true;
		channel.addEndorser(peer22);

		peer31 = client.newEndorser(org3[1], org3[0]);
		peer31.endpoint = {url: 'grpcs://' + org3[1], addr: org3[1]};
		peer31.sendProposal = sandbox.stub().resolves(good);
		peer31.checkConnection = sandbox.stub().resolves(true);
		peer31.connected = true;
		channel.addEndorser(peer31);
		peer32 = client.newEndorser(org3[2], org3[0]);
		peer32.endpoint = {url: 'grpcs://' + org3[2], addr: org3[2]};
		peer32.sendProposal = sandbox.stub().resolves(good);
		peer32.checkConnection = sandbox.stub().resolves(true);
		peer32.connected = true;
		channel.addEndorser(peer32);
		peer33 = client.newEndorser(org3[3], org3[0]);
		peer33.endpoint = {url: 'grpcs://' + org3[3], addr: org3[3]};
		peer33.sendProposal = sandbox.stub().resolves(good);
		peer33.checkConnection = sandbox.stub().resolves(true);
		peer33.connected = true;
		channel.addEndorser(peer33);

		orderer1 = client.newCommitter('orderer1', 'msp1');
		orderer1.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer1.checkConnection = sandbox.stub().resolves(true);
		orderer1.connected = true;
		orderer1.endpoint = {url: 'grpc://orderer1.com'};
		channel.addCommitter(orderer1);

		orderer2 = client.newCommitter('orderer2', 'msp2');
		orderer2.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer2.checkConnection = sandbox.stub().resolves(true);
		orderer2.connected = true;
		orderer2.endpoint = {url: 'grpc://orderer2.com'};
		channel.addCommitter(orderer2);

		orderer3 = client.newCommitter('orderer3', 'msp1');
		orderer3.sendBroadcast = sandbox.stub().resolves({status: 'SUCCESS'});
		orderer3.checkConnection = sandbox.stub().resolves(true);
		orderer3.connected = true;
		orderer3.endpoint = {url: 'grpc://orderer3.com'};
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
			dh.discoveryService.should.equal('discovery');
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
		it('should run', async () => {
			discoveryHandler._commitSend = sandbox.stub().resolves({error: undefined, commit: {status:'SUCCESS'}});
			const results = await discoveryHandler.commit('signedEnvelope');
			results.status.should.equal('SUCCESS');
		});
		it('should reject', async () => {
			discoveryHandler._commitSend = sandbox.stub().resolves({error:new Error('FAILED with Error')});
			await discoveryHandler.commit('signedEnvelope').should.be.rejectedWith('FAILED with Error');
		});
	});

	//	async _commitSend(committers, signedEnvelope, timeout, reconnect) {

	describe('#_commitSend', () => {
		it('should run with some bad orderers assigned', async () => {
			orderer1.checkConnection = sandbox.stub().resolves(false);
			orderer2.checkConnection = sandbox.stub().resolves(false);
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, false);
			results.commit.status.should.equal('SUCCESS');
		});
		it('should reject orderer returns missing results', async () => {
			channel.removeCommitter(channel.getCommitter('orderer2'));
			channel.removeCommitter(channel.getCommitter('orderer3'));
			channel.getCommitter('orderer1').sendBroadcast = sandbox.stub().resolves();
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, false);
			results.error.message.should.equal('Failed to receive committer status');
		});
		it('should reject when status is not correct', async () => {
			channel.removeCommitter(channel.getCommitter('orderer2'));
			channel.removeCommitter(channel.getCommitter('orderer3'));
			channel.getCommitter('orderer1').sendBroadcast = sandbox.stub().resolves({status: 'FAILED'});
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, false);
			results.error.message.should.equal('Failed to send transaction successfully to the committer. status:FAILED');
		});
		it('should reject when orderer returns an error', async () => {
			channel.removeCommitter(channel.getCommitter('orderer1'));
			channel.removeCommitter(channel.getCommitter('orderer3'));
			channel.getCommitter('orderer2').sendBroadcast = sandbox.stub().rejects(new Error('FAILED with Error'));
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, false);
			results.error.message.should.equal('FAILED with Error');
		});
		it('should reject when all orderers are not connected', async () => {
			orderer1.checkConnection = sandbox.stub().resolves(false);
			orderer2.checkConnection = sandbox.stub().resolves(false);
			orderer3.checkConnection = sandbox.stub().resolves(false);
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, false);
			results.error.message.should.equal('Failed, committer orderer3 is not connected');
		});
		it('should reject when all orderers are not connected and using reconnect', async () => {
			orderer1.checkConnection = sandbox.stub().resolves(false);
			orderer2.checkConnection = sandbox.stub().resolves(false);
			orderer3.checkConnection = sandbox.stub().resolves(false);
			const results = await discoveryHandler._commitSend(channel.getCommitters(), 'signedEnvelope', 2000, true);
			results.error.message.should.equal('Failed, not able to reconnect to committer orderer3');
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
		it('should run ok with required orgs', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves(config_results);
			discoveryHandler._endorse = sandbox.stub().resolves('DONE');
			const results = await discoveryHandler.endorse('signedProposal', {requiredOrgs: ['Org1MSP', 'Org2MSP', 'Org3MSP'], sort: 'check'});
			results.should.equal('DONE');
			sinon.assert.calledWith(discoveryHandler._endorse, organization_plan, {sort: 'check', preferredHeightGap: undefined});

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
			discoveryHandler.compareProposalResponseResults = sinon.stub().returns(true);
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
		it('should run - show failed due to endorsement do not match', async () => {
			discoveryHandler.compareProposalResponseResults = sinon.stub().returns(false);
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._modify_groups = sinon.stub();
			discoveryHandler._getRandom = sinon.stub().returns([{}]);
			discoveryHandler._endorse_layout = sandbox.stub().resolves({
				success: true,
				endorsements: 'endorsements'
			});
			const results = await discoveryHandler._endorse({}, {sort: 'ledgerHeight'}, 'proposal');
			results[0].message.should.equal('Peer endorsements do not match');
			results[0].endorsements[0].should.equal('endorsements');
		});
		it('should run - show failed', async () => {
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
		it('should run ok - valid sort random', async () => {
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
		it('should run ok - valid sort ledgerHeight', async () => {
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
		it('should set default sort', async () => {
			discovery.getDiscoveryResults = sandbox.stub().resolves({endorsement_plan: {something: 'plan a'}});
			discoveryHandler._modify_groups = sinon.stub();
			discoveryHandler._getRandom = sinon.stub().returns([{}]);
			discoveryHandler._endorse_layout = sandbox.stub().resolves({
				success: false,
				endorsements: ['failed-endorsements']
			});
			const results = await discoveryHandler._endorse({}, {}, 'proposal');
			results[0].endorsements[0].should.equal('failed-endorsements');
			const m = new Map();
			sinon.assert.calledWith(discoveryHandler._modify_groups, m, m, m, m, m, m, Long.fromInt(1), 'ledgerHeight', {endorsements: {}, layouts: [{}]});
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

	describe('#_buildRequiredOrgPlan', () => {
		it('should run ok with all', () => {
			const results = discoveryHandler._buildRequiredOrgPlan(config_results.peers_by_org, ['Org1MSP', 'Org2MSP', 'Org3MSP']);
			results.should.deep.equal(organization_plan);
		});
		it('should run ok with one', () => {
			const results = discoveryHandler._buildRequiredOrgPlan(config_results.peers_by_org, ['Org3MSP']);
			results.should.deep.equal(organization_plan_one);
		});
		it('should throw for one missing with no peers', () => {
			(() => {
				discoveryHandler._buildRequiredOrgPlan(config_results.peers_by_org, ['Org4MSP']);
			}).should.throw('The discovery service did not find any peers active for Org4MSP organizations');
		});
		it('should throw for two missing when not included in list', () => {
			(() => {
				discoveryHandler._buildRequiredOrgPlan(config_results.peers_by_org, ['Org5MSP', 'Org6MSP']);
			}).should.throw('The discovery service did not find any peers active for Org5MSP,Org6MSP organizations');
		});
	});

	describe('#_buildAllOrgPlan', () => {
		it('should run ok with all', () => {
			const results = discoveryHandler._buildAllOrgPlan(config_results.peers_by_org);
			results.should.deep.equal(organization_plan_three);
		});
		it('should throw for no peers', () => {
			(() => {
				discoveryHandler._buildAllOrgPlan({Org4MSP: {peers: []}});
			}).should.throw('The discovery service did not find any peers active');
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
		it('should run - show reconnect error', async () => {
			endorsement_plan.endorsements = {};
			peer11.checkConnection.resolves(false);
			peer12.checkConnection.resolves(false);
			// TEST CALL
			const results = await discoveryHandler._build_endorse_group_member(
				endorsement_plan, // endorsement plan
				endorsement_plan.groups.G0, // group
				'proposal', // proposal
				2000, // timeout
				0, // endorser_process_index
				'G0' // group name
			);
			results.message.should.equal('Peer peer2.org1.example.com:7002 is not connected');
			sinon.assert.notCalled(peer11.sendProposal);
			sinon.assert.notCalled(peer12.sendProposal);
		});
		it('should run ok and return error when endorser rejects', async () => {
			endorsement_plan.endorsements = {};
			peer11.sendProposal = sandbox.stub().rejects(Error('FAILED'));
			peer12.sendProposal = sandbox.stub().rejects(Error('FAILED'));
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
			sinon.assert.called(peer11.sendProposal);
			sinon.assert.called(peer12.sendProposal);
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
			sinon.assert.notCalled(peer11.sendProposal);
			sinon.assert.called(peer12.sendProposal);
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
			sinon.assert.notCalled(peer11.sendProposal);
			sinon.assert.notCalled(peer12.sendProposal);
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
			sinon.assert.notCalled(peer11.sendProposal);
			sinon.assert.called(peer12.sendProposal);
			sinon.assert.calledWith(FakeLogger.debug, '%s - peer in use %s, skipping');
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
			sinon.assert.notCalled(peer12.sendProposal);
			sinon.assert.calledWith(FakeLogger.error, '%s - returning an error endorsement, no endorsement made');
			sinon.assert.calledWith(FakeLogger.debug, '%s - peer %s not assigned to this channel');
		});
	});

	describe('#_modify_groups', () => {
		const peer1 = {mspid: 'org1', name: 'peer1', ledgerHeight: {low: 5, high: 0}};
		const peer2 = {mspid: 'org1', name: 'peer2', ledgerHeight: {low: 8, high: 0}};
		const peer3 = {mspid: 'org1', name: 'peer3', ledgerHeight: {low: 10, high: 0}};
		const peer4 = {mspid: 'org2', name: 'peer4', ledgerHeight: {low: 5, high: 0}};
		const peer5 = {mspid: 'org2', name: 'peer5', ledgerHeight: {low: 8, high: 0}};
		const peer6 = {mspid: 'org2', name: 'peer6', ledgerHeight: {low: 10, high: 0}};
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
				'unknown', // sort
				plan // endorsement_plan
			);
			should.equal(plan.groups.G0.peers.length, 3);
			sinon.assert.calledWith(FakeLogger.debug, '%s - start');
		});
		it('should convert ledgerHeight', async () => {
			discoveryHandler._modify_groups(
				new Map(), // required
				new Map(), // preferred
				new Map(), // ignored
				new Map(), // required_orgs
				new Map(), // preferred_orgs
				new Map(), // ignored_orgs
				new Long(1), // preferred_height_gap
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
				{ledgerHeight: ledgerHeight},
				{ledgerHeight: ledgerHeight},
				{ledgerHeight: smaller},
				{ledgerHeight: ledgerHeight},
				{ledgerHeight: highest},
				{ledgerHeight: ledgerHeight}
			];
			// TEST CALL
			const results = discoveryHandler._findHighest(
				peers // peers
			);
			results.low.should.be.equal(200);
		});
		it('should throw', () => {
			const peers = [
				{ledgerHeight: ledgerHeight},
				{ledgerHeight: ledgerHeight},
				{ledgerHeight: smaller},
				{ledgerHeight: 'bad'},
				{ledgerHeight: highest},
				{ledgerHeight: ledgerHeight}
			];
			(() => {
				// TEST CALL
				discoveryHandler._findHighest(
					peers // peers
				);
			}).should.throw('Unable to find highest block value :: TypeError: peer.ledgerHeight.greaterThan is not a function');
		});
	});

	describe('#_sortPeerList', () => {
		it('should run all', async () => {
			const peers = [
				{name: 'peer1', ledgerHeight: ledgerHeight},
				{name: 'peer2'},
				{name: 'peer3', ledgerHeight: smaller},
				{name: 'peer4', ledgerHeight: ledgerHeight},
				{name: 'peer5', ledgerHeight: highest},
				{name: 'peer6', ledgerHeight: ledgerHeight}
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
		const peer1 = {name: 'peer1', mspid: 'msp1', ledgerHeight: Long.fromValue(25)};
		const peer2 = {name: 'peer2', mspid: 'msp1', ledgerHeight: Long.fromValue(20)};
		const peer3 = {name: 'peer3', mspid: 'msp1', ledgerHeight: Long.fromValue(15)};
		const peer4 = {name: 'peer4', mspid: 'msp3', ledgerHeight: Long.fromValue(10)};
		const peer5 = {name: 'peer5', mspid: 'msp2', ledgerHeight: Long.fromValue(20)};
		const peer6 = {name: 'peer6', mspid: 'msp2', ledgerHeight: Long.fromValue(15)};
		const peer7 = {name: 'peer7', mspid: 'msp3', ledgerHeight: Long.fromValue(25)};
		const peer8 = {name: 'peer8', mspid: 'msp4', ledgerHeight: Long.fromValue(20)};
		const peer9 = {name: 'peer9', mspid: 'msp4', ledgerHeight: Long.fromValue(15)};
		const peerA = {name: 'peer10', mspid: 'msp5'};
		const peerB = {name: 'peer11', mspid: 'msp5'};

		it('should run all', async () => {
			const sorted_list = [peer1, peer2, peer3, peer4, peer5, peer6, peer7, peer8, peer9, peerA];
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = Long.fromValue(5);
			const highest_p = Long.fromValue(25);
			const priority_list = [peer1, peer2, peer5, peer6, peer7, peer8, peerA];
			discoveryHandler._getRandom = sinon.stub().returns(priority_list);

			// TEST CALL
			const results = discoveryHandler._splitList(
				preferred_endorsers,
				preferred_orgs,
				preferred_height_gap,
				highest_p,
				sorted_list
			);
			sinon.assert.calledWith(discoveryHandler._getRandom, priority_list);
			results.non_priority[0].name.should.be.equal('peer3');
			results.non_priority[1].name.should.be.equal('peer4');
			results.non_priority[2].name.should.be.equal('peer9');

		});
		it('should run with no highest', async () => {
			const sorted_list = [peer1, peer2, peer3, peer4, peer5, peer6, peer7, peer8, peer9, peerA, peerB];
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10',
				'peer3'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = Long.fromValue(0);
			const highest_p = null;
			const priority_list = [peer3, peer5, peer6, peerA];
			discoveryHandler._getRandom = sinon.stub().returns(priority_list);

			// TEST CALL
			const results = discoveryHandler._splitList(
				preferred_endorsers,
				preferred_orgs,
				preferred_height_gap,
				highest_p,
				sorted_list
			);
			sinon.assert.calledWith(discoveryHandler._getRandom, priority_list);
			results.non_priority[0].name.should.be.equal('peer1');
			results.non_priority[1].name.should.be.equal('peer2');
			results.non_priority[2].name.should.be.equal('peer4');
			results.non_priority[3].name.should.be.equal('peer7');
			results.non_priority[4].name.should.be.equal('peer8');
			results.non_priority[5].name.should.be.equal('peer9');
			results.non_priority[6].name.should.be.equal('peer11');
		});
	});

	describe('#_getRandom', () => {
		it('should run with peer list', async () => {
			const start_list = [
				{name: 'peer1', mspid: 'msp1', ledgerHeight: Long.fromValue(25)},
				{name: 'peer2', mspid: 'msp1', ledgerHeight: Long.fromValue(20)},
				{name: 'peer3', mspid: 'msp1', ledgerHeight: Long.fromValue(15)},
				{name: 'peer4', mspid: 'msp3', ledgerHeight: Long.fromValue(10)},
				{name: 'peer5', mspid: 'msp2', ledgerHeight: Long.fromValue(20)},
				{name: 'peer6', mspid: 'msp2', ledgerHeight: Long.fromValue(15)},
				{name: 'peer7', mspid: 'msp3', ledgerHeight: Long.fromValue(25)},
				{name: 'peer8', mspid: 'msp4', ledgerHeight: Long.fromValue(20)},
				{name: 'peer9', mspid: 'msp4', ledgerHeight: Long.fromValue(15)},
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

	describe('#compareProposalResponseResults', () => {
		it('should require a proposalResponses', () => {
			(() => {
				discoveryHandler.compareProposalResponseResults();
			}).should.throw('Missing proposalResponses parameter');
		});
		it('should require an array of proposalResponses', () => {
			(() => {
				discoveryHandler.compareProposalResponseResults('string');
			}).should.throw('proposalResponses must be an array, typeof=string');
		});
		it('should require an array of proposalResponses 2', () => {
			(() => {
				discoveryHandler.compareProposalResponseResults([]);
			}).should.throw('proposalResponses is empty');
		});
		it('if proposalResponses has any error return false', () => {
			const proposalResponses = [
				new Error('proposal error')
			];
			const results = discoveryHandler.compareProposalResponseResults(proposalResponses);
			results.should.be.false;
		});
		it('if only one proposalResponses return true', () => {
			const proposalResponses = [
				{payload: TestUtils.createResponsePayload('result1')}
			];
			const results = discoveryHandler.compareProposalResponseResults(proposalResponses);
			results.should.be.true;
		});
		it('if two same proposalResponses return true', () => {
			const proposalResponses = [
				{payload: TestUtils.createResponsePayload('result1')},
				{payload: TestUtils.createResponsePayload('result1')}
			];
			const results = discoveryHandler.compareProposalResponseResults(proposalResponses);
			results.should.be.true;
		});
		it('if two not same proposalResponses return false', () => {
			const proposalResponses = [
				{payload: TestUtils.createResponsePayload('result1')},
				{payload: TestUtils.createResponsePayload('result2')}
			];
			const results = discoveryHandler.compareProposalResponseResults(proposalResponses);
			results.should.be.false;
		});
	});

	describe('#_getProposalResponseResults', () => {
		it('should require a proposalResponse', () => {
			(() => {
				discoveryHandler._getProposalResponseResults();
			}).should.throw('Missing proposalResponse parameter');
		});
		it('should require a proposalResponse.payload', () => {
			(() => {
				discoveryHandler._getProposalResponseResults({});
			}).should.throw('Parameter must be a ProposalResponse Object');
		});
	});
});
