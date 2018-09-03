
This tutorial illustrates how to use the Hyperledger Fabric Node.js client (fabric client) APIs when signing a transaction offline.

In most use cases the fabric client will persist the user's credentials including the private key and sign transactions for the user. However some business scenarios may require a higher level of privacy. What if the user wants to keep their private key secret and does not trust another system or backend server to securely store it and use it.

The fabric client comes with the ability to sign a transaction offline. The fabric client does not have to have access to the user's private key. The application may request the fabric client to generate a transaction proposal and then the application may sign the transaction. The application may then send the signed transaction back to fabric client ready to be sent to the fabric network.

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
