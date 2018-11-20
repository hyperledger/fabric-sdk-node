/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0
*/

import {
	Contract,
	DefaultEventHandlerOptions,
	DefaultEventHandlerStrategies,
	FileSystemWallet,
	Gateway,
	GatewayOptions,
	Identity,
	IdentityInfo,
	InMemoryWallet,
	Network,
	Transaction,
	TransientMap,
	Wallet,
	X509WalletMixin,
} from 'fabric-network';

import Client = require('fabric-client');

import {
	Channel,
	TransactionId,
	User,
} from 'fabric-client';

(async () => {

	const cert: string = 'acertificate';
	const key: string = 'akey';
	const inMemoryWallet: Wallet = new InMemoryWallet();
	const fileSystemWallet: FileSystemWallet = new FileSystemWallet('path');

	const id1: Identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);
	// const id2: X509Identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);
	const importDone: Promise<void> = inMemoryWallet.import('User1@org1.example.com', id1);
	await importDone;
	await fileSystemWallet.import('User1@org1.example.com', id1);
	const exists: boolean = await inMemoryWallet.exists('User1@org1.example.com');

	const id3: Identity = await fileSystemWallet.export('anod');
	// const id4: X509Identity = await inMemoryWallet.export('anod'); can't do this
	// const id4: X509Identity = id3 as X509Identity;

	const idList: IdentityInfo[] = await inMemoryWallet.list();

	const gateway: Gateway = new Gateway();

	const evtOpts: DefaultEventHandlerOptions = {};

	const evtOpts1: DefaultEventHandlerOptions = {
		commitTimeout: 100,
		strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX,
	};

	const initOpt: GatewayOptions = {
		clientTlsIdentity: 'tlsId',
		identity: 'User1@org1.example.com',
		wallet: inMemoryWallet,
	};

	const initOpt1: GatewayOptions = {
		clientTlsIdentity: 'tlsId',
		eventHandlerOptions: evtOpts1,
		identity: 'User1@org1.example.com',
		wallet: inMemoryWallet,
	};

	await gateway.connect('accp', initOpt1);

	const gateway2: Gateway = new Gateway();
	const client: Client = new Client();
	const opt2: GatewayOptions = {
		identity: 'anod',
		wallet: fileSystemWallet,
	};

	await gateway2.connect(client, opt2);

	const network: Network = await gateway.getNetwork('a channel');
	const contract: Contract = await network.getContract('chaincode');

	let response: Buffer = await contract.submitTransaction('move', 'a', 'b', '100');
	response = await contract.evaluateTransaction('move', 'a', 'b', '100');

	const transientData: TransientMap = {
		key1: Buffer.from('value1'),
		key2: Buffer.from('value2'),
	};
	response = await contract.createTransaction('move').setTransient(transientData).submit('a', 'b', '100');
	response = await contract.createTransaction('move').setTransient(transientData).evaluate('a', 'b', '100');

	const transaction: Transaction = contract.createTransaction('move');
	const txId: TransactionId = transaction.getTransactionID();
	txId.getTransactionID();

	const aClient: Client = gateway.getClient();
	const user: User = gateway.getCurrentIdentity();
	const opt3: GatewayOptions = gateway.getOptions();

	const internalChannel: Channel = network.getChannel();

	const deleteDone: Promise<void> = inMemoryWallet.delete('User1@org1.example.com');
	await deleteDone;
	await fileSystemWallet.delete('User1@org1.example.com');
	gateway.disconnect();
	gateway2.disconnect();

})();
