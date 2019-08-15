/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

/**
 * An abstract selection strategy that provides an interface for other selection
 * strategies
 *
 * @memberof module:fabric-network
 * @class
 */
class AbstractEventHubSelectionStrategy {
	/**
	 * @param {Peer[]} peers list of peers whose event hub should be used
	 */
	constructor(peers) {
		this.peers = peers;
	}
	/**
	 * Gets the next peer
	 * @returns {Peer}
	 */
	getNextPeer() {
		throw new Error('Abstract method called.');
	}

	/**
	 * Updates the availability of the peer
	 * @param {Peer} deadPeer Disconnected peer
	 */
	updateEventHubAvailability(deadPeer) {
		return;
	}

	getPeers() {
		return this.peers;
	}
}

module.exports = AbstractEventHubSelectionStrategy;
