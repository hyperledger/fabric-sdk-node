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

	this.Then(/^I use the gateway named (.+?) to submit (.+?) transactions with args (.+?) for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, numTransactions, args, ccName, channelName) => {
		for (let i = 0; i < numTransactions; i++) {
			await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
		}
	});

	this.Then(/^I use the gateway named (.+?) to submit (.+?) transactions with args (.+?) for chaincode (.+?) instantiated on fabric channel (.+?) disconnecting the event hub on listener (.+?) every (.+?) transactions$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, numTransactions, args, ccName, channelName, listenerName, disconnects) => {
		const listener = network_util.getListenerInfo(listenerName).listener;
		const eventService = listener.eventService;
		for (let i = 0; i < numTransactions; i++) {
			if (i % disconnects === 0) {
				eventService.disconnect();
			}
			await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
		}
	});

	this.Then(/^I use the gateway named (.+?) to submit a transaction with args (.+?) and listen for a commit event for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return await network_util.performGatewayTransactionWithListener(gatewayName, ccName, channelName, args, true);
	});

	// Events
	this.Then(/^I use the gateway named (.+?) to listen for (filtered|unfiltered) ([^\s.]+?) events with listener (.+?) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, eventType, eventName, listenerName, ccName, channelName) => {
		return await network_util.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, true, eventType === 'unfiltered');
	});

	this.Then(/^I use the gateway named (.+?) to listen for filtered_block_events with listener ([a-zA-Z]+) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, listenerName, ccName, channelName) => {
		return await network_util.createBlockListener(gatewayName, channelName, ccName, listenerName, true, true);
	});

	this.Then(/^I use the gateway named (.+?) to listen for unfiltered_block_events with listener ([a-zA-Z]+) between ([0-9]+) and ([0-9]+) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, listenerName, startBlock, endBlock, ccName, channelName) => {
		await network_util.createBlockListener(gatewayName, channelName, ccName, listenerName, false, false, startBlock, endBlock);
	});

	this.Then(/^I use the gateway named (.+?) to listen for unfiltered_block_events with listener ([a-zA-Z]+) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, listenerName, ccName, channelName) => {
		return await network_util.createBlockListener(gatewayName, channelName, ccName, listenerName, false);
	});

	this.Then(/^I receive ([0-9]+) events from the listener (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (calls, listenerName) => {
		await new Promise(resolve => {
			let timeout = null;
			const interval = setInterval(() => {
				const listenerInfo = network_util.getListenerInfo(listenerName);
				if (Number(listenerInfo.calls) === Number(calls))  {
					clearInterval(interval);
					clearTimeout(timeout);
					resolve();
				}
			}, 100);
			timeout = setTimeout(() => {
				resolve();
				clearInterval(interval);
			}, 60000);
		});
		const eventListenerInfo = network_util.getListenerInfo(listenerName);
		if (Number(eventListenerInfo.calls) !== Number(calls)) {
			throw new Error(`Expected ${listenerName} to be called ${calls} times, but called ${eventListenerInfo.calls} times`);
		}
		network_util.resetListenerCalls(listenerName);
		return Promise.resolve();
	});

	this.Then(/^I receive at least ([0-9]+) events from the listener (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (calls, listenerName) => {
		await new Promise(resolve => {
			let timeout = null;
			const interval = setInterval(() => {
				const listenerInfo = network_util.getListenerInfo(listenerName);
				if (Number(listenerInfo.calls) >= Number(calls))  {
					clearInterval(interval);
					clearTimeout(timeout);
					resolve();
				}
			}, 1000);
			timeout = setTimeout(() => {
				resolve();
				clearInterval(interval);
			}, 60000);
		});
		const eventListenerInfo = network_util.getListenerInfo(listenerName);
		if (Number(eventListenerInfo.calls) < Number(calls)) {
			throw new Error(`Expected ${listenerName} to be called ${calls} times, but called ${eventListenerInfo.calls} times`);
		}
		network_util.resetListenerCalls(listenerName);
		return Promise.resolve();
	});

	this.Then(/^I use the gateway named (.+?) to create a transaction named (.+?) that calls (.+?) using chaincode (.+?) instantiated on channel (.+?)$/, async (gatewayName, transactionName, fcnName, ccName, channelName) => {
		return network_util.createTransaction(gatewayName, transactionName, fcnName, ccName, channelName);
	});

	this.Then(/^I use the transaction named (.+?) to create a commit listener called (.+?)$/, (transactionName, listenerName) => {
		return network_util.createCommitListener(transactionName, listenerName);
	});

	this.Then(/^I use the transaction named (.+?) to submit a transaction with args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (transactionName, args) => {
		return network_util.submitExistingTransaction(transactionName, args);
	});
	// Events

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

	this.Then(/^I can disconnect from the gateway named (.+?)$/, {timeout:testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName) => {
		return await network_util.disconnectGateway(gatewayName);
	});

	this.Then(/^I have disconnected from all gateways$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async () => {
		return await network_util.disconnectAllGateways();
	});
};
