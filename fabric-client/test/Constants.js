/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const Constants = require('../lib/Constants');

describe('Constants', () => {
	it('should set the correct LSCC constant', () => {
		Constants.LSCC.should.equal('lscc');
	});

	it('should set the correct QSCC constant', () => {
		Constants.QSCC.should.equal('qscc');
	});

	it('should set the correct CSCC constant', () => {
		Constants.CSCC.should.equal('cscc');
	});

	it('should set the correct SYSTEM_CHANNEL_NAME constant', () => {
		Constants.SYSTEM_CHANNEL_NAME.should.equal('testchainid');
	});

	it('should set the correct NetworkConfig.ENDORSING_PEER_ROLE constant', () => {
		Constants.NetworkConfig.ENDORSING_PEER_ROLE.should.equal('endorsingPeer');
	});

	it('should set the correct NetworkConfig.CHAINCODE_QUERY_ROLE constant', () => {
		Constants.NetworkConfig.CHAINCODE_QUERY_ROLE.should.equal('chaincodeQuery');
	});

	it('should set the correct NetworkConfig.LEDGER_QUERY_ROLE constant', () => {
		Constants.NetworkConfig.LEDGER_QUERY_ROLE.should.equal('ledgerQuery');
	});

	it('should set the correct NetworkConfig.EVENT_SOURCE_ROLE constant', () => {
		Constants.NetworkConfig.EVENT_SOURCE_ROLE.should.equal('eventSource');
	});

	it('should set the correct NetworkConfig.DISCOVERY_ROLE constant', () => {
		Constants.NetworkConfig.DISCOVERY_ROLE.should.equal('discover');
	});

	it('should set the correct NetworkConfig.ALL_ROLES constant', () => {
		Constants.NetworkConfig.ALL_ROLES.should.equal('all');
	});

	it('should set the correct NetworkConfig.ROLES constant', () => {
		Constants.NetworkConfig.ROLES.should.deep.equal([
			'endorsingPeer', 'chaincodeQuery', 'ledgerQuery', 'eventSource', 'discover', 'all'
		]);
	});
});
