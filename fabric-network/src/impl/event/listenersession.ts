/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ListenerSession {
	start(): Promise<void>;
	close(): void;
}


export async function addListener<T>
(listener: T, listenerSessions: Map<T, ListenerSession>, sessionSupplier: () => Promise<ListenerSession>): Promise<T> {
	if (!listenerSessions.has(listener)) {
		const session = await sessionSupplier();
		// Store listener before starting in case start fires error events that trigger remove of the listener
		listenerSessions.set(listener, session);
		await session.start();
	}
	return listener;

}

export function removeListener<T>(listener: T, listenerSessions: Map<T, ListenerSession>) :void {
	const session = listenerSessions.get(listener);
	if (session) {
		session.close();
		listenerSessions.delete(listener);
	}
}
