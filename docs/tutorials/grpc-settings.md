
This tutorial illustrates the different ways of setting the gRPC settings used on connections to the Hyperledger Fabric network with a Hyperledger Fabric Node.js Client as of 2.1

The following assumes an understanding of the Hyperledger Fabric network
(orderers and peers),
and of Node application development.

### Overview
The Hyperledger Fabric Node.js javascript SDK, `fabric-common`,  communicates
with a Hyperledger Fabric network using gRPC. The gRPC technology, framework,
handles moving data reliably between the fabric network and the fabric client
application.
fabric-common allows the application to provide settings required to control
the environment.

fabric-common has default connection options that include default gRPC settings.
There are various ways for the application to override the default connection
options.

### Default connection options
fabric-common has the following gRPC connection options as defaults.
These are in the `default.json` system configuration file that is included
with the fabric-common NPM package.
```
	"connection-options": {
		"grpc.max_receive_message_length": -1,
		"grpc.max_send_message_length": -1,
		"grpc.keepalive_time_ms": 120000,
		"grpc.http2.min_time_between_pings_ms": 120000,
		"grpc.keepalive_timeout_ms": 20000,
		"grpc.http2.max_pings_without_data": 0,
		"grpc.keepalive_permit_without_calls": 1
	}
```
* `grpc.max_receive_message_length` - Maximum message length that the channel
can receive. Int valued, bytes. -1 means unlimited.
* `grpc.max_send_message_length` - Maximum message length that the channel can
send. Int valued, bytes. -1 means unlimited.
* `grpc.keepalive_time_ms` - After a duration of this time the client/server
pings its peer to see if the transport is still alive. Int valued, milliseconds.
* `grpc.keepalive_timeout_ms` - After waiting for a duration of this time,
if the keepalive ping sender does not receive the ping ack, it will close the
transport. Int valued, milliseconds.
* `grpc.keepalive_permit_without_calls` - Is it permissible to send keepalive
pings without any outstanding streams. Int valued, 0(false)/1(true).
* `grpc.http2.min_time_between_pings_ms` - Minimum time between sending
successive ping frames without receiving any data frame.
Int valued, milliseconds.
* `grpc.http2.max_pings_without_data` - Minimum allowed time between a server
receiving successive ping frames without sending any data frame.
Int valued, milliseconds.

### Change default connection options
The application may have a need to change or add new gRPC settings.
By using the system configuration, the application may change the default
connection options used for all new connections established.

The default connection options are retrieved as a set of options when
the {@link Client} instance builds new {@link Endorsers}s or new {@link Orderer}s.
To modify the  default connection options before runtime, update the
`default.json` file or add your own configuration file to the system configuration.
The last file loaded will override all previous files including the `default.json`
file shipped with the fabric-common. see {@link BaseClient.addConfigFile}.
```
const Client = require('fabric-common');
Client.addConfigFile(<path to the config file>);
```
To modify the default connection options during runtime, get them from the
system configuration, make modifications, then set them back on the system
configuration.
```
const default_options = client.getConfigSetting('connection-options');
const new_option = {
    'grpc.keepalive_timeout_ms': 10000
};

// use the assign call to keep all other options and only update
// the one setting or add a setting.
const new_defaults = Object.assign(default_options, new_option);
client.setConfigSetting('connection-options', new_defaults);

// peer will have default options
const peer = client.newPeer(url, options);
```

Note: Making a change to the system configuration will have all new
connections use new default connection options. This includes the
connections that are created by new peers and new orderers that are
created automatically when using the discovery service.
Be careful when assigning new values to not remove other values.
All the default connection options are contained in the one system
configuration setting `connection-options`.

### Add connection options to the client
The application may have a need to change or add new gRPC settings.
The application may add connection options to the client instance
that may be new options or to override existing default connection
options stored in the system configuration. See the above
discussion on how to change the options within the system configuration.
```
const new_options = {
    'grpc.keepalive_timeout_ms': 10000
};
client.addConnectionOptions(new_options);

// peer will have options from default and from client
const peer = client.newPeer(url, options);

// discovered peers will have options from default and from client
channel.initialize({discover: true, target: peer});
```
Note: All new connections created by this client, including those created
automatically when using the discovery service will use the client's
connection options to override the default connection options.

### Add connection options on create
The application may need unique connection options for individual
peers or orderers. Unique settings may be passed on the
{@link Client#newPeer} or
{@link Client#newOrderer} calls in the option parameter.
Options passed in on the call will override both the client based
options and the system configuration based options.
```
const options = {
    pem: '<pem string>',
	'ssl-target-name-override': 'myhost.org1.com',
    'grpc.keepalive_timeout_ms': 10000
};

// peer will have options from default, client, and parameter
const peer = client.newPeer(url, options);
```
Note: Connection options passed on the `newPeer()` and the `newOrderer()`
calls will only be used for that peer or orderer.

### Add connection options to a common connection profile
Connection options may be set at the client level or individually on peers and
orderers when using a common connection profile. In the following profile
both the client section and one peer have a gRPC setting.
```
client:
  # Which organization does this application instance belong to? The value is the name of an org
  # defined under "organizations"
  organization: Org1

  # set connection timeouts for the peer and orderer for the client
  connection:
    timeout:
      peer:
        # the timeout in seconds to be used on requests to a peer,
        # for example 'sendTransactionProposal'
        endorser: 120
        # the timeout in seconds to be used by applications when waiting for an
        # event to occur. This time should be used in a javascript timer object
        # that will cancel the event registration with the channel event hub instance.
        eventHub: 60
        # the timeout in seconds to be used when setting up the connection
        # with the peer event hub. If the peer does not acknowledge the
        # connection within the time, the application will be notified over the
        # error callback if provided.
        eventReg: 3
      # the timeout in seconds to be used on request to the orderer,
      # for example
      orderer: 30
      # connection options, typically these will be common GRPC settings,
      # overriding what has been set in the system config file "default.json"
    options:
      grpc.keepalive_timeout_ms: 10000
peers:
  peer1.org2.example.com:
    url: grpcs://localhost:8051
    grpcOptions:
      ssl-target-name-override: peer1.org2.example.com
      grpc.keepalive_timeout_ms: 20000
    tlsCACerts:
      path: test/fixtures/channel/c...
  peer2.org2.example.com:
    url: grpcs://localhost:8052
    grpcOptions:
      ssl-target-name-override: peer2.org2.example.com
    tlsCACerts:
      path: test/fixtures/channel/c...
```
Note: All new connections created by this client, including those created
automatically when using the discovery service will use the client's
connection options to override the default connection options. `peer1`
will be override the one setting with it's own unique value. `peer2`
will not override any of the client's or the system defaults.
The application may call the `client.addConnectionOptions()` to add
additional settings or override settings. Peers created by a call
to {@link Client#getPeer} or orderers created by a call to
{@link Client#getOrderer} or by a call to {@link Client#getChannel}
after the add call will use the new set of values.
<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
