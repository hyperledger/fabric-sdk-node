/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {format} = require('util');
const testUtil = require('../lib/utils');
const path = require('path');
const Client = require('fabric-client');

module.exports = function () {

	this.Then(/^I can package (.+?) chaincode at version (.+?) named (.+?) as organization (.+?) with goPath (.+?) located at (.+?) and metadata located at (.+?) with (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_type, chaincode_version, chaincode_name, org_name, _go_path, _chaincode_path, metadata_path, init_required) => {
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);

			metadata_path = path.join(__dirname, metadata_path);
			let chaincode_path = _chaincode_path;
			let goPath = null;
			// golang packaging uses the environment gopath to build up the file paths
			// to include in the tar
			if (chaincode_type === 'golang') {
				goPath = path.join(__dirname, _go_path);
			} else {
				chaincode_path = path.join(__dirname, _chaincode_path);
			}

			const client = Client.getConfigSetting('client-' + org_name).value;
			const chaincode = client.newChaincode(chaincode_name, chaincode_version);
			if (init_required === 'initrequired') {
				chaincode.setInitRequired(true);
				testUtil.logMsg(` -- packaging step setting init required for ${chaincode_type} named ${chaincode_name}`);
			} else {
				testUtil.logMsg(` -- packaging step NO init required for ${chaincode_type} named ${chaincode_name}`);
			}

			const request = {
				chaincodePath: chaincode_path,
				metadataPath: metadata_path,
				chaincodeType: chaincode_type,
				goPath: goPath
			};

			// ------------- test the package API
			// const package_bytes = await chaincode.package(request);
			testUtil.logMsg(` -- packaging step about to package ${chaincode_type} named ${chaincode_name}`);
			await chaincode.package(request);

			// save it for later use
			Client.setConfigSetting(cc_save_name, {value: chaincode});
		});

	this.Then(/^I can install (.+?) chaincode at version (.+?) named (.+?) as organization (.+?)$/,
		{timeout: testUtil.TIMEOUTS.HUGE_TIME},
		async (chaincode_type, chaincode_version, chaincode_name, org_name) => {
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);

			const peer = Client.getConfigSetting('peer-' + org_name).value;

			const chaincode = Client.getConfigSetting(cc_save_name).value;

			const request = {
				target: peer,
				request_timeout: 20 * 60 * 1000
			};

			// ------------- test the install API
			try {
				const package_id = await chaincode.install(request);
				testUtil.logMsg(' installed the code with package ID of ' + package_id);
			} catch (error) {
				testUtil.logError('Install Error :: ' + error);
			}
		});

	this.Then(/^I can approve (.+?) chaincode at version (.+?) named (.+?) as organization (.+?) on channel (.+?) with endorsement policy (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_type, chaincode_version, chaincode_name, org_name, channel_name, endorsement_policy) => {
			const step = 'Chaincode approval';
			testUtil.logMsg(format('%s - starting for %s, %s, %s, %s, %s, %s', step, chaincode_type, chaincode_version, chaincode_name, org_name, channel_name, endorsement_policy));

			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer = Client.getConfigSetting('peer-' + org_name).value;

			const chaincode = Client.getConfigSetting(cc_save_name).value;

			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;

			const ENDORSEMENT_POLICY = {
				identities: [
					{role: {name: 'member', mspId: 'Org1MSP'}},
					{role: {name: 'member', mspId: 'Org2MSP'}}
				],
				policy: {
					'1-of': [{'signed-by': 0}, {'signed-by': 1}]
				}
			};

			switch (endorsement_policy) {
				case 'default':
					// leave it blank and let fabric decide
					break;
				case 'both_orgs':
					chaincode.setEndorsementPolicyDefinition(ENDORSEMENT_POLICY);
					break;
				default:
					chaincode.setEndorsementPolicyDefinition(endorsement_policy);
			}

			// replace the saved one with the one updated with endorsement policy
			Client.setConfigSetting(cc_save_name, {value: chaincode});

			const txId = client.newTransactionID(true);

			const request = {
				chaincode: chaincode,
				targets: [peer],
				txId: txId,
				request_timeout: 60000
			};

			try {
				testUtil.logMsg(format('%s - build request', step));
				// A P P R O V E  for  O R G
				const {proposalResponses, proposal} = await channel.approveChaincodeForOrg(request);
				if (proposalResponses) {
					for (const response of proposalResponses) {
						testUtil.logMsg(format('%s - approve endorsement response from peer %s', step, request.target));
						if (response instanceof Error) {
							testUtil.logAndThrow(response);
						} else if (response.response && response.response.status) {
							if (response.response.status === 200) {
								testUtil.logMsg(format('%s - Good peer response %s', step, response.response.status));
							} else {
								testUtil.logAndThrow(format('Problem with the chaincode approval ::%s %s', response.status, response.message));
							}
						} else {
							testUtil.logAndThrow('Problem with the chaincode approval no response returned');
						}
					}

					// commit this endorsement like any other
					return testUtil.commitProposal(txId, proposalResponses, proposal, channel, peer);
				} else {
					testUtil.logAndThrow('No chaincode approval proposalResponses was returned');
				}
			} catch (error) {
				testUtil.logAndThrow(error);
			}
		});

	this.Then(/^I can commit (.+?) chaincode at version (.+?) named (.+?) as organization (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_type, chaincode_version, chaincode_name, org_name, channel_name) => {
			const step = 'Chaincode commit';
			testUtil.logMsg(format('%s - starting for %s, %s, %s, %s, %s', step, chaincode_type, chaincode_version, chaincode_name, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer1 = Client.getConfigSetting('peer-org1').value;
			const peer2 = Client.getConfigSetting('peer-org2').value;
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);
			const chaincode = Client.getConfigSetting(cc_save_name).value;
			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);

			const request = {
				chaincode: chaincode,
				targets: [peer1, peer2],
				txId: txId,
				request_timeout: 60000
			};

			try {
				testUtil.logMsg(format('%s - build request', step));
				// C O M M I T   for   C H A N N E L
				const {proposalResponses, proposal} = await channel.commitChaincode(request);
				if (proposalResponses) {
					for (const response of proposalResponses) {
						testUtil.logMsg(format('%s - commit endorsement response from peer %s', step, request.target));
						if (response instanceof Error) {
							testUtil.logAndThrow(response);
						} else if (response.response && response.response.status) {
							if (response.response.status === 200) {
								testUtil.logMsg(format('%s - Good peer response %s', step, response.response.status));
							} else {
								testUtil.logAndThrow(format('Problem with the chaincode commit ::%s %s', response.status, response.message));
							}
						} else {
							testUtil.logAndThrow('Problem with the chaincode commit no response returned');
						}
					}
				} else {
					testUtil.logAndThrow('No chaincode commit proposalResponses was returned');
				}

				// if we get this far, commit this endorsement to the ledger like any other
				return testUtil.commitProposal(txId, proposalResponses, proposal, channel, peer1);
			} catch (error) {
				testUtil.logAndThrow(error);
			}
		});

	this.Then(/^I can call (.+?) on chaincode named (.+?) as organization (.+?) on channel (.+?) with args (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (cc_fcn, chaincode_name, org_name, channel_name, args) => {
			const step = 'Chaincode invoke';
			testUtil.logMsg(format('%s - starting for %s, %s, %s', step, chaincode_name, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;

			// get all the peers since only one peer per org in this network
			const peer1 = Client.getConfigSetting('peer-org1').value;
			const peer2 = Client.getConfigSetting('peer-org2').value;

			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);

			const request = {
				targets : [peer1, peer2],
				chaincodeId: chaincode_name,
				fcn: cc_fcn,
				args: eval(args),
				txId: txId
			};

			// These are old style chaincodes that require init to be called by lifecycle.
			// This will force this sendTransactionProposal to be direct call to the 'Init'
			// method of the chaincode.
			if (cc_fcn === 'init') {
				request.is_init = true;
			}

			try {
				// might be the first time, so will take extra time
				const results = await channel.sendTransactionProposal(request, 120000);
				if (results && results[0]) {
					const proposalResponses = results[0];
					for (const i in proposalResponses) {
						const response = proposalResponses[i];
						const peer = request.targets[i];
						testUtil.logMsg(format('%s - response from peer %s', step, peer));
						if (response instanceof Error) {
							testUtil.logAndThrow(response);
						} else if (response.response && response.response.status) {
							if (response.response.status === 200) {
								testUtil.logMsg(format('%s - Good peer response %s', step, response.response.status));
							} else {
								testUtil.logAndThrow(format('Problem with the chaincode invoke ::%s %s', response.status, response.message));
							}
						} else {
							testUtil.logAndThrow('Problem with the chaincode invoke no response returned');
						}
					}

					const proposal = results[1];

					// if we get this far then all responses are good (status = 200), go ahead and commit
					return testUtil.commitProposal(txId, proposalResponses, proposal, channel, peer1);
				} else {
					testUtil.logAndThrow('No chaincode invoke proposalResponses was returned');
				}
			} catch (error) {
				testUtil.logAndThrow(error);
			}
		});

	this.Then(/^I can query installed chaincode (.+?) as organization (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, org_name, channel_name) => {
			const step = 'QueryInstalledChaincode';
			testUtil.logMsg(format('%s - starting for %s, %s, %s', step, chaincode_name, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer = Client.getConfigSetting('peer-' + org_name).value;
			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);
			const chaincode = Client.getConfigSetting(cc_save_name).value;

			const request = {
				package_id: chaincode.getPackageId(),
				target : peer,
				txId: txId
			};

			try {
				const results = await channel.queryInstalledChaincode(request);
				if (typeof results === 'object') {
					testUtil.logMsg(format('%s - Good peer response, the installed label: %j', step, results));
				} else {
					testUtil.logAndThrow(format('Problem with the %s', step));
				}
			} catch (error) {
				testUtil.logAndThrow(format('Problem with the %s %s', step, error));
			}
		});

	this.Then(/^I can query installed chaincodes as organization (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (org_name, channel_name) => {
			const step = 'QueryInstalledChaincodes';
			testUtil.logMsg(format('%s - starting for %s, %s', step, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer = Client.getConfigSetting('peer-' + org_name).value;
			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);

			const request = {
				target : peer,
				txId: txId
			};

			try {
				const results = await channel.queryInstalledChaincodes(request);
				if (typeof results === 'object') {
					testUtil.logMsg(format('%s - Good peer response, the installed chaincodes: %j', step, results));
				} else {
					testUtil.logAndThrow(format('Problem with the %s', step));
				}
			} catch (error) {
				testUtil.logAndThrow(format('Problem with the %s %s', step, error));
			}
		});

	this.Then(/^I can query for defined chaincode (.+?) as organization (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, org_name, channel_name) => {
			const step = 'QueryChaincodeDefinition';
			testUtil.logMsg(format('%s - starting for %s, %s, %s', step, chaincode_name, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer = Client.getConfigSetting('peer-' + org_name).value;
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);
			const chaincode = Client.getConfigSetting(cc_save_name).value;
			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);

			try {
				let request = {
					target : peer,
					txId: txId,
					chaincodeId: chaincode.getName()
				};
				let result = await channel.queryChaincodeDefinition(request);
				if (result instanceof Error) {
					testUtil.logAndThrow(result);
				} else if (result) {
					testUtil.logMsg(format('%s - Good peer response %j', step, result));
				} else {
					testUtil.logAndThrow('Problem with the chaincode query for definition no response returned');
				}

				request = {
					target : peer,
					txId: txId
				};
				result = await channel.queryChaincodeDefinitions(request);
				if (result instanceof Error) {
					testUtil.logAndThrow(result);
				} else if (result) {
					testUtil.logMsg(format('QueryChaincodeDefinitions - Good peer response %j', result));
				} else {
					testUtil.logAndThrow('Problem with the chaincode query for definitions no response returned');
				}

				request = {
					target : peer,
					txId: txId,
					package_id: chaincode.getPackageId()
				};
				result = await channel.getInstalledChaincodePackage(request);
				if (result instanceof Error) {
					testUtil.logAndThrow(result);
				} else if (result) {
					testUtil.logMsg(format('GetInstalledChaincodePackage - Good peer response - too big to show'));
				} else {
					testUtil.logAndThrow('Problem with the GetInstalledChaincodePackage, no response returned');
				}
			} catch (error) {
				testUtil.logAndThrow(error);
			}
		});

	this.Then(/^I can query for chaincode (.+?) for commit status as organization (.+?) on channel (.+?)$/,
		{timeout: testUtil.TIMEOUTS.LONG_STEP},
		async (chaincode_name, org_name, channel_name) => {
			const step = 'CheckCommitReadiness';
			testUtil.logMsg(format('%s - starting for %s, %s, %s', step, chaincode_name, org_name, channel_name));

			const client = Client.getConfigSetting('client-' + org_name).value;
			const peer = Client.getConfigSetting('peer-' + org_name).value;
			const channel =	Client.getConfigSetting('channel-' + org_name + '-' + channel_name).value;
			const txId = client.newTransactionID(true);
			const cc_save_name = format('chaincode-%s-%s', org_name, chaincode_name);
			const chaincode = Client.getConfigSetting(cc_save_name).value;

			const request = {
				chaincode: chaincode,
				target : peer,
				txId: txId
			};

			try {
				const results = await channel.checkCommitReadiness(request);
				if (typeof results === 'object') {
					testUtil.logMsg(format('%s - Good peer response, the commmit status map: %j', step, results));
				} else {
					testUtil.logAndThrow(format('Problem with the %s', step));
				}
			} catch (error) {
				testUtil.logMsg(format('Problem with the %s %s', step, error));
			}
		});
};
