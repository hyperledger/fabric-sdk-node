This tutorial describes how to use your application to install a chaincode on
your peers and define it on a channel. This tutorial uses the Fabric chaincode
lifecycle introduced in the Fabric V2.0 Alpha and the fabric-client 2.0 Alpha.
The APIs for using the previous chaincode lifecycle will still be available in
the fabric-client, but will not be discussed in this tutorial.

For more information on the new Fabric Chaincode lifecycle, visit the
[Chaincode for Operators tutorial](https://hyperledger-fabric.readthedocs.io/en/latest/chaincode4noah.html) in the Hyperledger Fabric documentation.

For more information on:
* getting started with Hyperledger Fabric see
[Building your first network](http://hyperledger-fabric.readthedocs.io/en/latest/build_network.html).
* the configuration of a channel in Hyperledger Fabric and the internal
process of creating and updating a channel, see
[Hyperledger Fabric channel configuration](http://hyperledger-fabric.readthedocs.io/en/latest/configtx.html)

The following tutorial assumes an understanding of the components of a
Hyperledger Fabric network (orderers and peers) and of Node application
development, including the use of the Javascript `promise` and `async await`.

### Overview

The Fabric 2.0 Alpha introduces decentralized governance for chaincode. The new
Fabric chaincode lifecycle allows multiple organizations to come to agreement
on the parameters of a chaincode, such as the chaincode endorsement policy,
before it can be used to interact with the ledger. You will need to enable the
new Fabric chaincode lifecycle on your channel definition by setting the
Applications capabilities to `V2_0: true` to use the steps in this tutorial.

Channel members need to complete the following steps before they can start
using a chaincode:
* `Setup`- create the necessary application objects
* `Package` - create a chaincode package from your source code
* `Install` - install the chaincode package on your peers
* `Approve a definition for organization` - each organization needs to
  approve a chaincode definition in order to use the chaincode
* `Commit the definition to a channel` - After a sufficient number of
  organizations have approved a chaincode definition, the definition can be
  committed to a channel by one organization
* `Initialize` - (Optional) initialize the chaincode and start the chaincode
  container

#### New Class
A new class {@link Chaincode} has been added to the fabric-client to encapsulate
a chaincode definition.
A {@link Chaincode} instance will be created by a client instance's
{@link Client#newChaincode newChaincode(name,version)} method.
Then using the new instance, you will be able to build up a chaincode definition
with the following methods.
* {@link Chaincode#setEndorsementPolicyDefinition setEndorsementPolicyDefinition} - Provide the endorsement policy for this chaincode.
* {@link Chaincode#setCollectionConfigPackageDefinition setCollectionConfigPackageDefinition} - Provide the collection configuration for this chaincode.
* {@link Chaincode#setSequence setSequence} - Provide the modification number for this chaincode definition.
* {@link Chaincode#setPackage setPackage} - Provide the package when not packaging this chaincode locally.
* {@link Chaincode#setPackage setPackageId} - Provide the package ID when not installing this chaincode package locally.

The chaincode instance will allow you to package a chaincode and install it on
your peers with the following methods:
* {@link Chaincode#package package} Package the files at the locations provided.
* {@link Chaincode#install install} Install the package on the specified peers.

Once the chaincode definition has all the necessary attributes, it may be used
by a channel instance to be approved both for an organization and
then committed for use on the channel.

#### New methods on Channel
The {@link Channel} class has been updated to include methods to approve a
chaincode definition for your organization and commit the definition to a
channel.

* {@link Channel#approveChaincodeForOrg approveChaincodeForOrg} - will approve
the chaincode for an organization on this channel
* {@link Channel#commitChaincode commitChaincode} - will commit
the chaincode for use on this channel.
* {@link Channel#queryChaincodeDefinition queryChaincodeDefinition} - will return
a {Chaincode} instance as defined on this peer on this channel
* {@link Channel#queryApprovalStatus queryApprovalStatus} - will indicate the
approval status for a chaincode name on this channel
* {@link Channel#queryInstalledChaincode queryInstalledChaincode} will indicate
by returning the label if the package ID is installed on this peer
* {@link Channel#queryInstalledChaincodes queryInstalledChaincodes} will indicate
all the package IDs and labels of installed chaincode on this peer
* {@link Channel#queryNamespaceDefinitions queryNamespaceDefinitions} will indicate
the chaincode names committed (running) on this channel

#### New method on Client
The {@link Client} class has been enhanced to include a new method to create
a {@link Chaincode} instance. This is the object used for creating a chaincode
definition and managing a chaincode.

* {@link Client#newChaincode newChaincode} - Create a {@link Chaincode} instance.


### Step 1: Setup

In this step we will build the application objects needed to perform the
operational steps that follow. You will first need to create a fabric-client
operational environment. The client instance will need to have a user store,
crypto suite, and a user assigned. The target peers, orderer, and channel
instance objects will also be required prior to working with chaincode. The
following sample code assumes that all of the normal fabric-client setup has
been completed and only shows the new chaincode lifecycle related calls.

The chaincode object needs specifies the parameters that will define how your
chaincode will operate on the channel. These parameters include the name, version,
endorsement policy, and the collection configuration. This chaincode object also
specifies that the `Init` function will need to be executed before the chaincode
can be started on the channel.

```
// get the chaincode instance associated with the client
const mychaincode = client.newChaincode('mychaincode', 'v1');

// The endorsement policy
const policy_def = {
   identities: [
      {role: {name: 'member', mspId: 'org1'}},
      {role: {name: 'member', mspId: 'org2'}}
   ],
   policy: {
       '1-of': [{'signed-by': 0}, {'signed-by': 1}]
   }
};
mychaincode.setEndorsementPolicyDefinition(policy_def);

// The collection configuration - optional.
const config_def = [{
   name: 'detailCol',
   policy: {
      identities: [
         {role: {name: 'member', mspId: 'Org1MSP'}},
         {role: {name: 'member', mspId: 'Org2MSP'}}
      ],
      policy: {
         '1-of': [{'signed-by': 0}, {'signed-by': 1}]
      }
   },
   requiredPeerCount: 1,
   maxPeerCount: 1,
   blockToLive: 100
}];
mychaincode.setCollectionConfigPackageDefinition(config_def));

mychaincode.setInitRequired(true);

// set the sequence (modification) number - default is 1
mychaincode.setSequence(1); // must increment for each definition change
```

### Step 2: Package

The chaincode needs to be packaged before it can be installed on your peers. You
can use the package method to create a chaincode package in the required format.

The method creates a tar file from your chaincode source code, artifacts, and
metadata files. This step can be done by one organization if you want to ensure
that every channel member is using the same chaincode package. Optional you may
create a package label and assign it to this package to help identify the
chaincode package after it is installed on your peers.

The following example packages a golang chaincode. This package can then be
optionally be sent to other channel members out of band.

```
// package the source code
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const cc_package = await mychaincode.package(package_request);
```

If you are given the channel package out of band by another organization, use
the following method to import the chaincode package before it can be installed.

```
// use an existing package
mychaincode.setPackage(cc_package);
```

### Step 3: Install

Once the chaincode is packaged, it can be installed on your peers. This step will
be required by all organizations that want to use the chaincode to query the
ledger and endorse transactions. The install method will send the packaged
chaincode to the target peers in your organization. This request will need to be
sent by a peer administrator. The installation will return a package ID, a
unique identifer for the chaincode package. You will need the package ID when
you approve a chaincode definition for your organization.

The following sample assumes that the chaincode object being used has been setup
and packaged or an error would be thrown. Note how the package ID is returned
from the `install`, and is also available from the `mychaincode` object using
the `getPackageId()` method.

```
// install chaincode package on peers
 const install_request = {
   targets: [peer1, peer2],
   request_timeout: 20000 // give the peers some extra time
 }
const package_id = await mychaincode.install(install_request);

// package ID value is stored in the chaincode instance
const package_id = mychaincode.getPackageId();
```

### Step 4: Approve for your organization

Each organization that wants to use the chaincode needs to approve a chaincode
definition for their organization. The transaction to approve a chaincode
definition may be submitted at any time, but must be submitted before the
commit transaction is submitted, or an organization can use the chaincode. Each
organization needs to submit separate approval transactions.

Approving a chaincode definition may be thought of as a vote for a set of
chaincode parameters by your organization. These approved definitions allow
channel members to agree on a chaincode before it can be used on a channel. As a
result, the approved definitions needs to be consistent across organizations. If
the chaincode is already running and a definition has already been committed to
the channel, an organization can use the chaincode by installing the chaincode
package on their peers and approving the committed chaincode definition.

The chaincode definition needs to contain the package identifier to associate
the definition approved by your organization with the chaincode installed on
your peers. If your organization does not plan on using the chaincode, you can
approve a chaincode definition without a package ID. This may be helpful if you
want to ensure that a definition has a sufficient number of approvals to be
committed to the channel.

We used the chaincode object created in step one, `mychaincode`, to create a
chaincode definition that our organization is ready to approve. The definition
includes all the parameters that were specified in the step one sample code,
such as the name, version, and the endorsement policy. The object also contains
the package ID returned by the install method in step three.

```
// send a approve chaincode for organization transaction
const tx_id = client.newTransactionID();
const request = {
   target: peer1,
   chaincode: mychaincode, // The chaincode instance fully populated
   txId: tx_id
}
// send to the peer to be endorsed
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Step 5: Commit definition to the channel

Once a sufficient number of channel members have approved a chaincode definition,
one organization can commit the definition to the channel. In order for the
chaincode definition to be committed successfully, a sufficient number of
organizations need to approve the definition to meet the
`Channel/Application/LifecycleEndorsement` policy. By default, this policy is set
to a majority of the organizations on the channel.

You can find a sample commit transaction below. The commit transaction needs to
target a sufficient number of peers in other organizations to collect their
endorsements for the definition. Think of this as a tally of the votes for the
chaincode. If the commit transaction can collect a sufficient number of votes
to meet the LifecycleEndorsement policy, the definition can be committed to the
channel and the chaincode used by channel members.

```
// send a commit chaincode for channel transaction
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Step 6: Initialize

The chaincode is ready to be used after it is defined on a channel. If you did
not request the execution of your chaincode's `Init` function, then the chaincode
container will start after the first invoke. If you used `setInitRequired(true)`
then you need to invoke with `is_init` set to `true`
before any other transactions can be executed.

The following code snippet below requests the initialization of your chaincode.
Note that `is_init` needs to be set to `true` as part of the request, and the
`Init` method will be called rather than the
`Invoke` method of your chaincode.

```
// initialize the chaincode
const tx_id = client.newTransactionID();
const request = {
   chaincodeId : chaincodeId,
   fcn: 'Init',
   args: args,
   txId: tx_id,
   is_init: true // must be set to initialization
}
// starting the container will take longer than the normal request-timeout
const init_results = await mychannel.sendTransaction(request, 20000);
const orderer_request = {
   proposalResponses: init_results[0],
   proposal: init_results[1]
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

### Sample situations

In addition to being necessary to use a new chaincode, the chaincode definition
provides you additional flexibility in updating a chaincode and managing
chaincode policies. The following samples will provide code snippets for the
following scenarios:
- `Intalling a new chaincode`
- `Upgrading a chaincode`
- `Modifying an endorsement policy`
- `Join a channel with a running chaincode`

#### New chaincode

When installing chaincode for the first time, All 5 or 6 steps must be run.

The following sample shows one organization packaging and installing the
chaincode, followed by the organization approving and committing the chaincode
definition for the entire channel. The organization also executes the `Init`
function in this example.

```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version1');
const policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(1); //set to one for a new chaincode
mychaincode.setInitRequired(true);

// step 2: package
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const cc_package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

// step 6: init
const tx_id = client.newTransactionID();
const request = {
   chaincodeId : chaincodeId,
   fcn: 'Init',
   args: args,
   txId: tx_id,
   is_init: true
}
const init_results = await mychannel.sendTransaction(request, 20000);
const orderer_request = {
   proposalResponses: init_results[0],
   proposal: init_results[1]
}
const results = await mychannel.sendTransaction(orderer_request);
```

#### Upgrade the chaincode code

When upgrading the chaincode binaires, all 5 or 6 steps must be run. The flow
and commands are the same for upgrading a chaincode, but the sequence number
needs to be incremented by one. You will also need to change the chaincode
version.

The following sample shows the code needed when the organization
will be packaging the chaincode, installing it, and being the organization
to approve and commit it for the entire channel.
```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(2);

// step 2: package
// package the source code
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const cc_package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1],
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);

```

#### Modify the Endorsement policy

When updating the endorsement policy, you only need to perform 4 steps.
Organizations can use the chaincode definition to update the endorsement policy
without having to repackage the chaincode or initializing the chaincode. You
need to increment the sequence number by one to change the chaincode definition.
In this case let us assume that the chaincode has been updated once, so the
sequence number will be 3. It might seem that we can also skip the install step,
but we still need the package ID value to uniquely identify the chaincode source
that was installed earlier and has not been changed.

The following sample shows the code needed when the organization updates an
endorsement policy and is then approves and commits the new definition to the
channel.
```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const new_policy_def = { ... };
mychaincode.setEndorsementPolicyDefinition(new_policy_def);
mychaincode.setSequence(3);

// step 3: install
mychaincode.setPackageId(package_id);

// step 4: approve
const tx_id = client.newTransactionID();
const request = {
   target: peer1,
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

//step 5: commit
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1, peer3],
   chaincode: mychaincode,
   txId: tx_id
}
// send to the peers to be endorsed
const {proposalResponses, proposal} = await mychannel.commitChaincode(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
// send to the orderer to be committed
const results = await mychannel.sendTransaction(orderer_request);
```

#### Joining a channel with a running chaincode

When a new organization wishes to run an existing chaincode it will have to
perform all but the commit step. This sample assumes that the endorsement
policy allows the new organization to endorse transactions. Otherwise, this
organization will only be able to audit the ledger.

```
// step 1: setup
const mychaincode = client.newChaincode('mychaincode', 'version2');
const policy_def = { ... }; // must be the same as what the other organizations have used
mychaincode.setEndorsementPolicyDefinition(policy_def);
mychaincode.setSequence(3); // use existing value, if there is change, then up this number

// step 2: package
// package the source code
const package_request = {
   chaincodeType: 'golang',
   goPath: '/gopath',
   chaincodePath: '/path/to/code',
   metadataPath: '/path/to/metadata'
}
const cc_package = await mychaincode.package(package_request);

// step 3: install
 const install_request = {
   target: peer1,
   request_timeout: 10000 // give the peer some extra time
 }
const package_id = await mychaincode.install(install_request);

// step 4: approve
// only the new organization has to run, unless there is change
// to the definition
const tx_id = client.newTransactionID();
const request = {
   targets: [peer1], // this peer is in my org
   chaincode: mychaincode,
   txId: tx_id
}
const {proposalResponses, proposal} = await mychannel.approveChaincodeForOrg(request);
const orderer_request = {
   proposalResponses: proposalResponses,
   proposal, proposal
}
const results = await mychannel.sendTransaction(orderer_request);

// step 5: commit
// This step is not required, however if there was a change to the
// chaincode definition and the sequence number had to change,
// then it must be run
```

### Querying chaincode and chaincode definitions.

The Fabric chaincode allows for decentralized governance and may require
coordination between multiple organizations. You can use query methods to help
manage chaincode lifecycle.

#### Querying the chaincode defintion on a channel

You can use the `QueryChaincodeDefinition` method to find which definition has
been approved for a given chaincode. You can only send this request to one peer.
This query could be useful in finding the current sequence of a definition
before submitting an upgrade request.

```
const tx_id = client.newTransactionID();
const request = {
   target: peer,
   chaincodeId: chaincodeId,
   txId: tx_id
}
// send to the peers to be endorsed
const approved_defintion = await mychannel.QueryChaincodeDefinition(request);
```

#### Querying the approved chaincode defintions

You can use the `QueryApprovalStatus` method to find which organizations have
approved a given chaincode definition. You need to build a chaincode object and
pass it to the query. The response will be a JSON mapping of which organizations
on the channel have approved the chaincode definition specified by the chaincode
object. You can use this query to find whether a sufficient number of
organizations have approved a chaincode to meet the LifecycleEndorsement policy
before you commit the chaincode definition the channel, and which peers to
target with the commit transaction.


```
const tx_id = client.newTransactionID();
const request = {
   target: peer,
   chaincode: mychaincode
   txId: tx_id
}
// send to the peers to be endorsed
const approval_status = await mychannel.QueryApprovalStatus(request);
```


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
