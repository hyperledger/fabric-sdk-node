/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Network } from '../../network';
import * as GatewayUtils from '../gatewayutils';
import {
	Channel,
	Endorser,
	EventService,
	IdentityContext,
	StartRequestOptions,
	Eventer
} from 'fabric-common';
import * as Logger from '../../logger';
const logger = Logger.getLogger('EventSourceManager');

export class EventServiceManager {
	private readonly network: Network;
	private readonly channel: Channel;
	private readonly mspId: string;
	private readonly eventServices = new Map<Endorser, EventService>();
	private readonly identityContext: IdentityContext;

	constructor(network: Network) {
		this.network = network;
		this.channel = network.getChannel();
		this.mspId = network.getGateway().getIdentity().mspId;
		this.identityContext = this.network.getGateway().identityContext!;
		logger.debug('constructor - network:%s', this.network.getChannel().name);
	}

	/**
	 * Get a shared event service that can only be used for realtime listening to filtered events. These event services
	 * provide high performance event listening for commit events.
	 * @param peer Peer from which to receive events.
	 * @returns An event service.
	 */
	getCommitEventService(peer: Endorser): EventService {
		let eventService = this.eventServices.get(peer);
		if (!eventService) {
			eventService = this.newEventService([peer]);
			this.eventServices.set(peer, eventService);
		}

		return eventService;
	}

	/**
	 * Use this method to be sure the event service has been connected and has been started. If the event service is not
	 * started, it will start the service based on the options provided. If the event service is already started, it
	 * will check that the event service is compatible with the options provided.
	 * @param eventService EventService to be started if it not already started.
	 * @param options The options to start the event service.
	 */
	async startEventService(eventService: EventService, options = {} as StartRequestOptions): Promise<void> {
		logger.debug('startEventService - start %s', this.network.getChannel().name);

		if (eventService.isStarted() || eventService.isInUse()) {
			return this.assertValidOptionsForStartedService(options, eventService);
		}

		eventService.build(this.identityContext, options);
		eventService.sign(this.identityContext);
		// targets must be previously assigned
		await eventService.send();
	}

	newDefaultEventService(): EventService {
		const peers = this.getEventPeers();
		GatewayUtils.shuffle(peers);
		return this.newEventService(peers);
	}

	close(): void {
		this.eventServices.forEach((eventService) => eventService.close());
	}

	/**
	 * This method will build fabric-common Eventers and the fabric-common
	 * EventService. The Eventers will not be connected to the endpoint at
	 * this time. Since the endorsers have been previously connected, the
	 * endpoint should be accessable. The EventService will check the connection
	 * and perform the connect during the send() when it starts the service.
	 * @param peers The Endorser service endpoints used to build a
	 *  a list of {@link Eventer} service endpoints that will be used as the
	 *  targets of the new EventService.
	 */
	private newEventService(peers: Endorser[]): EventService {
		const serviceName = this.createName(peers);
		const eventService = this.channel.newEventService(serviceName);

		const eventers = peers.map((peer) => this.newEventer(peer));
		eventService.setTargets(eventers);

		return eventService;
	}

	private newEventer(peer: Endorser): Eventer {
		const eventer = this.channel.client.newEventer(peer.name);
		eventer.setEndpoint(peer.endpoint);
		return eventer;
	}

	private createName(peers: Endorser[]): string {
		return peers.map((peer) => peer.name).join(',');
	}

	private assertValidOptionsForStartedService(options: StartRequestOptions, eventService: EventService): void {
		if (options.blockType && options.blockType !== eventService.blockType) {
			throw new Error('EventService is not receiving the correct blockType');
		}
		if (options.startBlock) {
			throw new Error('EventService is started and not usable for replay');
		}
	}

	private getEventPeers(): Endorser[] {
		const orgPeers = this.getOrganizationPeers();
		return orgPeers.length > 0 ? orgPeers : this.getNetworkPeers();
	}

	private getOrganizationPeers(): Endorser[] {
		return this.channel.getEndorsers(this.mspId);
	}

	private getNetworkPeers(): Endorser[] {
		return this.channel.getEndorsers();
	}
}
