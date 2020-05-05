/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Contract} = require('fabric-contract-api');

class FabCar extends Contract {

	async initLedger(ctx) {
		console.info('============= START : Initialize Ledger Called==========='); // eslint-disable-line
		console.info('============= END : Initialize Ledger Called==========='); // eslint-disable-line
	}

	async querySingleCar(ctx, carNumber) {
		console.info('============= START : querySingleCar ==========='); // eslint-disable-line
		const carAsBytes = await ctx.stub.getState(carNumber); // get the car from chaincode state
		if (!carAsBytes || carAsBytes.length === 0) {
			throw new Error(`${carNumber} does not exist`);
		}
		console.log(carAsBytes.toString()); // eslint-disable-line
		return carAsBytes.toString();
	}

	async createSingleCar(ctx, carNumber, make, model, color, owner) {
		console.info('============= START : Create Car ==========='); // eslint-disable-line

		const car = {
			color,
			docType: 'car',
			make,
			model,
			owner,
		};

		await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));
		console.info('============= END : Create Car ==========='); // eslint-disable-line
	}

	async queryAllCars(ctx) {
		console.info('============= START : queryAllCars ==========='); // eslint-disable-line
		const startKey = 'CAR0';
		const endKey = 'CAR999';

		const iterator = await ctx.stub.getStateByRange(startKey, endKey);

		const allResults = [];
		let collect = true;
		while (collect) {
			const res = await iterator.next();

			if (res.value && res.value.value.toString()) {

				const Key = res.value.key;
				let Record;
				try {
					Record = JSON.parse(res.value.value.toString('utf8'));
				} catch (err) {
					console.log(err); // eslint-disable-line
					Record = res.value.value.toString('utf8');
				}
				allResults.push({Key, Record});
			}
			if (res.done) {
				await iterator.close();
				collect = false;
			}
		}
		return JSON.stringify(allResults);
	}

	async changeCarOwner(ctx, carNumber, newOwner) {
		console.info('============= START : changeCarOwner ==========='); // eslint-disable-line

		const carAsBytes = await ctx.stub.getState(carNumber); // get the car from chaincode state
		if (!carAsBytes || carAsBytes.length === 0) {
			throw new Error(`${carNumber} does not exist`);
		}
		const car = JSON.parse(carAsBytes.toString());
		car.owner = newOwner;

		await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));
		console.info('============= END : changeCarOwner ==========='); // eslint-disable-line
	}

	async getTransient(ctx) {
		console.info('============= START : getTransient ==========='); // eslint-disable-line
		const transientMap = ctx.stub.getTransient();
		const result = {};
		transientMap.forEach((value, key) => {
			result[key] = value.toString('utf8');
		});
		return JSON.stringify(result);
	}

}

module.exports = FabCar;
