/**
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FabricState {
	deployed: boolean;
	type: string;
	version: string;
}

export class StateStore {

	public static getInstance(): StateStore {
		// Do you need arguments? Make it a regular static method instead.
		return this.instance || (this.instance = new this());
	}

	private static instance: StateStore;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected data: Map<string, any>;

	private constructor() {
		// Prevent external instantiation
		this.data = new Map();
	}

	/**
	 * Set a state store value
	 * @param name the name to use as a key
	 * @param data the object data to store
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
	public set(name: string, data: any): void {
		this.data.set(name, data);
	}

	/**
	 * Get the data associated with the passed key
	 * @param name the key to use
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public get(name: string): any {
		return this.data.get(name);
	}

}
