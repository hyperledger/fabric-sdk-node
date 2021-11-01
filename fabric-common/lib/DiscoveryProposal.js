/**
 * Copyright 2021 Oracle All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
const TYPE = 'DiscoveryProposal';

const Proposal = require('./Proposal');

class DiscoveryProposal extends Proposal {

	constructor(chaincodeId, channel) {
		super(chaincodeId, channel);
		// to be used to build a discovery interest
		this.noPrivateReads = false;
		this.collectionsInterest = [];
		this.chaincodesCollectionsInterest = [];
		this.type = TYPE;
	}

	/**
	 * Returns a JSON object representing this proposal's chaincodes,
	 * collections and the no private reads as an "interest" for the
	 * Discovery Service.
	 * The {@link Discovery} will use an interest to build a query
	 * request for an endorsement plan to a Peer's Discovery service.
	 * Use the {@link DiscoveryProposal#addCollectionInterest} to add collections
	 * for the chaincode of this proposal.
	 * Use the {@link DiscoveryProposal#setNoPrivateReads} to set this "no private reads"
	 * setting for this proposal's chaincode. The default will be false
	 * when not set.
	 * Use the {@link DiscoveryProposal#addChaincodeCollectionInterest} to add
	 * chaincodes and collections that this chaincode code will call.
	 * @example
	 *    [
	 *      { name: 'mychaincode', collectionNames: ['mycollection'] }
	 *    ]
	 * @example
	 *    [
	 *      { name: 'mychaincode', collectionNames: ['mycollection'], noPrivateReads: true }
	 *    ]
	 */
	buildProposalInterest() {

		const chaincode = {
			name: this.chaincodeId,
			noPrivateReads: this.noPrivateReads,
		};

		if (this.collectionsInterest.length > 0) {
			chaincode.collectionNames = this.collectionsInterest;
		}

		let interest = [chaincode];

		if (this.chaincodesCollectionsInterest.length > 0) {
			interest = interest.concat(this.chaincodesCollectionsInterest);
		}

		return interest;
	}

	/**
	 * Use this method to add collection names associated
	 * with this proposal's chaincode name. These will be
	 * used to build a Discovery interest. {@link DiscoveryProposal#buildProposalInterest}
	 * @param {string} collectionName - collection name
	 */
	addCollectionInterest(collectionName) {

		if (typeof collectionName !== 'string') {
			throw Error('Invalid collectionName parameter');
		}
		this.collectionsInterest.push(collectionName);

		return this;
	}

	/**
	 * Use this method to set the "no private reads" of the discovery hint
	 * (interest) for the chaincode of this proposal.
	 * @param {boolean} noPrivateReads Indicates we do not need to read from private data
	 */
	setNoPrivateReads(noPrivateReads) {
		if (typeof noPrivateReads !== 'boolean') {
			throw Error(`The "no private reads" setting must be boolean. :: ${noPrivateReads}`);
		}

		this.noPrivateReads = noPrivateReads;
		return this;
	}

	/**
	 * Use this method to add a chaincode name and the collection names
	 * that this proposal's chaincode will call along with the no private read
	 * setting. These will be used to build a Discovery interest when this proposal
	 * is used with the Discovery Service.
	 * @param {string} chaincodeId - chaincode name
	 * @param {boolean} noPrivateReads Indicates we do not need to read from private data
	 * @param  {...string} collectionNames - one or more collection names
	 */
	addChaincodeNoPrivateReadsCollectionsInterest(chaincodeId, noPrivateReads, ...collectionNames) {
		if (typeof chaincodeId !== 'string') {
			throw Error('Invalid chaincodeId parameter');
		}
		const added_chaincode = {
			name: chaincodeId,
			noPrivateReads: !!noPrivateReads
		};
		if (collectionNames && collectionNames.length > 0) {
			added_chaincode.collectionNames = collectionNames;
		}
		this.chaincodesCollectionsInterest.push(added_chaincode);

		return this;
	}

	/**
	 * Use this method to add a chaincode name and collection names
	 * that this proposal's chaincode will call. These will be used
	 * to build a Discovery interest when this proposal is used with
	 * the Discovery Service.
	 * @param {string} chaincodeId - chaincode name
	 * @param  {...string} collectionNames - one or more collection names
	 */
	addChaincodeCollectionsInterest(chaincodeId, ...collectionNames) {

		return this.addChaincodeNoPrivateReadsCollectionsInterest(chaincodeId, false, ...collectionNames);
	}
}

module.exports = DiscoveryProposal;