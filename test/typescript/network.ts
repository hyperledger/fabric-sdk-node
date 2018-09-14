/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
import {
  FileSystemWallet,
  InMemoryWallet,
  Contract,
  Network,
  Identity,
  IdentityInformation,
  InitOptions,
  Gateway,
  Wallet,
  X509Identity,
  X509WalletMixin,
  DefaultEventHandlerOptions,
  DefaultEventHandlerStrategies

} from 'fabric-network';

import Client = require('fabric-client');

import {
    User,
    Channel,
    ChannelPeer
} from 'fabric-client';

(async () => {

    const cert: string = 'acertificate';
    const key: string = 'akey';
    const inMemoryWallet: Wallet = new InMemoryWallet();
    const fileSystemWallet: FileSystemWallet = new FileSystemWallet('path');

    const id1: Identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);
    const id2: X509Identity = X509WalletMixin.createIdentity('Org1MSP', cert, key);
	let importDone: Promise<void> = inMemoryWallet.import('User1@org1.example.com', id1);
	await importDone;
    await fileSystemWallet.import('User1@org1.example.com', id2);
    const exists: boolean = await inMemoryWallet.exists('User1@org1.example.com');

    const id3: Identity = await fileSystemWallet.export('anod');
    //const id4: X509Identity = await inMemoryWallet.export('anod'); can't do this
	const id4: X509Identity = <X509Identity>id3;

	const idList: IdentityInformation[] = await inMemoryWallet.list();

	const gateway: Gateway = new Gateway();

	const evtOpts: DefaultEventHandlerOptions = {

	};

	const evtOpts1: DefaultEventHandlerOptions = {
		commitTimeout: 100,
		strategy: DefaultEventHandlerStrategies.MSPID_SCOPE_ALLFORTX
	};

    const initOpt: InitOptions = {
        wallet: inMemoryWallet,
        identity: 'User1@org1.example.com',
        clientTlsIdentity: 'tlsId'
	};

    const initOpt1: InitOptions = {
        wallet: inMemoryWallet,
        identity: 'User1@org1.example.com',
		clientTlsIdentity: 'tlsId',
		eventHandlerOptions: evtOpts1
    };


    await gateway.connect('accp', initOpt1);

    const gateway2: Gateway = new Gateway();
    const client: Client = new Client();
    const opt2: InitOptions = {
        wallet: fileSystemWallet,
        identity: 'anod'
    };

    await gateway2.connect(client, opt2);


    const network: Network = await gateway.getNetwork('a channel');
    const contract: Contract = await network.getContract('chaincode');

    let response: Buffer = await contract.submitTransaction('move', 'a', 'b','100');
    response = await contract.executeTransaction('move', 'a', 'b','100');

    const aClient: Client = gateway.getClient();
    const user: User = gateway.getCurrentIdentity();
    const opt3: InitOptions = gateway.getOptions();

    const internalChannel: Channel = network.getChannel();
    const peerMap: Map<string, ChannelPeer[]> = network.getPeerMap();

	const deleteDone: Promise<void> = inMemoryWallet.delete('User1@org1.example.com')
	await deleteDone;
	await fileSystemWallet.delete('User1@org1.example.com');
    gateway.disconnect();
    gateway2.disconnect();

})();


