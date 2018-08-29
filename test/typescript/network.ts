/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
import {
  FileSystemWallet,
  InMemoryWallet,
  Contract,
  FabricNetwork,
  Identity,
  IdentityInformation,
  InitOptions,
  Network,
  Wallet,
  X509Identity,
  X509WalletMixin

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

    const network: Network = new Network();

    const opt1: InitOptions = {
        wallet: inMemoryWallet,
        identity: 'User1@org1.example.com',
        clientTlsIdentity: 'tlsId',
        commitTimeout: 1000
    };

    await network.initialize('accp', opt1);

    const network2: Network = new Network();
    const client: Client = new Client();
    const opt2: InitOptions = {
        wallet: fileSystemWallet,
        identity: 'anod'
    };

    await network.initialize(client, opt2);


    const channel: FabricNetwork.Channel = await network.getChannel('a channel');
    const contract: Contract = await channel.getContract('chaincode');

    let response: Buffer = await contract.submitTransaction('move', 'a', 'b','100');
    response = await contract.executeTransaction('move', 'a', 'b','100');

    const aClient: Client = network.getClient();
    const user: User = network.getCurrentIdentity();
    const opt3: InitOptions = network.getOptions();

    const internalChannel: Channel = channel.getInternalChannel();
    const peerMap: Map<string, ChannelPeer[]> = channel.getPeerMap();

	const deleteDone: Promise<void> = inMemoryWallet.delete('User1@org1.example.com')
	await deleteDone;
	await fileSystemWallet.delete('User1@org1.example.com');
    network.dispose();
    network2.dispose();

})();


