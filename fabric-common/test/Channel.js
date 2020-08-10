/**
 * Copyright 2018 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const chai = require('chai');
const assert = require('chai').assert;
const rewire = require('rewire');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();

const Channel = rewire('../lib/Channel');
const Client = require('../lib/Client');
const fabproto6 = require('fabric-protos');

describe('Channel', () => {
	let client;
	let channel;

	const getEndorser = (name, mspid) => {
		const endorser = client.newEndorser(name, mspid);
		endorser.connected = true;
		endorser.name = name;
		endorser.mspid = mspid;
		endorser.type = 'Endorser';

		return endorser;
	};

	const getCommitter = (name, mspid) => {
		const committer = client.newCommitter(name, mspid);
		committer.connected = true;
		committer.name = name;
		committer.mspid = mspid;
		committer.type = 'Committer';

		return committer;
	};

	beforeEach(() => {
		client = new Client('myclient');
		channel = new Channel('mychannel', client);
	});

	describe('#constructor', () => {
		it('should require a name', () => {
			(() => {
				new Channel();
			}).should.throw('Missing name parameter');
		});

		it('should require a client', () => {
			(() => {
				new Channel('mychannel');
			}).should.throw('Missing client parameter');
		});

		it('should be able to create a channel', () => {
			client.getConfigSetting = () => {
				return {pattern: '^[a-z][a-z0-9.-]*$', flags: ''};
			};
			channel = client.newChannel('mychannel');
			channel.name.should.equal('mychannel');
		});
		it('should be able to create a channel with no regex pattern', () => {
			client.getConfigSetting = () => {
				return {};
			};
			channel = client.newChannel('mychannel');
			channel.name.should.equal('mychannel');
		});
		it('should not be able to create a channel', () => {
			(() => {
				client.getConfigSetting = () => {
					return {pattern: '^[A-Z]*$', flags: 'g'};
				};
				channel = client.newChannel('mychannel');
			}).should.throw('Failed to create Channel. channel name should match Regex /^[A-Z]*$/g, but got mychannel');
		});
	});

	describe('#close', () => {
		it('should be able close with no endpoints', () => {
			channel.close();
		});
		it('should be able close with endpoints', () => {
			channel.addEndorser(getEndorser('endoser1'));
			channel.addCommitter(getCommitter('committer1'));
			channel.close();
		});
	});
	describe('#newEndorsement', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newEndorsement();
			}).should.throw('Missing chaincodeId parameter');
		});

		it('should be able to create an endorsement', () => {
			channel.newEndorsement('chaincodeId');
		});
	});
	describe('#newQuery', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newQuery();
			}).should.throw('Missing chaincodeId parameter');
		});

		it('should be able to create a query', () => {
			channel.newQuery('chaincodeId');
		});
	});
	describe('#newCommit', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newCommit();
			}).should.throw('Missing chaincodeId parameter');
		});

		it('should be able to create a commit', () => {
			channel.newCommit('chaincodeId');
		});
	});
	describe('#newEventService', () => {
		it('should require a name', () => {
			(() => {
				channel.newEventService();
			}).should.throw('Missing name parameter');
		});

		it('should be able to create an eventService', () => {
			channel.newEventService('name');
		});
	});
	describe('#newDiscoveryService', () => {
		it('should require a name', () => {
			(() => {
				channel.newDiscoveryService();
			}).should.throw('Missing name parameter');
		});

		it('should be able to create a discovery', () => {
			channel.newDiscoveryService('name');
		});
	});
	describe('#getMspids', () => {
		it('should be able to getMspids when none', () => {
			const list = channel.getMspids();
			assert.isTrue(Array.isArray(list), 'getMspids returns and array');
		});
		it('should be able to getMspids', () => {
			channel.addMsp({id: 'mymsp'});
			const list = channel.getMspids();
			assert.isTrue(Array.isArray(list), 'getMspids returns and array');
		});
	});
	describe('#getMsp', () => {
		it('should require a id', () => {
			(() => {
				channel.getMsp();
			}).should.throw('Missing id parameter');
		});
		it('should be able to getMsp', () => {
			channel.getMsp('id');
		});
	});
	describe('#removeMsp', () => {
		it('should require a id', () => {
			(() => {
				channel.removeMsp();
			}).should.throw('Missing id parameter');
		});
		it('should be able call removeMsp with nonexistent msp', () => {
			assert.isFalse(channel.removeMsp('id'), 'Should get false if no msp top remove');
		});
		it('should be able removeMsp', () => {
			channel.addMsp({id: 'id'});
			assert.isTrue(channel.removeMsp('id'), 'Should get true if remove msp');
		});
	});
	describe('#addMsp', () => {
		it('should require a msp', () => {
			(() => {
				channel.addMsp();
			}).should.throw('Missing msp parameter');
		});
		it('should require a msp.id', () => {
			(() => {
				channel.addMsp('msp');
			}).should.throw('MSP does not have an id');
		});
		it('should be able to addMsp', () => {
			channel.addMsp({id: 'msp'});
		});
		it('should see already exist msp.id', () => {
			(() => {
				channel.addMsp({id: 'msp'});
				channel.addMsp({id: 'msp'});
			}).should.throw('MSP msp already exists');
		});
		it('should be able to addMsp with replace true', () => {
			channel.addMsp({id: 'msp'});
			channel.addMsp({id: 'msp'}, true);
		});
	});
	describe('#addEndorser', () => {
		it('should require a endorser', () => {
			(() => {
				channel.addEndorser();
			}).should.throw('Missing endorser parameter');
		});
		it('should require a endorser.name', () => {
			(() => {
				channel.addEndorser('endorser');
			}).should.throw('Endorser does not have a name');
		});
		it('should require a endorser type', () => {
			(() => {
				channel.addEndorser({name: 'endorser'});
			}).should.throw('Missing valid endorser instance');
		});
		it('should be able to addEndorser', () => {
			const endorser1 = getEndorser('endorser');
			channel.addEndorser(endorser1);
		});
		it('should not be able to addEndorser when not connected', () => {
			(() => {
				const endorser1 = getEndorser('endorser');
				endorser1.connected = false;
				channel.addEndorser(endorser1);
			}).should.throw('Endorser must be connectable');
		});
		it('should find a endorser.name', () => {
			(() => {
				const endorser1 = getEndorser('endorser');
				const endorser2 = getEndorser('endorser');
				channel.addEndorser(endorser1);
				channel.addEndorser(endorser2);
			}).should.throw('Endorser endorser already exists');
		});
		it('should be able to addEndorser with replace true', () => {
			const endorser1 = getEndorser('endorser');
			const endorser2 = getEndorser('endorser');
			channel.addEndorser(endorser1);
			channel.addEndorser(endorser2, true);
		});
	});
	describe('#removeEndorser', () => {
		it('should require a endorser', () => {
			(() => {
				channel.removeEndorser();
			}).should.throw('Missing endorser parameter');
		});
		it('should require a endorser', () => {
			(() => {
				channel.removeEndorser('endorser');
			}).should.throw('Missing valid endorser instance');
		});
		it('should be able call removeEndorser without a endorser added', () => {
			const endorser = getEndorser('endorser');
			assert.isFalse(channel.removeEndorser(endorser), 'should be able to call remove without a endorser added');
		});
		it('should be able removeEndorser', () => {
			const endorser = getEndorser('endorser');
			channel.addEndorser(endorser);
			assert.isTrue(channel.removeEndorser(endorser), 'should be able to removeEndorser');
		});
	});
	describe('#getEndorser', () => {
		it('should require a endorser name', () => {
			(() => {
				channel.getEndorser();
			}).should.throw('Missing name parameter');
		});
		it('should be able to getEndorser null', () => {
			const check = channel.getEndorser('endorser');
			assert.isUndefined(check, 'Able to get a undefined endorser');
		});
		it('should be able to getEndorser', () => {
			const endorser = getEndorser('endorser');
			channel.addEndorser(endorser);
			const check = channel.getEndorser('endorser');
			assert.deepEqual(endorser, check, 'Able to get a endorser');
		});
	});
	describe('#addCommitter', () => {
		it('should require a committer', () => {
			(() => {
				channel.addCommitter();
			}).should.throw('Missing committer parameter');
		});
		it('should require a committer.name', () => {
			(() => {
				channel.addCommitter('committer');
			}).should.throw('Committer does not have a name');
		});
		it('should require committer type', () => {
			(() => {
				channel.addCommitter({name: 'committer'});
			}).should.throw('Missing valid committer instance');
		});
		it('should be able to addCommitter', () => {
			const committer1 = getCommitter('committer');
			channel.addCommitter(committer1);
		});
		it('should not be able to addCommitter when not connected', () => {
			(() => {
				const committer1 = getCommitter('committer');
				committer1.connected = false;
				channel.addCommitter(committer1);
			}).should.throw('Committer must be connectable');
		});
		it('should find a committer.name', () => {
			(() => {
				const committer1 = getCommitter('committer');
				const committer2 = getCommitter('committer');
				channel.addCommitter(committer1);
				channel.addCommitter(committer2);
			}).should.throw('Committer committer already exists');
		});
		it('should be able to addCommitter with replace true', () => {
			const committer1 = getCommitter('committer');
			const committer2 = getCommitter('committer');
			channel.addCommitter(committer1);
			channel.addCommitter(committer2, true);
		});
	});
	describe('#removeCommitter', () => {
		it('should require a Committer', () => {
			(() => {
				channel.removeCommitter();
			}).should.throw('Missing committer parameter');
		});
		it('should require a committer', () => {
			(() => {
				channel.removeCommitter('committer');
			}).should.throw('Missing valid committer instance');
		});
		it('should be able call removeCommitter and not fail if no committer', () => {
			const committer = getCommitter('committer');
			assert.isFalse(channel.removeCommitter(committer), 'should not remove committer');
		});
		it('should be able to removeCommitter', () => {
			const committer = getCommitter('committer');
			channel.addCommitter(committer);
			assert.isTrue(channel.removeCommitter(committer), 'should be able to remove committer');
		});
	});
	describe('#getCommitter', () => {
		it('should require a committer name', async () => {
			(() => {
				channel.getCommitter();
			}).should.throw('Missing name parameter');
		});
		it('should be able to getCommitter null', async () => {
			const check = channel.getCommitter('committer');
			assert.isUndefined(check, 'Able to get a undefined committer');
		});
		it('should be able to getCommitter', async () => {
			const committer = getCommitter('committer');
			channel.addCommitter(committer);
			const check = channel.getCommitter('committer');
			assert.deepEqual(committer, check, 'Able to get a committer');
		});
	});
	describe('#getEndorsers', () => {
		it('should be able to getEndorsers empty array', () => {
			const check = channel.getEndorsers();
			assert.isEmpty(check, 'Able to get an empty array');
		});
		it('should be able to getEndorsers', () => {
			channel.addEndorser(getEndorser('endorser1', 'msp1'));
			channel.addEndorser(getEndorser('endorser2', 'msp2'));
			const check = channel.getEndorsers();
			assert.lengthOf(check, 2, 'Able to get a list of 2');
		});
		it('should be able to getEndorsers', () => {
			channel.addEndorser(getEndorser('endorser1', 'msp1'));
			channel.addEndorser(getEndorser('endorser2', 'msp2'));
			const check = channel.getEndorsers('msp1');
			assert.lengthOf(check, 1, 'Able to get a list of 2');
		});
	});
	describe('#getCommitters', () => {
		it('should be able to getCommitters empty array', () => {
			const check = channel.getCommitters();
			assert.isEmpty(check, 'Able to get an empty array');
		});
		it('should be able to getCommitters', () => {
			channel.addCommitter(getCommitter('committer1', 'msp1'));
			channel.addCommitter(getCommitter('committer2', 'msp2'));
			const check = channel.getCommitters();
			assert.lengthOf(check, 2, 'Able to get a list of 2');
		});
		it('should be able to getCommitters', () => {
			channel.addCommitter(getCommitter('committer1', 'msp1'));
			channel.addCommitter(getCommitter('committer2', 'msp2'));
			const check = channel.getCommitters('msp1');
			assert.lengthOf(check, 1, 'Able to get a list of 1');
		});
	});
	describe('#getTargetCommitters', () => {
		it('should require targets', () => {
			(() => {
				channel.getTargetCommitters();
			}).should.throw('Missing targets parameter');
		});
		it('should be an array of targets', () => {
			(() => {
				channel.getTargetCommitters('target');
			}).should.throw('Targets must be an array');
		});
		it('should be not found targets', () => {
			(() => {
				channel.getTargetCommitters(['name1']);
			}).should.throw('Committer named name1 not found');
		});
		it('should be not valid targets', () => {
			(() => {
				const not_valid = getEndorser('not_valid');
				channel.getTargetCommitters([not_valid]);
			}).should.throw('Target Committer is not valid');
		});
		it('should be able to getTargetCommitters by name', () => {
			channel.addCommitter(getCommitter('name1', 'msp1'));
			channel.addCommitter(getCommitter('name2', 'msp2'));
			const check1 = channel.getTargetCommitters(['name1', 'name2']);
			assert.lengthOf(check1, 2, 'Able to get a list of 2');
			const check2 = channel.getTargetCommitters(['name2']);
			assert.lengthOf(check2, 1, 'Able to get a list of 1');
		});
		it('should be able to getTargetCommitters by object', () => {
			const committer = getCommitter('name1');
			const check = channel.getTargetCommitters([committer]);
			assert.lengthOf(check, 1, 'Able to get a list of 1');
		});
	});
	describe('#getTargetEndorsers', () => {
		it('should require targets', () => {
			(() => {
				channel.getTargetEndorsers();
			}).should.throw('Missing targets parameter');
		});
		it('should be an array of targets', () => {
			(() => {
				channel.getTargetEndorsers('target');
			}).should.throw('Targets must be an array');
		});
		it('should be not found targets', () => {
			(() => {
				channel.getTargetEndorsers(['name1']);
			}).should.throw('Endorser named name1 not found');
		});
		it('should be not valid targets', () => {
			(() => {
				const not_valid = getCommitter('not_valid');
				channel.getTargetEndorsers([not_valid]);
			}).should.throw('Target Endorser is not valid');
		});
		it('should be able to getTargetEndorsers by name', () => {
			channel.addEndorser(getEndorser('name1', 'msp1'));
			channel.addEndorser(getEndorser('name2', 'msp2'));
			const check1 = channel.getTargetEndorsers(['name1', 'name2']);
			assert.lengthOf(check1, 2, 'Able to get a list of 2');
			const check2 = channel.getTargetEndorsers(['name2']);
			assert.lengthOf(check2, 1, 'Able to get a list of 1');
		});
		it('should be able to getTargetEndorsers by object', () => {
			const endorser = getEndorser('name1');
			const check = channel.getTargetEndorsers([endorser]);
			assert.lengthOf(check, 1, 'Able to get a list of 1');
		});
	});
	describe('#buildChannelHeader', () => {
		it('should require type', () => {
			(() => {
				channel.buildChannelHeader();
			}).should.throw('Missing type parameter');
		});
		it('should require chaincode_id', () => {
			(() => {
				channel.buildChannelHeader('type');
			}).should.throw('Missing chaincode_id parameter');
		});
		it('should require tx_id', () => {
			(() => {
				channel.buildChannelHeader('type', 'chaincode_id');
			}).should.throw('Missing tx_id parameter');
		});
		it('should be able to buildChannelHeader', () => {
			client.getClientCertHash = () => {
				return Buffer.from('clientCert');
			};
			const channelHeaderBuff = channel.buildChannelHeader(1, 'mychaincode', '1234');
			const channel_header = fabproto6.common.ChannelHeader.decode(channelHeaderBuff);
			assert.equal(channel_header.tx_id, '1234', 'Able to build object with tx_id');
			assert.equal(channel_header.channel_id, 'mychannel', 'Able to build object with channelID');
		});
	});
	describe('#toString', () => {
		it('should be able to toString', () => {
			const channel_string = channel.toString();
			assert.equal(channel_string,
				'{"name":"mychannel","committers":"N/A","endorsers":"N/A"}',
				'toString has all this'
			);
		});
		it('should be able to toString', () => {
			channel.addEndorser(getEndorser('endorser1'));
			channel.addCommitter(getCommitter('committer1'));
			const channel_string = channel.toString();
			assert.equal(channel_string,
				'{"name":"mychannel","committers":["Committer- name: committer1, url:<not connected>, connected:true, connectAttempted:false"],"endorsers":["Endorser- name: endorser1, url:<not connected>, connected:true, connectAttempted:false"]}',
				'toString has all this'
			);
		});
	});
});
