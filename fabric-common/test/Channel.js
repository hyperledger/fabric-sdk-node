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


describe('Channel', () => {
	let client;
	let channel;

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
		it('should be able close', () => {
			channel.close();
		});
		it('should be able close', () => {
			channel.addEndorser(client.newEndorser('endorser1'));
			channel.addCommitter(client.newCommitter('committer1'));
			channel.close();
		});
	});
	describe('#newEndorsement', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newEndorsement();
			}).should.throw('Missing chaincodeName parameter');
		});

		it('should be able to create an endorsement', () => {
			channel.newEndorsement('chaincodename');
		});
	});
	describe('#newQuery', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newQuery();
			}).should.throw('Missing chaincodeName parameter');
		});

		it('should be able to create a query', () => {
			channel.newQuery('chaincodename');
		});
	});
	describe('#newCommit', () => {
		it('should require a chaincode name', () => {
			(() => {
				channel.newCommit();
			}).should.throw('Missing chaincodeName parameter');
		});

		it('should be able to create a commit', () => {
			channel.newCommit('chaincodename');
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
	describe('#newDiscovery', () => {
		it('should require a name', () => {
			(() => {
				channel.newDiscovery();
			}).should.throw('Missing name parameter');
		});

		it('should be able to create a discovery', () => {
			channel.newDiscovery('name');
		});
	});
	describe('#getMspids', () => {
		it('should be able to getMspids when none', () => {
			const list = channel.getMspids();
			assert.isTrue(Array.isArray(list), 'getMspids returns and array');
		});
		it('should be able to getMspids', () => {
			channel.addMSP({id: 'mymsp'});
			const list = channel.getMspids();
			assert.isTrue(Array.isArray(list), 'getMspids returns and array');
		});
	});
	describe('#getMSP', () => {
		it('should require a id', () => {
			(() => {
				channel.getMSP();
			}).should.throw('Missing id parameter');
		});
		it('should be able to getMSP', () => {
			channel.getMSP('id');
		});
	});
	describe('#removeMSP', () => {
		it('should require a id', () => {
			(() => {
				channel.removeMSP();
			}).should.throw('Missing id parameter');
		});
		it('should be able call removeMSP with nonexistent msp', () => {
			assert.isFalse(channel.removeMSP('id'), 'Should get false if no msp top remove');
		});
		it('should be able removeMSP', () => {
			channel.addMSP({id: 'id'});
			assert.isTrue(channel.removeMSP('id'), 'Should get true if remove msp');
		});
	});
	describe('#addMSP', () => {
		it('should require a msp', () => {
			(() => {
				channel.addMSP();
			}).should.throw('Missing msp parameter');
		});
		it('should require a msp.id', () => {
			(() => {
				channel.addMSP('msp');
			}).should.throw('MSP does not have an id');
		});
		it('should be able to addMSP', () => {
			channel.addMSP({id: 'msp'});
		});
		it('should see already exist msp.id', () => {
			(() => {
				channel.addMSP({id: 'msp'});
				channel.addMSP({id: 'msp'});
			}).should.throw('MSP msp already exists');
		});
		it('should be able to addMSP with replace true', () => {
			channel.addMSP({id: 'msp'});
			channel.addMSP({id: 'msp'}, true);
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
			channel.addEndorser({name: 'endorser', type: 'Endorser'});
		});
		it('should find a endorser.name', () => {
			(() => {
				channel.addEndorser({name: 'endorser', type: 'Endorser'});
				channel.addEndorser({name: 'endorser', type: 'Endorser'});
			}).should.throw('Endorser endorser already exists');
		});
		it('should be able to addEndorser with replace true', () => {
			channel.addEndorser({name: 'endorser', type: 'Endorser'});
			channel.addEndorser({name: 'endorser', type: 'Endorser'}, true);
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
			const endorser = client.newEndorser('endorser');
			assert.isFalse(channel.removeEndorser(endorser), 'should be able to call remove without a endorser added');
		});
		it('should be able removeEndorser', () => {
			const endorser = client.newEndorser('endorser');
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
			const endorser = client.newEndorser('endorser');
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
			channel.addCommitter({name: 'committer', type: 'Committer'});
		});
		it('should find a committer.name', () => {
			(() => {
				channel.addCommitter({name: 'committer', type: 'Committer'});
				channel.addCommitter({name: 'committer', type: 'Committer'});
			}).should.throw('Committer committer already exists');
		});
		it('should be able to addCommitter with replace true', () => {
			channel.addCommitter({name: 'committer', type: 'Committer'});
			channel.addCommitter({name: 'committer', type: 'Committer'}, true);
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
			const committer = client.newCommitter('committer');
			assert.isFalse(channel.removeCommitter(committer), 'should not remove committer');
		});
		it('should be able to removeCommitter', () => {
			const committer = client.newCommitter('committer');
			channel.addCommitter(committer);
			assert.isTrue(channel.removeCommitter(committer), 'should be able to remove committer');
		});
	});
	describe('#getCommitter', () => {
		it('should require a committer name', () => {
			(() => {
				channel.getCommitter();
			}).should.throw('Missing name parameter');
		});
		it('should be able to getCommitter null', () => {
			const check = channel.getCommitter('committer');
			assert.isUndefined(check, 'Able to get a undefined committer');
		});
		it('should be able to getCommitter', () => {
			const committer = client.newCommitter('committer');
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
			channel.addEndorser(client.newEndorser('endorser1', 'msp1'));
			channel.addEndorser(client.newEndorser('endorser2', 'msp2'));
			const check = channel.getEndorsers();
			assert.lengthOf(check, 2, 'Able to get a list of 2');
		});
		it('should be able to getEndorsers', () => {
			channel.addEndorser(client.newEndorser('endorser1', 'msp1'));
			channel.addEndorser(client.newEndorser('endorser2', 'msp2'));
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
			channel.addCommitter(client.newCommitter('committer1', 'msp1'));
			channel.addCommitter(client.newCommitter('committer2', 'msp2'));
			const check = channel.getCommitters();
			assert.lengthOf(check, 2, 'Able to get a list of 2');
		});
		it('should be able to getCommitters', () => {
			channel.addCommitter(client.newCommitter('committer1', 'msp1'));
			channel.addCommitter(client.newCommitter('committer2', 'msp2'));
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
				const not_valid = client.newEndorser('not_valid');
				channel.getTargetCommitters([not_valid]);
			}).should.throw('Target Committer is not valid');
		});
		it('should be able to getTargetCommitters by name', () => {
			channel.addCommitter(client.newCommitter('name1', 'msp1'));
			channel.addCommitter(client.newCommitter('name2', 'msp2'));
			const check1 = channel.getTargetCommitters(['name1', 'name2']);
			assert.lengthOf(check1, 2, 'Able to get a list of 2');
			const check2 = channel.getTargetCommitters(['name2']);
			assert.lengthOf(check2, 1, 'Able to get a list of 1');
		});
		it('should be able to getTargetCommitters by object', () => {
			const committer = client.newCommitter('name1');
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
				const not_valid = client.newCommitter('not_valid');
				channel.getTargetEndorsers([not_valid]);
			}).should.throw('Target Endorser is not valid');
		});
		it('should be able to getTargetEndorsers by name', () => {
			channel.addEndorser(client.newEndorser('name1', 'msp1'));
			channel.addEndorser(client.newEndorser('name2', 'msp2'));
			const check1 = channel.getTargetEndorsers(['name1', 'name2']);
			assert.lengthOf(check1, 2, 'Able to get a list of 2');
			const check2 = channel.getTargetEndorsers(['name2']);
			assert.lengthOf(check2, 1, 'Able to get a list of 1');
		});
		it('should be able to getTargetEndorsers by object', () => {
			const endorser = client.newEndorser('name1');
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
			const channel_header = channel.buildChannelHeader(1, 'mychaincode', '1234');
			assert.equal(channel_header.getTxId(), '1234', 'Able to build object with tx_id');
			assert.equal(channel_header.getChannelId(), 'mychannel', 'Able to build object with channelID');
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
			channel.addEndorser(client.newEndorser('endorser1'));
			channel.addCommitter(client.newCommitter('committer1'));
			const channel_string = channel.toString();
			assert.equal(channel_string,
				'{"name":"mychannel","committers":["Committer- name: committer1, url:<not connected>"],"endorsers":["Endorser- name: endorser1, url:<not connected>"]}',
				'toString has all this'
			);
		});
	});
});
