This tutorial illustrates how to work with an offline private key with the Hyperledger Fabric Node.js SDK (fabric-client and fabric-ca-client) APIs.

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* The transactional mechanics that take place during a standard asset exchange.
[transacton flow in fabric](https://hyperledger-fabric.readthedocs.io/en/latest/txflow.html).
* The Certificate Signing Request (CSR) in a PKI system.
[CSR](https://en.wikipedia.org/wiki/Certificate_signing_request)

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development, including the use of the
Javascript `promise` and `async await`.

## Overview

In most use cases the `fabric-client` will persist the user's credentials including the private key and sign transactions for the user. However some business scenarios may require higher level of privacy. What if the user wants to keep their private key secret and does not trust another system or backend server to securely store it and use it?

The `fabric-client` comes with the ability to sign a transaction with an offline private key. By contrast to call `setUserContext()` with the user's identity (which contains the user's private key), an alternative way is to split the `sign a tx` process out of the `fabric-client` and let the application layer choose the place to store the private key, sign the transaction and send the signed transaction back. By this approach, the `fabric-client` does not require the user's private key any more.

The Fabric-ca comes with the ability to enroll with a PKCS#10 standard CSR, which means the user can use an existing key pairs to generate the CSR and send this CSR to Fabric-ca to get the signed certificate. The `fabric-ca-client` also accepts a CSR at the API `enroll()`.

## The transaction flow for signing a transaction offline

The following will show the steps to signing a transaction offline:

With the user's identity (cert and private key) set at the fabric client:

1. Endorse -> `Channel.sendTransactionProposal()`
2. Commit -> `Channel.sendTransaction()`
3. ChannelEventHub -> `ChannelEventHub.connect()` (if the channel-eventhub has not connected to the peers)

Without the user's private key at the fabric client:

1. Endorse:
    1. generate an `unsigned transaction proposal` with the identity's certificate -> `Channel.generateUnsignedProposal()`
    2. sign the `unsigned transaction proposal` with the identity's private key offline producing a `signed transaction proposal`
    3. send the `signed transaction proposal` to the peer(s) and get endorsement(s) -> `Channel.sendSignedProposal()`
2. Commit:
    1. generate an `unsigned transaction` with the endorsements -> `Channel.generateUnsignedTransaction()`
    2. sign the `unsigned transaction` with the identity's private key offline producing a `signed transaction`
    3. send the `signed transaction` to the orderer -> `Channel.sendSignedTransaction()`
3. Register Channel Event Listerner:
    If the channel event hub has not connected to the peer, the channel eventhub registration needs the private key's signature too.
    1. generate an `unsigned eventhub registration` for the ChannelEventHub -> `ChannelEventHub.generateUnsignedRegistration()`
    2. sign the `unsigned eventhub registration` with the identity's private key offline producing a `signed eventhub registration`
    3. using the `signed eventhub registration` for the ChannelEventHub's registration -> `ChannelEventHub.connect({signedEvent})`

## How to sign a transaction by an identity's private key

There might be several digital signature algorithms. If we set the user's identity at the fabric client, the fabric client would use ECDSA with algorithm 'EC' by default.

Here is how this works with an offline private key.

1. first, generate an `unsigned transaction proposal` with the identity's certificate
    ```javascript
    const certPem = '<PEM encoded certificate content>';
    const mspId = 'Org1MSP'; // the msp Id for this org

    const transactionProposal = {
        fcn: 'move',
        args: ['a', 'b', '100'],
        chaincodeId: 'mychaincodeId',
        channelId: 'mychannel',
    };
    const { proposal, txId } = channel.generateUnsignedProposal(transactionProposal, mspId, certPem);
    // now we have the 'unsigned proposal' for this transaction
    ```

2. calculate the hash of the transaction proposal bytes.

    A hash algorithm should be picked and calculate the hash of the transaction proposal bytes.

    There exists multiple hash functions (such as SHA2/3). by default, the fabric client will use 'SHA2' with key size 256.

    The user may use an alternative implementation

    ```javascript
    const proposalBytes = proposal.toBuffer(); // the proposal comes from step 1

    const hashFunction = xxxx; // A hash function by the user's desire

    const digest = hashFunction(proposalBytes); // calculate the hash of the proposal bytes
    ```

3. calculate the signature for this transaction proposal

    We may have a series of choices for the signature algorithm. Including asymmetric keys (such as ECDSA or RSA), symmetric keys (such as AES).

    By default the the fabric client will use ECDSA with algorithm 'EC'.

    ```javascript
    // This is a sample code for signing the digest from step 2 with EC.
    // Different signature algorithm may have different interfaces

    const elliptic = require('elliptic');
    const { KEYUTIL } = require('jsrsasign');

    const privateKeyPEM = '<The PEM encoded private key>';
    const { prvKeyHex } = KEYUTIL.getKey(privateKeyPEM); // convert the pem encoded key to hex encoded private key

    const EC = elliptic.ec;
    const ecdsaCurve = elliptic.curves['p256'];

    const ecdsa = new EC(ecdsaCurve);
    const signKey = ecdsa.keyFromPrivate(prvKeyHex, 'hex');
    const sig = ecdsa.sign(Buffer.from(digest, 'hex'), signKey);

    // now we have the signature, next we should send the signed transaction proposal to the peer
    const signature = Buffer.from(sig.toDER());
    const signedProposal = {
        signature,
        proposal_bytes: proposalBytes,
    };
    ```

4. send the `signed transaction proposal` to peer(s)
    ```javascript

    const sendSignedProposalReq = { signedProposal, targets };
    const proposalResponses = await channel.sendSignedProposal(sendSignedProposalReq);
    // check the proposal responses, if all good, commit the transaction
    ```

5. similar to step 1, generate an `unsigned transaction`

    ```javascript
    const commitReq = {
        proposalResponses,
        proposal,
    };

    const commitProposal = await channel.generateUnsignedTransaction(commitReq);
    ```

6. similar to step 3, sign the `unsigned transaction` with the user's private key
    ```javascript
    const signedCommitProposal = signProposal(commitProposal);
    ```

7. commit the `signed transaction`
    ```javascript
    const response = await channel.sendSignedTransaction({
        signedProposal: signedCommitProposal,
        request: commitReq,
    });

    // response.status should be 'SUCCESS' if the commit succeed
    ```
8. similar to step 1, generate an `unsigned eventhub registration` for the ChannelEventHub.

    ```javascript
    const unsignedEvent = eh.generateUnsignedRegistration({
        certificate: certPem,
        mspId,
    });
    ```

9. similar to step 3, sign the `unsigned eventhub registration` with the user's private key

    ```javascript
    const signedProposal = signProposal(unsignedEvent);
    const signedEvent = {
        signature: signedProposal.signature,
        payload: signedProposal.proposal_bytes,
    };
    ```

10. register this ChannelEventHub at peer

    ```javascript
    channelEventHub.connect({signedEvent});
    ```

A full test can be found at `fabric-sdk-node/test/integration/signTransactionOffline.js`

## How to enroll with a CSR

The `fabric-ca-client` provides the API `enroll()` that accepts an optional param 'CSR'.
If the params does not contains CSR, `fabric-ca-client` will first generate a key pair,
then use the user's enrollmentID as the common name to create a CSR which is signed with
the new generated private key. The response will contain the private key object if no 'CSR'
in enroll params.

To enroll with a CSR, first we should call `fabric-ca-client` API `register` to register
a new identity at Fabric-ca. After a successfully register, we have the `enrollmentID` and `enrollmentSecret`.

Then we should create the CSR. A common way is using the `openssl` command.
> Notice the CSR must contain the information "common name" and the "common name" must be
> same as the "enrollmentID" at the register step.

Here is an example of how to create a CSR with the key algorithm rsa and key size 2048 bits

```
openssl req -nodes -newkey rsa:2048 -keyout test.key -out test.csr
```

The `test.csr` from the above command is represented as a Base64 encoded PKCS#10.

Here is how we call enroll with a CSR

```javascript
const fs = require('fs');
const csr = fs.readFileSync('the path to test.csr', 'utf8');
const req = {
    enrollmentID: enrollmentID,
    enrollmentSecret: enrollmentSecret,
    csr: csr,
};

const enrollment = await caService.enroll(req);

// the enrollment.certificate contains the signed certificate from Fabric-ca
```