/**
 * Copyright 2019 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const logger = require('fabric-network/lib/logger').getLogger('EventServiceManager');

/**
 * The Event Service Manager is responsible for creating and distributing {@link EventService} instances.
 * It uses the event Service factory to reuse event Services that exists, and maintains
 * its own list of new event Services that are used for event replay
 * @memberof module:fabric-network
 * @class
 * @private
 */
class EventServiceManager {
	/**
	 * Constructor
	 * @param {module:fabric-network.Network} network The network
	 */
	constructor(network) {
		const method = 'constructor';
		logger.debug('%s - start', method);

		this.network = network;
		this.identityContext = this.network.gateway.identityContext;

		// wait to build the list of peers until someone needs an event service
		// hopefully by then we have loaded the network (channel) with peers
		this.peerPool = null;

		this.eventServicesFiltered = new Map();
		this.eventServicesFull = new Map();
		this.eventServicesPrivate = new Map();
		this.eventServicesReplay = new Map();
	}
	/**
	 * Gets an event Service. If given a peer, it will get that peer's event Service,
	 * otherwise it will get the next peer as defined by the event service pool.
	 * NOTE: The returned event service will not be able to replay events. Use the
	 * {@EventServiceManager#getReplayEventService} to get an event service capable
	 * of replay.
	 * @param {string} [blockType] - The block type (filtered, full or private) that
	 * event service is receiving, the default will be filtered events
	 * @returns {EventService} The event Service
	 */
	getEventService(blockType) {
		const method = 'getEventService';
		logger.debug('%s - start', method);

		let pool;
		if (blockType === 'full') {
			pool = this.eventServicesFull;
			logger.debug('%s - eventService will receive full blocks', method);
		} else if (blockType === 'private') {
			pool = this.eventServicesPrivate;
			logger.debug('%s - eventService will receive full blocks with private data', method);
		} else {
			pool = this.eventServicesFiltered;
			logger.debug('%s - eventService will receive filtered blocks', method);
		}

		if (!this.peerPool) {
			this.peerPool = new RoundRobinPeerPool(this.network);
		}
		const peers = this.peerPool.getNextPeers();
		logger.debug('%s - got %s peers from selection strategy', method, peers.length);

		const name = peers.map(peer => peer.name).join('-');

		let eventService = pool.get(name);

		if (!eventService) {
			eventService = this.newEventService(peers, name);
			logger.debug('%s - saving eventService %s', method, eventService.name);
			pool.set(eventService.name, eventService);
		} else {
			logger.debug('%s - using existing eventService %', method, eventService.name);
		}

		logger.debug('%s - returning eventService %s', method, eventService.name);
		return eventService;
	}

	/**
	 * Gets a list of {@link EventService}s  for a list of peers {@link Endorser}
	 * provided. The returned event services will be receiving filtered blocks.
	 * If the peer list is not provided the event service selection strategy will
	 * be asked for it's full list of peers.
	 * @param {Endorser[]} [peers] - A list of endorser instances
	 * @returns {EventService[]} A list of event services
	 */
	getEventServices(peers) {
		const method = 'getEventServices';
		logger.debug('%s - start', method);

		if (!peers) {
			if (!this.peerPool) {
				this.peerPool = new RoundRobinPeerPool(this.network);
			}
			peers = this.peerPool.getPeers();
			logger.debug('%s - getting %s peers from selection strategy', method, peers.length);
		}

		// build EventService based on each peer's endpoint
		const eventServices = peers.map(peer => {
			let eventService = this.eventServicesFiltered.get(peer.name);
			if (!eventService) {
				eventService = this.newEventService([peer], peer.name);
				logger.debug('%s - created a new eventService %s', method, eventService.name);
				this.eventServicesFiltered.set(eventService.name, eventService);
			} else {
				logger.debug('%s - reusing eventService %s', method, eventService.name);
			}

			return eventService;
		});

		logger.debug('%s - returning %s eventServices', method, eventServices.length);
		return eventServices;
	}

	/**
	 * Gets an event Service instance for a given peer endpoint.
	 * @param {Endorser} [peer] An Endorser peer instance. If the peer is not provided,
	 * the next peer will be selected by the event service selection strategy.
	 * @returns {EventService} The event Service
	 */
	getReplayEventService(peer) {
		const method = 'getReplayEventService';
		logger.debug('%s - start', method);

		let _peers;
		let _name;

		if (!peer) {
			if (!this.peerPool) {
				this.peerPool = new RoundRobinPeerPool(this.network);
			}
			_peers = this.peerPool.getNextPeers();
			_name = _peers.map(_peer => _peer.name).join('-');
			logger.debug('%s - getting %s peers from selection strategy %s', method, _peers.length, _name);
		} else {
			_peers = [peer];
			_name = peer.name;
			logger.debug('%s - user provided the peer %s', method, _name);
		}

		let eventService = this.eventServicesReplay.get(_name);
		if (!eventService) {
			logger.debug('%s - create new replay event service %s', method, _name);
			eventService = this.newEventService(_peers, _name);
			// put on the list so we can shut it down with all the others
			this.eventServicesReplay.set(eventService, eventService);
		} else {
			logger.debug('%s - using existing replay event service %s', method, _name);
		}

		return eventService;
	}

	/**
	 * This method will build fabric-common Eventers and the fabric-common
	 * EventService. The Eventers will not be connected to the endpoint at
	 * this time. Since the endorsers have been previously connected, the
	 * endpoint should be accessable. The EventService will check the connection
	 * and perform the connect during the send() when it starts the service.
	 * @param {Endorser[]} peers - The Endorser service endpoints used to build a
	 *  a list of {@link Eventer} service endpoints that will be used as the
	 *  targets of the new EventService.
	 * @param {string} name - The name of this new EventService
	 */
	newEventService(peers, name) {
		const method = 'newEventService';
		logger.debug('%s - start', method);

		const eventers = [];
		for (const peer of peers) {
			const eventer = this.network.channel.client.newEventer(peer.name);
			eventer.setEndpoint(peer.endpoint);
			eventers.push(eventer);
			logger.debug('%s - built new eventer %s', method, eventer.name);
		}

		if (!name) {
			name = eventers[0].name;
		}
		const eventService = this.network.channel.newEventService(name);
		logger.debug('%s - setting targets for eventService %s', method, eventService.name);
		eventService.setTargets(eventers);

		return eventService;
	}

	/**
	 * Use this method to be sure the eventService has been connected and has
	 * been started. It will start the service based on the options provided.
	 * It will check that the a started service matches the options provided
	 * @param {EventService} eventService - EventService to be started if it not
	 * already started.
	 * @param {any} options - The options to start the event service which may
	 * include blocktype, startBlock, endBlock.
	 */
	async startEventService(eventService, options = {}) {
		const method = 'startService';
		logger.debug('%s - start', method);

		// see if running and if listening to correct block type
		const isStarted = eventService.isStarted();
		if (isStarted) {
			if (options.replay) {
				throw Error('EventService is started and not usable for replay');
			}

			if (options.blockType && options.blockType !== eventService.blockType) {
				throw Error('EventService is not receiving the correct blockType');
			}

			// if we get this far then we can use this 'started' eventService
			return;
		}

		logger.debug('%s - starting event service %s with blockType %s', method, eventService.name, options.blockType);
		// looks like we need to start this service
		eventService.build(this.identityContext, options);
		eventService.sign(this.identityContext);
		// targets must be previously assigned
		await eventService.send(options);
	}

	/**
	 * Closes and deletes all event services
	 */
	dispose() {
		this.eventServicesFiltered.forEach(eventService => eventService.close());
		this.eventServicesFiltered.clear();
		this.eventServicesFull.forEach(eventService => eventService.close());
		this.eventServicesFull.clear();
		this.eventServicesPrivate.forEach(eventService => eventService.close());
		this.eventServicesPrivate.clear();
		this.eventServicesReplay.forEach(eventService => eventService.close());
		this.eventServicesReplay.clear();
	}
}

/*
 * spreads out the load onto different event services from the same organization
 */
class RoundRobinPeerPool {
	/*
	 * Constructor.
	 * @param {Endorser[]} peers The list of peers that the strategy can choose from
	 */
	constructor(network) {
		const peers = network.channel.getEndorsers(network.mspid);
		if (!peers || peers.length === 0) {
			throw Error('No peers available');
		}
		this.peers = peers;
		this.lastPeerIndex = -1;
	}

	/*
	 * Get the next peer in the list of peers
	 * @returns {Endorser}
	 */
	getNextPeer() {
		this.lastPeerIndex++;
		if (this.lastPeerIndex >= this.peers.length) {
			this.lastPeerIndex = 0;
		}

		return this.peers[this.lastPeerIndex];
	}

	/*
	 * Get a list of peers where the orderer will be from the 'getNextPeer'
	 * method.
	 * Notice that the list will start on the next peer. Other calls to this
	 * selection before or after using either getNext method will start at
	 * the next peer.
	 * @returns {Endorser[]}
	 */
	getNextPeers() {
		const peers = [];
		for (let count = 0; count < this.peers.length; count++) {
			peers.push(this.getNextPeer());
		}
		// call one more time to move the index so the next call will
		// start on the next peer after the start index of this call.
		this.getNextPeer();

		return peers;
	}

	/*
	 * Get the peer list as provided. If peers are required to be
	 * in a getNextPeer orderer, use the 'getNextPeers' method to.
	 */
	getPeers() {
		return this.peers;
	}
}

module.exports = EventServiceManager;
