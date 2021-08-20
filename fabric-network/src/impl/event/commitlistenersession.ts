/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {ListenerSession} from './listenersession';
import {
	CommitError,
	CommitEvent,
	CommitListener
} from '../../events';
import {EventServiceManager} from './eventservicemanager';
import {
	Endorser,
	EventListener,
	EventService,
	EventCallback
} from 'fabric-common';

import * as Logger from '../../logger';
import {newCommitEvent} from './commiteventfactory';
const logger = Logger.getLogger('CommitListenerSession');

export class CommitListenerSession implements ListenerSession {
	private readonly listener: CommitListener;
	private readonly eventServiceManager: EventServiceManager;
	private readonly eventServices: EventService[];
	private readonly transactionId: string;
	private readonly endorsers: {[name: string]: Endorser} = {};
	private eventListeners: EventListener[] = [];

	constructor(listener: CommitListener, eventServiceManager: EventServiceManager, endorsers: Endorser[], transactionId: string) {
		this.listener = listener;
		this.eventServiceManager = eventServiceManager;
		this.eventServices = endorsers.map((endorser) => eventServiceManager.getCommitEventService(endorser));
		this.transactionId = transactionId;

		for (const endorser of endorsers) {
			this.endorsers[endorser.name] = endorser;
		}
	}

	public async start() :Promise<void> {
		const startErrors = await this.registerTransactionListeners();
		// Notify listeners of errors after all registrations are complete so listeners can remove themselves in response
		for (const error of startErrors) {
			this.listener(error, undefined);
		}
	}

	public close():void {
		for (const eventListener of this.eventListeners) {
			eventListener.unregisterEventListener();
		}
	}

	private async registerTransactionListeners(): Promise<CommitError[]> {
		const startErrors = [];

		for (const eventService of this.eventServices) {
			const error = await this.startEventService(eventService);
			if (error) {
				startErrors.push(error);
			} else {
				// Only register listener for event services that start successfully
				const eventListener = this.registerTransactionListener(eventService);
				this.eventListeners.push(eventListener);
			}
		}

		return startErrors;
	}

	private async startEventService(eventService: EventService): Promise<CommitError|undefined> {
		try {
			await this.eventServiceManager.startEventService(eventService);
		} catch (error) {
			const commitError = error as CommitError;
			commitError.peer = this.getEndorserForEventService(eventService);
			return commitError;
		}
	}

	private getEndorserForEventService(eventService: EventService): Endorser {
		return this.endorsers[eventService.name];
	}

	private registerTransactionListener(eventService: EventService): EventListener {
		const peer = this.getEndorserForEventService(eventService);
		const callback: EventCallback = (error, event) => {
			const commitError = error ? Object.assign(error, {peer}) : undefined;
			const commitEvent = event ? newCommitEvent(peer, event) : undefined;
			this.notifyListener(commitError, commitEvent);
		};

		const registrationOptions = {
			unregister: false
		};

		return eventService.registerTransactionListener(this.transactionId,	callback, registrationOptions);
	}

	private notifyListener(commitError?: CommitError, commitEvent?: CommitEvent) {
		try {
			this.listener(commitError, commitEvent);
		} catch (error) {
			logger.warn('Error notifying listener:', error);
		}
	}
}
