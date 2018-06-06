/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);



const Client = require('fabric-client');
const testutil = require('./util.js');

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('channel');
const DiscoveryEndorsementHandler = require('fabric-client/lib/impl/DiscoveryEndorsementHandler.js');

const results = {
	msps:{
		OrdererMSP:{
			id:'OrdererMSP',
			orgs:[ ],
			rootCerts:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			intermediateCerts:'',
			admins:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			tls_intermediate_certs:''
		},
		Org2MSP:{
			id:'Org2MSP',
			orgs:[ ],
			rootCerts:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			intermediateCerts:'',
			admins:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			tls_intermediate_certs:''
		},
		Org1MSP:{
			id:'Org1MSP',
			orgs:[ ],
			rootCerts:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			intermediateCerts:'',
			admins:'-----BEGIN CERTIFICATE-----    -----END CERTIFICATE-----\n',
			tls_intermediate_certs:''
		},
	},
	orderers:{
		OrdererMSP:{
			endpoints:[
				{
					host:'orderer.example.com',
					port:7050,
					name:'orderer.example.com'
				}
			]
		}
	},
	peers_by_org:{
		Org1MSP:{
			peers:[
				{
					mspid:'Org1MSP',
					endpoint:'peer0.org1.example.com:7051',
					ledger_height:4,
					chaincodes:[{name:'example',version:'v2'}],
					name:'peer0.org1.example.com'
				}
			]
		},
		Org2MSP:{
			peers:[
				{
					mspid:'Org2MSP',
					endpoint:'peer0.org2.example.com:7051',
					ledger_height:4,
					chaincodes:[{name:'example',version:'v2'}],
					name:'peer0.org2.example.com'
				}
			]
		}
	},
	endorsement_targets:{
		example:{
			groups:{
				G0:{
					peers:[
						{
							mspid:'Org1MSP',
							endpoint:'peer0.org1.example.com:7051',
							ledger_height:4,
							chaincodes:[{name:'example',version:'v2'}],
							name:'peer0.org1.example.com'
						},
						{
							mspid:'Org2MSP',
							endpoint:'peer0.org2.example.com:7051',
							ledger_height:4,
							chaincodes:[{name:'example',version:'v2'}],
							name:'peer0.org2.example.com'
						},
					]
				}
			},
			layouts:[{G0:1}]
		}
	}
};


test('\n\n ** DiscoveryEndorsementHandler - test **\n\n', async (t) => {

	const client = new Client();
	const temp = client.getConfigSetting('endorsement-handler-path');
	client.setConfigSetting('endorsement-handler-path', 'fabric-client/lib/impl/DiscoveryEndorsementHandler.js');
	const channel = client.newChannel('handlertest');
	const handler = channel._endorsement_handler;
	if(handler && handler.endorse) {
		t.pass('Able to have the channel create the handler');
	} else {
		t.fail('Channel was not able to create the handler');
		t.end();
		return;
	}
	let parameters = null;
	await errorChecker(t, handler, parameters, 'Missing all');
	parameters = {};
	await errorChecker(t, handler, parameters, 'Missing "request"');
	parameters.request = {};
	await errorChecker(t, handler, parameters, 'Missing "signed_proposal"');
	parameters.signed_proposal = {};
	await errorChecker(t, handler, parameters, 'Missing "chaincodeId"');
	parameters.request.chaincodeId = 'somename';
	await errorChecker(t, handler, parameters, 'Missing "txId"');
	parameters.request.txId = 'someid';
	await errorChecker(t, handler, parameters, 'Missing "args"');

	if(temp) client.setConfigSetting('endorsement-handler-path', temp);
	t.end();
});

async function errorChecker(t, handler, parameters, error_text) {
	try {
		await handler.endorse(parameters);
	} catch(error) {
		if(error.toString().indexOf(error_text)) {
			t.pass('Check for :' + error_text);
		} else {
			t.fail('Check for :' + error_text);
		}
	}
}
