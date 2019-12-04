/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const rewire = require('rewire');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const should = chai.should();
chai.use(chaiAsPromised);
const sinon = require('sinon');

const {convertToLong} = require('../lib/Utils.js');
const EventListener = rewire('../lib/EventListener');

describe('EventListener', () => {

	describe('#constructor', () => {
		it('should require a listenerType', () => {
			(() => {
				new EventListener();
			}).should.throw('Missing eventService parameter');
		});
		it('should require a listenerType', () => {
			(() => {
				new EventListener('eventService');
			}).should.throw('Missing listenerType parameter');
		});
		it('should require a callback', () => {
			(() => {
				new EventListener('eventService', 'block');
			}).should.throw('Missing callback parameter');
		});
		it('should require an event', () => {
			(() => {
				new EventListener('eventService', 'tx', {});
			}).should.throw('Missing event parameter');
		});
		it('should require an event', () => {
			(() => {
				new EventListener('eventService', 'chaincode', {});
			}).should.throw('Missing event parameter');
		});
		it('should default block listener', () => {
			const el = new EventListener('eventService', 'block', {});
			el.type.should.equal('EventListener');
			el.unregister.should.be.false;
		});
		it('should default tx listener', () => {
			const el = new EventListener('eventService', 'tx', {}, {}, 'txid');
			el.type.should.equal('EventListener');
			el.unregister.should.be.true;
		});
		it('should default chaincode listener', () => {
			const el = new EventListener('eventService', 'chaincode', {}, {}, 'event');
			el.type.should.equal('EventListener');
			el.unregister.should.be.false;
		});
		it('should with option block listener', () => {
			const el = new EventListener('eventService', 'block', {}, {unregister: true});
			el.type.should.equal('EventListener');
			el.unregister.should.be.true;
		});
		it('should with option tx listener', () => {
			const el = new EventListener('eventService', 'tx', {}, {unregister: false}, 'txid');
			el.type.should.equal('EventListener');
			el.unregister.should.be.false;
		});
		it('should with option chaincode listener', () => {
			const el = new EventListener('eventService', 'chaincode', {}, {unregister: true}, 'event');
			el.type.should.equal('EventListener');
			el.unregister.should.be.true;
		});
		it('should set start and end of block listener', () => {
			const el = new EventListener('eventService', 'block', {}, {startBlock: 33, endBlock: 44});
			el.type.should.equal('EventListener');
			el.unregister.should.be.false;
			el.startBlock.should.be.deep.equal(convertToLong(33));
			el.endBlock.should.be.deep.equal(convertToLong(44));
		});
	});

	describe('#onEvent', () => {
		it('call the onEvent with no hits on start or end', () => {
			const options = {
				unregister: true,
				startBlock: convertToLong(10),
				endBlock: convertToLong(20)
			};
			let blockNumber = convertToLong(14);
			let transactionId = '1';
			let transactionStatus = 'invalid';
			const eventListener = new EventListener('eventService', 'tx', (error, event) => {
				blockNumber = event.blockNumber;
				transactionId = event.transactionId;
				transactionStatus = event.transactionStatus;
			}, options, '12345');
			const event = {
				eventHub: eventListener,
				blockNumber: convertToLong(15),
				transactionId: '2',
				transactionStatus: 'valid'
			};

			eventListener.onEvent(null, event);
			blockNumber.should.be.deep.equal(convertToLong(15));
			should.equal(transactionId, '2');
			should.equal(transactionStatus, 'valid');
		});

		it('call the onEvent with a hit on start', () => {
			const options = {
				unregister: true,
				startBlock: convertToLong(10),
				endBlock: convertToLong(20)
			};
			let blockNumber = convertToLong(9);
			let transactionId = '9';
			let transactionStatus = 'invalid';
			const eventListener = new EventListener('eventService', 'tx', (error, event) => {
				blockNumber = event.blockNumber;
				transactionId = event.transactionId;
				transactionStatus = event.transactionStatus;
			}, options, '12345');
			const event = {
				eventHub: eventListener,
				blockNumber: convertToLong(5),
				transactionId: '2',
				transactionStatus: 'valid'
			};

			eventListener.onEvent(null, event);
			blockNumber.should.be.deep.equal(convertToLong(9));
			should.equal(transactionId, '9');
			should.equal(transactionStatus, 'invalid');
		});

		it('call the onEvent with a hit on end', () => {
			const options = {
				unregister: true,
				startBlock: convertToLong(10),
				endBlock: convertToLong(20)
			};
			let blockNumber = convertToLong(9);
			let transactionId = '9';
			let transactionStatus = 'invalid';
			const eventListener = new EventListener('eventService', 'tx', (error, event) => {
				blockNumber = event.blockNumber;
				transactionId = event.transactionId;
				transactionStatus = event.transactionStatus;
			}, options, '12345');
			const event = {
				eventHub: eventListener,
				blockNumber: convertToLong(21),
				transactionId: '2',
				transactionStatus: 'valid'
			};

			eventListener.onEvent(null, event);
			blockNumber.should.be.deep.equal(convertToLong(9));
			should.equal(transactionId, '9');
			should.equal(transactionStatus, 'invalid');
		});

		it('call the onEvent with an error', () => {
			let called_with_error = false;
			const eventListener = new EventListener('eventService', 'tx', (error, event) => {
				called_with_error = true;
			}, null, '12345');

			eventListener.onEvent(new Error('fake'), null);
			should.equal(called_with_error, true);
		});

		it('have the callback throw an error', () => {
			let called_with_error = false;
			const eventListener = new EventListener('eventService', 'tx', (error, event) => {
				called_with_error = true;
				throw Error('callback error');
			}, null, '12345');
			const event = {
				eventHub: eventListener,
				blockNumber: convertToLong(21),
				transactionId: '2',
				transactionStatus: 'valid'
			};
			eventListener.onEvent(null, event);
			should.equal(called_with_error, true);
		});
	});

	describe('#unregister', () => {
		it('should run', () => {
			const eventService = sinon.stub();
			eventService.unregisterEventListener = sinon.stub();
			const eventListener = new EventListener(eventService, 'tx', {}, {}, '1AB34');
			eventListener.unregisterEventListener();
		});
	});

	describe('#toString', () => {
		it('should return string', () => {
			const eventListener = new EventListener('eventService', 'tx', {}, {}, '1AB34');
			const string = eventListener.toString();
			should.equal(string,
				'EventListener: { listenerType: tx, startBlock: null, endBlock: null, unregister: true, event: 1AB34}');
		});

		it('should return string', () => {
			const eventListener = new EventListener('eventService', 'chaincode', {}, {}, 'event');
			const string = eventListener.toString();
			should.equal(string,
				'EventListener: { listenerType: chaincode, startBlock: null, endBlock: null, unregister: false, event: event}');
		});
	});
});
