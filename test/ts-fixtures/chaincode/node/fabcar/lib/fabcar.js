/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Contract} = require('fabric-contract-api');

class FabCar extends Contract {

	async initLedger(ctx) {
		console.info('============= START : Initialize Ledger ==========='); // eslint-disable-line
		const cars = [
			{
				color: 'blue',
				make: 'Toyota',
				model: 'Prius',
				owner: 'Tomoko',
			},
			{
				color: 'red',
				make: 'Ford',
				model: 'Mustang',
				owner: 'Brad',
			},
			{
				color: 'green',
				make: 'Hyundai',
				model: 'Tucson',
				owner: 'Jin Soo',
			},
			{
				color: 'yellow',
				make: 'Volkswagen',
				model: 'Passat',
				owner: 'Max',
			},
			{
				color: 'black',
				make: 'Tesla',
				model: 'S',
				owner: 'Adriana',
			},
			{
				color: 'purple',
				make: 'Peugeot',
				model: '205',
				owner: 'Michel',
			},
			{
				color: 'white',
				make: 'Chery',
				model: 'S22L',
				owner: 'Aarav',
			},
			{
				color: 'violet',
				make: 'Fiat',
				model: 'Punto',
				owner: 'Pari',
			},
			{
				color: 'indigo',
				make: 'Tata',
				model: 'Nano',
				owner: 'Valeria',
			},
			{
				color: 'brown',
				make: 'Holden',
				model: 'Barina',
				owner: 'Shotaro',
			},
		];

		for (let i = 0; i < cars.length; i++) {
			cars[i].docType = 'car';
			await ctx.stub.putState('CAR' + i, Buffer.from(JSON.stringify(cars[i])));
			console.info('Added <--> ', cars[i]); // eslint-disable-line
		}
		console.info('============= END : Initialize Ledger ==========='); // eslint-disable-line
	}

	async queryCar(ctx, carNumber) {
		console.info('============= START : queryCar ==========='); // eslint-disable-line
		const carAsBytes = await ctx.stub.getState(carNumber); // get the car from chaincode state
		if (!carAsBytes || carAsBytes.length === 0) {
			throw new Error(`${carNumber} does not exist`);
		}
		console.log(carAsBytes.toString()); // eslint-disable-line
		return carAsBytes.toString();
	}

	async createCar(ctx, carNumber, make, model, color, owner) {
		console.info('============= START : Create Car ==========='); // eslint-disable-line

		const car = {
			color,
			docType: 'car',
			make,
			model,
			owner,
		};

		await ctx.stub.putState(carNumber, Buffer.from(JSON.stringify(car)));
		ctx.stub.setEvent('createCar', Buffer.from(model));
		console.info('============= ADD CHAINCODE EVENT : ->createCar<- with ' + model + ' ==========='); // eslint-disable-line

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
		ctx.stub.setEvent('changeCarOwner', Buffer.from(carNumber));

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
