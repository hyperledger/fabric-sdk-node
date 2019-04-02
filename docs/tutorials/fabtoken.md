
This tutorial illustrates how to perform FabToken operations using
the Node.js fabric-client SDK. FabToken is a new feature in
Hyperledger Fabric 2.0 Alpha and fabric-client 2.0 Alpha.

Refer to the following document to understand the concepts and functions in FabToken.
* FabToken document (link not available yet)

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* the configuration of a channel in Hyperledger Fabric and the internal
process of creating and updating see
[Hyperledger Fabric channel configuration](http://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)

The following assumes an understanding of the Hyperledger Fabric network
(orderers, peers, and channels), and of Node.js application development,
including the use of the Javascript `promise` and `async await`.

### Overview

This tutorial will focus on the APIs for an application program to perform
the token operations. These operations will be transactions on the hyperledger fabric
channel ledger and the application may monitor for their completion using the channel
event service see [How to use the channel-based event service]{@tutorial channel-events}

#### New Class

A new class {@link TokenClient} has been added to the fabric-client to support token operations.
A {@link TokenClient} instance will be created by a client instance's
{@link Client#newTokenClient newTokenClient()} method.
Then using the new instance, you will be able to invoke the following methods.

* {@link TokenClient#issue issue} - Issue new tokens to the specified users.
* {@link TokenClient#transfer transfer} - Transfer owning tokens to other users.
* {@link TokenClient#redeem redeem} - Redeem owning tokens.
* {@link TokenClient#list list} - Query owning tokens.

#### New Method on Client

The {@link Client} class has been enhanced to include a new method to create
a {@link TokenClient} instance. Like Client, a TokenClient is associated with a user context.

* {@link Client#newTokenClient newTokenClient()} - Create a new {@link TokenClient} instance.

### Sample code

The following sample code assumes that all of the normal fabric-client setup
has been completed and only shows the TokenClient calls.
It demonstrates how to issue, transfer, redeem, and list tokens.

#### Prerequisites:

Assume the following objects have been created:

* issuer, client (associated to issuer context)
* user1, client1 (associated to user1 context)
* user2, client2 (associated to user1 context)
* mychannel

#### Use case 1: issue tokens
The issuer issues tokens to user1 and user 2

```
// create a TokenClient instance from client
const tokenclient = client.newTokenClient(mychannel);

// create a transaction ID for "issuer"
const txId = client.newTransactionID();

// create two parameters for issue, one for user1 and one for user2
const param1 = {
	owner: {raw: user1.getIdentity().serialize(), type: 0},
	type: 'USD',
	quantity: '500',
};
const param2 = {
	owner: {raw: user2.getIdentity().serialize(), type: 0},
	type: 'EURO',
	quantity: '300',
};

// create the token request for issue
const issueRequest = {
	params: [param1, param2],
	txId: txId,
};

// issuer calls issue method to issue tokens to user1 and user2
const result = await tokenClient.issue(issueRequest);

// The above method broadcasts the transaction to the orderer.
// You can monitor its completion with the channel event service
```

#### Use case 2: list tokens
You can only list unspent tokens owned by yourself.
```
// create a TokenClient instance from client1
const user1Tokenclient = client1.newTokenClient(mychannel);

// user1 lists tokens
const mytokens = await user1TokenClient.list();

// iterate the tokens to get token id, type, and quantity for each token
for (const token of tokens) {
	// get token.id, token.type, and token.quantity
	// token.id will be used for transfer and redeem
}
```

#### Use case 3: transfer tokens
You can only transfer tokens owned by yourself. Call the "list" method to get the token id(s) you want to transfer.
Assume user1 wants to transfer 'tokenid1' to user2. The token quantity is 500 and
user1 wants to transfer 300 to user2.  The remaining 200 will be transferred to user1
because the total quantity for transfer must be same as the total quanity in the original tokens.

```
// create a request (see TokenRequest doc) for transfer.
// After transfer, user2 will have 300 quantity of the token and user1 will have 200 quantity of the token.

// create the transaction ID for "user1" who will transfer tokens
const txId = client1.newTransactionID();

// create two parameters, where param1 is to transfer 300 to user2 and param2 is to transfer the remaining 200 to user1.
const param1 = {
	owner: {raw: user2.getIdentity().serialize(), type:0},
	quantity: '300',
};
const param2 = {
	owner: {raw: user1.getIdentity().serialize(), type:0},
	quantity: '200',
};

// create the request for transfer
const transferRequest = {
	tokenIds: [tokenid1],
	params: [param1, param2],
	txId: txId,
};

// user1 calls transfer method to transfer the token to user2
// after transfer, the old "tokenid1" will be destroyed and new token ids will be created
const mytokens = await user1TokenClient.transfer(transferRequest);

// The above method broadcasts the transaction to the orderer.
// You can monitor its completion with the channel event service
```

#### Use case 4: redeem tokens
You can only redeem tokens owned by yourself. Call the "list" method to get the token id(s) you want to redeem.
Assume user2 wants to redeem 100 out of 300 from the "tokenid2" token.
```
// create a TokenClient instance from client2
const user2Tokenclient = client2.newTokenClient(mychannel);

// create a request (see TokenRequest doc) for redeem
const txId = client2.newTransactionID();
const param = {
	quantity: '100',
};
const redeemRequest = {
	tokenIds: [tokenid2],
	params: [param],
	txId: txId,
};

// user2 calls redeem method.
const result = await user2TokenClient.redeem(redeemRequest);

// The above method broadcasts the transaction to the orderer.
// You can monitor its completion with the channel event service

// After redeem, user2 will have 200 left, with a new token id.
// The old "tokenid2" will be destroyed since it has been spent.
// You can call list to verify the result.
const tokens = await user2TokenClient.list();
```

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/">
<img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a>
<br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">
Creative Commons Attribution 4.0 International License</a>.
