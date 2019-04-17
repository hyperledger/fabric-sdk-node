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

module.exports = function () {
	this.Then(/^I can create a gateway named (.+?) as user (.+?) within (.+?) using the (.+?) common connection profile$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, userName, orgName, tlsType) => {
		let profile;
		let tls;
		if (tlsType.localeCompare('non-tls') === 0) {
			tls = false;
			profile = new CCP(path.join(__dirname, ccpPath), true);
		} else {
			tls = true;
			profile = new CCP(path.join(__dirname, tlsCcpPath), true);
		}
		return network_util.connectGateway(profile, tls, userName, orgName, gatewayName);
	});

	this.Then(/^I use the gateway named (.+?) to submit a transaction with args (.+?) for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
	});

	this.Then(/^I use the gateway named (.+?) to evaluate transaction with args (.+?) for chaincode (.+?) instantiated on channel (.+?) with the response matching (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName, expected) => {

		const result = await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, false);
		if (result === expected) {
			return Promise.resolve();
		} else {
			throw new Error('Expected and actual results from evaluateTransaction() did not match');
		}

	});

	this.Then(/^I use the gateway named (.+?) to submit (.+?) transactions with args (.+?) for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, numTransactions, args, ccName, channelName) => {
		for (let i = 0; i < numTransactions; i++) {
			await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
		}
	});

	this.Then(/^I use the gateway named (.+?) to submit (.+?) transactions with args (.+?) for chaincode (.+?) instantiated on fabric channel (.+?) disconnecting the event hub on listener (.+?) every (.+?) transactions$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, numTransactions, args, ccName, channelName, listenerName, disconnects) => {
		const listener = network_util.getListenerInfo(listenerName).listener;
		const eventHub = listener.eventHub;
		for (let i = 0; i < numTransactions; i++) {
			if (i % disconnects === 0) {
				eventHub.disconnect();
			}
			await network_util.performGatewayTransaction(gatewayName, ccName, channelName, args, true);
		}
	});

	this.Then(/^I use the gateway named (.+?) to submit a transaction with args (.+?) and listen for a commit event for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return await network_util.performGatewayTransactionWithListener(gatewayName, ccName, channelName, args, true);
	});

	// Events
	this.Then(/^I use the gateway named (.+?) to listen for ([^\s.]+?) events with listener (.+?) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, eventName, listenerName, ccName, channelName) => {
		return await network_util.createContractListener(gatewayName, channelName, ccName, eventName, listenerName);
	});

	this.Then(/^I use the gateway named (.+?) to listen for unfiltered (.+?) events with listener (.+?) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, eventName, listenerName, ccName, channelName) => {
		return await network_util.createContractListener(gatewayName, channelName, ccName, eventName, listenerName, false, false);
	});

	this.Then(/^I use the gateway named (.+?) to listen for filtered_block_events with listener (.+?) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, listenerName, ccName, channelName) => {
		return await network_util.createBlockListener(gatewayName, channelName, ccName, listenerName, true);
	});

	this.Then(/^I use the gateway named (.+?) to listen for unfiltered_block_events with listener (.+?) on chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName, listenerName, ccName, channelName) => {
		return await network_util.createBlockListener(gatewayName, channelName, ccName, listenerName, false);
	});

	this.Then(/^I receive ([0-9]+) events from the listener (.+?)$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async (calls, listenerName) => {
		await new Promise(resolve => {
			const interval = setInterval(() => {
				const listenerInfo = network_util.getListenerInfo(listenerName);
				if (Number(listenerInfo.calls) === Number(calls))  {
					clearInterval(interval);
					clearTimeout(timeout);
					resolve();
				}
			}, 1000);
			const timeout = setTimeout(() => {
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

	this.Then(/^I use the transaction named (.+?) to create a commit listener called (.+?)$/, (transactionName, listenerName) => {
		return network_util.createCommitListener(transactionName, listenerName);
	});

	this.Then(/^I use the transaction named (.+?) to submit a transaction with args (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (transactionName, args) => {
		return network_util.submitExistingTransaction(transactionName, args);
	});

	this.Then(/^I use the gateway named (.+?) to submit a transaction with args (.+?) and listen for a commit event for chaincode (.+?) instantiated on channel (.+?)$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, args, ccName, channelName) => {
		return await network_util.performGatewayTransactionWithListener(gatewayName, ccName, channelName, args, true);
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

	this.Then(/^The gateway named (.+?) has a (.+?) type response$/, {timeout: testUtil.TIMEOUTS.LONG_STEP}, async (gatewayName, type) => {
		if (network_util.lastTypeCompare(gatewayName, type)) {
			return Promise.resolve();
		} else {
			throw new Error('Expected and actual result type from previous transaction did not match. Expected [' + type + '] but had [' + network_util.lastResult(gatewayName).type + ']');
		}
	});

	this.Then(/^I can disconnect from the gateway named (.+?)$/, {timeout:testUtil.TIMEOUTS.SHORT_STEP}, async (gatewayName) => {
		return await network_util.disconnectGateway(gatewayName);
	});

	this.Then(/^I have disconnected from all gateways$/, {timeout: testUtil.TIMEOUTS.SHORT_STEP}, async () => {
		return await network_util.disconnectAllGateways();
	});
};
