/**
 * Copyright 2021 Oracle All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const DiscoveryProposal = require('../lib/DiscoveryProposal');

const chai = require('chai');
chai.should();
const Client = require('../lib/Client');
describe('DiscoveryProposal', () => {

	const client = new Client('myclient');
	const channel = client.newChannel('mychannel');
	let proposal;
	beforeEach(async () => {
		proposal = new DiscoveryProposal('chaincode', channel);
	});
	describe('#buildProposalInterest', () => {
		it('should return interest', () => {
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}]);
		});
		it('should return interest and collections', () => {
			const collections = ['col1', 'col2'];
			proposal.collectionsInterest = collections;
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false, collectionNames: collections}]);
		});
		it('should return interest and collections with noPrivateReads', () => {
			const collections = ['col1', 'col2'];
			proposal.collectionsInterest = collections;
			proposal.noPrivateReads = true;
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: true, collectionNames: collections}]);
		});
		it('should return interest and chaincode and chaincode collections ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2']};
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should return interest and chaincode and chaincode collections with no private reads ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2'], noPrivateReads: true};
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should return interest and chaincode and chaincode collections with no private reads ', () => {
			const chaincode_collection = {name: 'chain2', collectionNames: ['col1', 'col2'], noPrivateReads: true};
			proposal.noPrivateReads = true;
			proposal.chaincodesCollectionsInterest = [chaincode_collection];
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: true}, chaincode_collection]);
		});
	});

	describe('#addCollectionInterest', () => {
		it('should save collection interest', () => {
			proposal.addCollectionInterest('col1');
			proposal.collectionsInterest.should.deep.equal(['col1']);
		});
		it('should save collection interest', () => {
			const collections = ['col1', 'col2'];
			proposal.addCollectionInterest('col1');
			proposal.addCollectionInterest('col2');
			proposal.collectionsInterest.should.deep.equal(collections);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false, collectionNames: collections}]);
		});
		it('should require a string collection name', () => {
			(() => {
				proposal.addCollectionInterest({});
			}).should.throw('Invalid collectionName parameter');
		});
	});

	describe('#setNoPrivateReads', () => {
		it('should set no private reads', () => {
			proposal.setNoPrivateReads(true);
			proposal.noPrivateReads.should.equal(true);
		});
		it('should set no private reads false', () => {
			proposal.setNoPrivateReads(false);
			proposal.noPrivateReads.should.equal(false);
		});

		it('should require a boolean', () => {
			(() => {
				proposal.setNoPrivateReads({});
			}).should.throw(/The "no private reads" setting must be boolean/);
		});
	});

	describe('#addChaincodeCollectionsInterest', () => {
		it('should save chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false, collectionNames: ['col1', 'col2']};
			proposal.addChaincodeCollectionsInterest('chain2', 'col1', 'col2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should save chaincode only chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false};
			proposal.addChaincodeCollectionsInterest('chain2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should require a string chaincode name', () => {
			(() => {
				proposal.addChaincodeCollectionsInterest({});
			}).should.throw('Invalid chaincodeId parameter');
		});
	});

	describe('#addChaincodeNoPrivateReadsCollectionsInterest', () => {
		it('should save chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: true, collectionNames: ['col1', 'col2']};
			proposal.addChaincodeNoPrivateReadsCollectionsInterest('chain2', true, 'col1', 'col2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should save chaincode only chaincode collection interest', () => {
			const chaincode_collection = {name: 'chain2', noPrivateReads: false};
			proposal.addChaincodeNoPrivateReadsCollectionsInterest('chain2');
			proposal.chaincodesCollectionsInterest.should.deep.equal([chaincode_collection]);
			const interest = proposal.buildProposalInterest();
			interest.should.deep.equal([{name: 'chaincode', noPrivateReads: false}, chaincode_collection]);
		});
		it('should require a string chaincode name', () => {
			(() => {
				proposal.addChaincodeNoPrivateReadsCollectionsInterest({});
			}).should.throw('Invalid chaincodeId parameter');
		});
	});
});
