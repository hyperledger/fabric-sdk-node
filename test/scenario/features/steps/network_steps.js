/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const network_util = require('../lib/network');
const CCP = require('../lib/common_connection');
const testUtil = require('../lib/utils');

const path = require('path');

const ccpPath = '../../config/ccp.json';
const tlsCcpPath = '../../config/ccp-tls.json';
const discoveryCcpPath = '../../config/ccp-discovery.json';

module.exports = function () {

	this.Given(/^I have created a gateway named (.+?) as user (.+?) within (.+?) using the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, userName, orgName, tlsType) => {
		if (network_util.getGateway() === undefined) {
			let profile;
			let tls;
			const useDiscovery = tlsType.localeCompare('discovery') === 0;
			switch (tlsType) {
				case 'non-tls':
					tls = false;
					profile = new CCP(path.join(__dirname, ccpPath), true);
					break;
				case 'discovery':
					tls = true;
					profile = new CCP(path.join(__dirname, discoveryCcpPath), true);
					break;
				default:
					tls = true;
					profile = new CCP(path.join(__dirname, tlsCcpPath), true);
					break;
			}
			return network_util.connectGateway(profile, tls, userName, orgName, gatewayName, useDiscovery);
		}
	});


	this.Then(/^I can create a gateway named (.+?) as user (.+?) within (.+?) using the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, userName, orgName, tlsType) => {
		let profile;
		let tls;
		const useDiscovery = tlsType.localeCompare('discovery') === 0;
		switch (tlsType) {
			case 'non-tls':
				tls = false;
				profile = new CCP(path.join(__dirname, ccpPath), true);
				break;
			case 'discovery':
				tls = true;
				profile = new CCP(path.join(__dirname, discoveryCcpPath), true);
				break;
			default:
				tls = true;
				profile = new CCP(path.join(__dirname, tlsCcpPath), true);
				break;
		}
		return network_util.connectGateway(profile, tls, userName, orgName, gatewayName, useDiscovery);
	});

	this.Then(/^I use the gateway named (.+?) to submit a transaction with args (.+?) for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
	});

	this.Then(/^I use the gateway named (.+?) to evaluate transaction with args (.+?) for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, false);
	});

	this.Then(/^The gateway named (.+?) has a (.+?) type response$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, type) => {
		if (network_util.lastTypeCompare(gatewayName, type)) {
			return Promise.resolve();
		} else {
			throw new Error('Expected and actual result type from previous transaction did not match. Expected [' + type + '] but had [' + network_util.lastResult(gatewayName).type + ']');
		}
	});

	this.Then(/^The gateway named (.+?) has a (.+?) type response matching (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, type, expected) => {
		const sameType = network_util.lastTypeCompare(gatewayName, type);
		const sameResponse = network_util.lastResponseCompare(gatewayName, expected);
		if (sameType && sameResponse) {
			return Promise.resolve();
		} else {
			throw new Error('Expected and actual results from previous transaction did not match. Expected [' + expected + '] but had [' + network_util.lastResult(gatewayName).response + ']');
		}
	});

	this.Then(/^I can disconnect from the gateway named (.+?)$/, {timeout:testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName) => {
		return await network_util.disconnectGateway(gatewayName);
	});

	this.Then(/^I have disconnected from all gateways$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async () => {
		return await network_util.disconnectAllGateways();
	});
};
