/**
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const utils = require('fabric-client/lib/utils.js');
const logger = utils.getLogger('E2E setAnchorPeers');

const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);

const fs = require('fs');
const path = require('path');

const testUtil = require('../../unit/util.js');
const channel_name = testUtil.NETWORK_END2END.channel;
const anchorPeerTXFileOrg1 = path.join(__dirname, '../../fixtures/channel/mychannel-org1anchor.tx');


test('\n\n***** Network End-to-end flow: setAnchorPeers *****\n\n', async (t) => {
	// this will use the connection profile to set up the client
	const client_org1 = await testUtil.getClientForOrg(t, 'org1');
	const client_org2 = await testUtil.getClientForOrg(t, 'org2');

	client_org1.setConfigSetting('initialize-with-discovery', true);

	try {
		await updateChannel(t, anchorPeerTXFileOrg1, channel_name, client_org1, client_org2); // set the anchor peer org1
		t.pass('***** Channel is created and anchor peer updated *****');
	} catch (error) {
		console.log(error); // eslint-disable-line
		t.fail('Failed to create and update the channel');
	}

});

async function updateChannel(t, file, channelName, client_org1, client_org2) {
	// get the config envelope created by the configtx tool
	const envelope_bytes = fs.readFileSync(file);
	// Have the sdk get the config update object from the envelope.
	// the config update object is what is required to be signed by all
	// participating organizations
	const config = client_org1.extractChannelConfig(envelope_bytes);
	t.pass('Successfully extracted the config update from the configtx envelope');

	const signatures = [];
	// sign the config by the  admins
	const signature1 = client_org1.signChannelConfig(config);
	signatures.push(signature1);
	t.pass('Successfully signed config update for org1');
	const signature2 = client_org2.signChannelConfig(config);
	signatures.push(signature2);
	t.pass('Successfully signed config update for org2');
	// now we have enough signatures...

	// get an admin based transaction
	const tx_id = client_org1.newTransactionID(true);

	const request = {
		config: config,
		signatures : signatures,
		name : channelName,
		orderer : 'orderer.example.com',
		txId  : tx_id
	};

	try {
		const results = await client_org1.updateChannel(request);
		if (results.status === 'SUCCESS') {
			t.pass('Successfully updated the channel.');
			await testUtil.sleep(5000);
		} else {
			t.fail('Failed to create the channel. ' + results.status + ' :: ' + results.info);
			throw new Error('Failed to update the channel. ');
		}
	} catch (error) {
		logger.error('catch network config test error:: %s', error.stack ? error.stack : error);
		t.fail('Failed to update channel :' + error);
		throw Error('Failed to update the channel');
	}
}
