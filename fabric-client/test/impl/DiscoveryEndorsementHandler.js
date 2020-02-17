/**
 * SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable no-throw-literal */

const rewire = require('rewire');
const DiscoveryHandler = rewire('../../lib/impl/DiscoveryEndorsementHandler');


const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const sinon = require('sinon');
const Long = require('long');

describe('DiscoveryHandler', () => {

	let FakeLogger;
	let revert;
	let sandbox;

	let discoveryHandler;

	const highest = Long.fromValue(200);
	const ledger_height = Long.fromValue(100);
	const smaller = Long.fromValue(10);

	const org1 = [
		'org1',
		'peer1',
		'peer2',
		'peer3'
	];
	const org2 = [
		'Org2',
		'peer4',
		'peer5',
		'peer6'
	];
	const org3 = [
		'org3',
		'peer7',
		'peer8',
		'peer9'
	];

	const peer1 = {mspid: 'org1', name: 'peer1', ledger_height: {low: 5, high: 0}};
	const peer2 = {mspid: 'org1', name: 'peer2', ledger_height: {low: 8, high: 0}};
	const peer3 = {mspid: 'org1', name: 'peer3', ledger_height: {low: 10, high: 0}};
	const peer4 = {mspid: 'org2', name: 'peer4', ledger_height: {low: 5, high: 0}};
	const peer5 = {mspid: 'org2', name: 'peer5', ledger_height: {low: 8, high: 0}};
	const peer6 = {mspid: 'org2', name: 'peer6', ledger_height: {low: 10, high: 0}};
	const peer7 = {mspid: 'org3', name: 'peer7', ledger_height: {low: 5, high: 0}};
	const peer8 = {mspid: 'org3', name: 'peer8', ledger_height: {low: 8, high: 0}};
	const peer9 = {mspid: 'org3', name: 'peer9', ledger_height: {low: 10, high: 0}};
	const peers = [peer1, peer2, peer3, peer4, peer5, peer6, peer7, peer8, peer9];
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

		discoveryHandler = new DiscoveryHandler({});
	});



	describe('#_modify_groups', () => {

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
				peers // peers
			);
			results[0].name.should.be.equal(org1[2]);
			results[2].name.should.be.equal(org2[2]);
			results.length.should.be.equal(4);
		});
		it('should require endorsers', async () => {
			// TEST CALL
			const results = discoveryHandler._removePeers(
				new Map(), // ignored_endorsers
				new Map(), // ignored_orgs
				discoveryHandler._create_map([org3[2]]), // required_endorsers
				new Map(), // required_orgs
				peers // peers
			);
			results[0].name.should.be.equal(org3[2]);
			results.length.should.be.equal(1);
		});
		it('should require orgs', async () => {
			// TEST CALL
			const results = discoveryHandler._removePeers(
				new Map(), // ignored_endorsers
				new Map(), // ignored_orgs
				new Map(), // required_endorsers
				discoveryHandler._create_map([org3[0]]), // required_orgs
				peers // peers
			);
			results[0].name.should.be.equal(org3[1]);
			results[1].name.should.be.equal(org3[2]);
			results[2].name.should.be.equal(org3[3]);
			results.length.should.be.equal(3);
		});
	});

	describe('#_findHighest', () => {
		it('should find highest', async () => {
			const list = [
				{ledger_height: ledger_height},
				{ledger_height: ledger_height},
				{ledger_height: smaller},
				{ledger_height: ledger_height},
				{ledger_height: highest},
				{ledger_height: ledger_height}
			];
			// TEST CALL
			const results = discoveryHandler._findHighest(
				list // peers
			);
			results.low.should.be.equal(200);
		});
	});

	describe('#_sortPeerList', () => {
		it('should run all', async () => {
			const list = [
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
				list // peers
			);
			results[5].name.should.be.equal('peer2');
			results[0].name.should.be.equal('peer5');
			results[4].name.should.be.equal('peer3');

			discoveryHandler._getRandom = sinon.stub().returns('random');
			// TEST CALL
			results = discoveryHandler._sortPeerList(
				'random',
				list // peers
			);
			results.should.contain('random');
		});
	});

	describe('#_splitList', () => {
		const sorted_list = [
			{name: 'peer1', mspid: 'msp1', ledger_height: Long.fromValue(25)},
			{name: 'peer2', mspid: 'msp1', ledger_height: Long.fromValue(20)},
			{name: 'peer3', mspid: 'msp1', ledger_height: Long.fromValue(15)},
			{name: 'peer4', mspid: 'msp2', ledger_height: Long.fromValue(10)},
			{name: 'peer5', mspid: 'msp2', ledger_height: Long.fromValue(20)},
			{name: 'peer6', mspid: 'msp2', ledger_height: Long.fromValue(15)},
			{name: 'peer7', mspid: 'msp3', ledger_height: Long.fromValue(25)},
			{name: 'peer8', mspid: 'msp3', ledger_height: Long.fromValue(20)},
			{name: 'peer9', mspid: 'msp3', ledger_height: Long.fromValue(15)},
			{name: 'peer10', mspid: 'msp4', ledger_height: Long.fromValue(1)},
			{name: 'peer11', mspid: 'msp4', ledger_height: Long.fromValue(1)}
		];
		it('should run all', async () => {
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
			results.non_priority[0].name.should.be.equal('peer1');
			results.non_priority[1].name.should.be.equal('peer2');
			results.non_priority[2].name.should.be.equal('peer3');
			results.non_priority[3].name.should.be.equal('peer4');
			results.priority[0].name.should.be.equal('peer5');
			results.non_priority[4].name.should.be.equal('peer6');
			results.non_priority[5].name.should.be.equal('peer7');
			results.non_priority[6].name.should.be.equal('peer8');
			results.non_priority[7].name.should.be.equal('peer9');
			results.non_priority[8].name.should.be.equal('peer10');
			results.non_priority[9].name.should.be.equal('peer11');
		});
		it('should run with no highest', async () => {
			const preferred_endorsers = discoveryHandler._create_map([
				'peer10',
				'peer3'
			]);
			const preferred_orgs = discoveryHandler._create_map([
				'msp2'
			]);
			const preferred_height_gap = null;
			const highest_p = Long.fromValue(25);

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
			results.priority[1].name.should.be.equal('peer4');
			results.priority[2].name.should.be.equal('peer5');
			results.priority[3].name.should.be.equal('peer6');
			results.non_priority[2].name.should.be.equal('peer7');
			results.non_priority[3].name.should.be.equal('peer8');
			results.non_priority[4].name.should.be.equal('peer9');
			results.priority[4].name.should.be.equal('peer10');
			results.non_priority[5].name.should.be.equal('peer11');
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
