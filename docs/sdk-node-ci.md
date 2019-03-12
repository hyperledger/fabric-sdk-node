# Continuous Integration Process

This document explains the fabric-sdk-node Jenkins pipeline flow and FAQ's on the build process to
help developer to get more femilarize with the process flow.

To manage CI jobs, we use [JJB](https://docs.openstack.org/infra/jenkins-job-builder). Please see
the pipeline job configuration template here https://ci-docs.readthedocs.io/en/latest/source/pipeline_jobs.html#job-templates.

## CI Pipeline flow

![](sdk-node-pipeline-flow.png)

- Every Gerrit patchset triggers a verify job and run the below tests from the `Jenkinsfile`

  - gulp
  - gulp ca
  - gulp test
  - gulp test-logging
  - gulp run-test-scenario targets to run sdk-node tests.

All the above tests run on the Hyperledger infarstructure x86_64 build nodes. All these nodes uses
the packer with pre-configured software packages. This helps us to run the tests in much faster than
installing required packages everytime.

As we trigger `fabric-sdk-node-verify-x86_64` pipeline jobs for every gerrit patchset, we execute
the pipeline stages in the below order.

**VERIFY FLOW**

    CleanEnvironment -- OutputEnvironment -- Checkout SCM -- Build Artifacts -- Headless & Integration Tests

and below is the series of stages for the merge job flow. (`fabric-sdk-node-merge-x86_64`)

 **MERGE FLOW**

    CleanEnvironment -- OutputEnvironment -- Checkout SCM -- Build Artifacts -- Headless & Integration Tests -- Publish NPM modules -- Publish API Docs

- After cleanEnvironment and Display the environment details on the Jenkins console, CI scripts
  fetches the Gerrit refspec and try to execute **Headless and Integration Tests**. `docker-ready`
  is a sub target which will try to pull master latest stable images from Hyperledger DockerHub.
  Once the tests are executed successfully, it checks the condition whether it is a verify or merge.
  If it is a merge job, Jenkins triggers the **Publish npm modules** and **API Docs** stages and publishes
  the npm modules and api docs to gh-pages.

  Note: CI script provides an option to build the images on the latest fabric commit and run the
  sdk-node tests. For this you have to modify **IMAGE_SOURCE** to **build** in the ci.properties file.
  If you would like to pull the images from nexus, update **IMAGE_SOURCE** to **nexus**.
  Though we pull the images from nexus with this change, in release branches the gulp file pulls the
  images from dockerhub. So till we change the build process in the gulp file, let's pull these images
  from docker hub.

- Snapshot npm modules can be seen here. https://www.npmjs.com/package/fabric-client, https://www.npmjs.com/package/fabric-ca-client etc..

- API docs can be accessible from https://fabric-sdk-node.github.io/master/index.html

- Jenkins sends build notifications only on the merge failure job. Jenkins sends build notifications
  to RocketChat `jenkins-robot` channel and an email to the owner of the patchset. If you would like to
  send build notifications to someother channel, simply change the channel name in the ci.properties file.

See below **FAQ's** to contribute to CI changes.

## FAQ's

#### Supported platforms

- x86_64
- s390x (Not for every patchset but run tests in daily builds)

#### Trigger failed jobs through gerrit comments

Developers can re-trigger the failed verify jobs by post **reverify** as a comment phrase to the gerrit
change set that retriggers all the verify jobs. To do so, follow the below process:

Step 1: Open the gerrit patch set for which you want to reverify the build

Step 2: Click on Reply, then type **reverify** and click on post

This kicks off all the fabric-sdk-node verify jobs. Once the build is triggered, you can observe the
Jenkins console output, if you are interested in viewing the log messages to determine how well the
build jobs are progressing.

Developer can post below comments to trigger the particular failed build:
    
     reverify-x or reverify - to restart the build on sdk-node-verify x86_64 platform.
     remerge-x or remerge - to restart the build on sdk-node-verify x86_64 platform.

#### Where to see the output of the stages?

Piepline supports two views (stages and blueocean). Staged views shows on the Jenkins job
main page and it shows each stage in order and the status. For better view, we suggest you to
access the BlueOcean plugin. Click on the JOB Number and click on the **Open Blue Ocean** link
that shows the build stages in pipeline view. Also, we capture the `.logs files` and keep them
on the Job console.

#### How to add more stages to this pipeline flow?

We use scripted pipeline syntax with groovy and shell scripts. Also, we use global shared library
scripts which are placed in https://github.com/hyperledger/ci-management/tree/master/vars. Try to
leverage the common functions in your code. All you have to do is, undestand the pipeline flow of
the tests, add one more stage as mentioned in the existing Jenkinsfile.

#### What steps I have to modify when I create a new branch from master?

As the Jenkinsfile is parametrized, you no need to modify anything in the Jenkinsfile but you may endup modifying ci.properties file with the Base Versions, Baseimage versions, GO_VER etc... as per the new branch configuration.

#### Build Scripts

Multiple build scripts are used in fabric-sdk-node CI flow. We use global shared library scripts
and Jenkinsfile.

Global Shared Library - https://github.com/hyperledger/ci-management/tree/master/vars

Jenkinsfile           - https://github.com/hyperledger/fabric-sdk-node/tree/master/Jenkinsfile

ci.properties         - https://github.com/hyperledger/fabric-sdk-node/tree/master/ci.properties
(ci.properties is the only file you have to modify with the values requried for the specific branch.)

Packer Scripts        - https://github.com/hyperledger/ci-management/blob/master/packer/provision/docker.sh
(Packer is a tool for automatically creating VM and container images, configuring them and
post-processing them into standard output formats. We build Hyperledger's CI images via Packer
and attach them to x86_64 build nodes. On s390x, we install manually. See the packages we install
as a pre-requisite in the CI x86 build nodes.)

#### How to reach out to CI team?

Post your questions or feedback in https://chat.hyperledger.org/channel/ci-pipeline or https://chat.hyperledger.org/channel/fabric-ci Rocket Chat channels. Also, we suggest you to create a task/bug in JIRA under FABCI project. https://jira.hyperledger.org/projects/FABCI