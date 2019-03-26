#!groovy

// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//

// Jenkinsfile get triggered when a patchset a submitted or merged
// On Verify job, pull fabric, nodeenv, javaenv images from nexus3 and
// run gulp tests. On merge job, pull above images from nexus3 and publish
// npm modules with snapshot tag and API docs after merge job is successful

@Library("fabric-ci-lib") _ // global shared library from ci-management repository
// global shared library from ci-management repository
// https://github.com/hyperledger/ci-management/tree/master/vars (Global Shared scripts)
timestamps { // set the timestamps on the jenkins console
  timeout(40) { // Build timeout set to 40 mins
    if(env.NODE_ARCH != "hyp-x") {
      node ('hyp-z') { // trigger jobs on s390x builds nodes
        // Update the node version here
        env.NODE_VER = "8.14.0" // Set node version
        env.GOPATH = "$WORKSPACE/gopath"
        env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:~/npm/bin:/home/jenkins/.nvm/versions/node/v${NODE_VER}/bin:$PATH"
        buildStages() // call buildStages
      } // End node
    } else {
      node ('hyp-x') { // trigger jobs on x86_64 builds nodes
        // LF team has to install the newer version in Jenkins global config
        // Send an email to helpdesk@hyperledger.org to add newer version
        def nodeHome = tool 'nodejs-8.14.0'
        env.GOPATH = "$WORKSPACE/gopath"
        env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:${nodeHome}/bin:$PATH"
        buildStages() // call buildStages
      } // end node block
    }
  } // end timeout block
} // end timestamps block

def buildStages() {
    try {
      def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
      def failure_stage = "none"
      // set MARCH value to amd64, s390x, ppc64le
      env. MARCH = sh(returnStdout: true, script: "uname -m | sed 's/x86_64/amd64/g'").trim()
      stage('Clean Environment') {
        // delete working directory
        deleteDir()
        // Clean build environment before start the build
        fabBuildLibrary.cleanupEnv()
        // Display jenkins environment details
        fabBuildLibrary.envOutput()
      }

      stage('Checkout SCM') {
        // Get changes from gerrit
        fabBuildLibrary.cloneRefSpec('fabric-sdk-node')
        // Load properties from ci.properties file
        props = fabBuildLibrary.loadProperties()
      }

      stage("Build Artifacts") {
        dir("$ROOTDIR/$BASE_DIR") {
          if(props["IMAGE_SOURCE"] == "build") {
            // Set PATH
            env.GOROOT = "/opt/go/go" + props["GO_VER"] + ".linux." + "$MARCH"
            env.GOPATH = "$GOPATH/bin"
            env.PATH = "$GOROOT/bin:$GOPATH/bin:$PATH"
            // clone repository
            fabBuildLibrary.cloneScm('fabric', '$GERRIT_BRANCH')
            // build fabric docker images
            fabBuildLibrary.fabBuildImages('fabric', 'docker')
            // clone fabric-ca
            fabBuildLibrary.cloneScm('fabric-ca', '$GERRIT_BRANCH')
            // build fabric-ca docker images
            fabBuildLibrary.fabBuildImages('fabric-ca', 'docker')
            // Pull images from nexus3
            fabBuildLibrary.pullDockerImages(props["FAB_BASE_VERSION"], props["FAB_IMAGES_LIST"])
            // Pull Thirdparty Docker Images from hyperledger DockerHub
            fabBuildLibrary.pullThirdPartyImages(props["FAB_BASEIMAGE_VERSION"], props["FAB_THIRDPARTY_IMAGES_LIST"])
          } else { 
            if(env.GERRIT_BRANCH == "master") {
              // Pull Docker Images from nexus3
              fabBuildLibrary.pullDockerImages(props["FAB_BASE_VERSION"], props["FAB_IMAGES_LIST"])
              // Pull Thirdparty Docker Images from hyperledger DockerHub
              fabBuildLibrary.pullThirdPartyImages(props["FAB_BASEIMAGE_VERSION"], props["FAB_THIRDPARTY_IMAGES_LIST"])
            }
            else {
              sh 'echo -e "\\033[1m SKIP PULLING IMAGES FROM NEXUS.\\033[0m"'
              sh 'echo -e "\\033[1m Let gulp docker-ready pull images from DockerHub\\033[0m"'
            }
          }
        }
      }
      stage("NPM Install") {
            wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
              try {
                dir("$ROOTDIR/$PROJECT_DIR") {
                  sh '''
                    set -x
                    npm install
                    npm install -g gulp && npm install -g istanbul
                    gulp
                    gulp ca
                    set +x
                  '''
                }
              }
              catch (err) {
                failure_stage = "NPM Install"
                currentBuild.result = 'FAILURE'
                throw err
              }
            }
          }
      // Run gulp tests (headless and integration tests)
      stage("Headless Tests") {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
          try {
            dir("$ROOTDIR/$PROJECT_DIR/scripts/ci_scripts") {
              sh './ciScript.sh --sdk_Headless'
            }
          }
          catch (err) {
            failure_stage = "sdk_Headless"
            currentBuild.result = 'FAILURE'
            throw err
          }
        }
      }
      // Run Integration
      stage("Integration Tests") {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
          try {
            dir("$ROOTDIR/$PROJECT_DIR/scripts/ci_scripts") {
              sh './ciScript.sh --sdk_Integration'
            }
          }
          catch (err) {
            failure_stage = "sdk_Integration"
            currentBuild.result = 'FAILURE'
            throw err
          }
        }
      }
      // Run Cucumber & Logger
      stage("Cucumber & Logger Tests") {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
          try {
            dir("$ROOTDIR/$PROJECT_DIR/scripts/ci_scripts") {
              sh './ciScript.sh --sdk_Cucumber --sdk_Logger'
            }
          }
          catch (err) {
            failure_stage = "sdk_Cucumber_Logger"
            currentBuild.result = 'FAILURE'
            throw err
          }
        }
      }
// Publish npm modules only from amd64 merge jobs
if ((env.JOB_TYPE == "merge") && (env.MARCH = "amd64")) {
  publishNpm()
  apiDocs()
} else {
    sh 'echo -e "\\033[1m Dont publish npm modules and api docs from VERIFY job\\033[0m"'
}
    } finally { // post build actions
        // Don't fail the build if there is no coverage report file
        step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false,
              coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false,
              failNoReports: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII',
              zoomCoverageChart: false])
        // Don't fail the build if there is no log file
        archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
        // Send notifications only for merge failures
        if (env.JOB_TYPE == "merge") {
          if (currentBuild.result == 'FAILURE') {
            // Send notification to rocketChat channel
            // Send merge build failure email notifications to the submitter
            sendNotifications(currentBuild.result, props["CHANNEL_NAME"])
          }
        }
        // Delete containers
        fabBuildLibrary.deleteContainers()
        // Delete unused docker images (none,dev,test-vp etc..)
        fabBuildLibrary.deleteUnusedImages()
        // Delete workspace when build is done
        cleanWs notFailBuild: true
      } // end finally block
} // end buildStages

def publishNpm() {
  // Publish npm modules after successful merge
  stage("Publish npm Modules") {
    sh 'echo "-------> Publish npm Modules"'
    withCredentials([[$class       : 'StringBinding',
      credentialsId: 'NPM_LOCAL',
      variable : 'NPM_TOKEN']]) {
      try {
        dir("$ROOTDIR/$PROJECT_DIR/scripts/ci_script") {
          sh './ciScript.sh --publish_NpmModules'
        }
      } catch (err) {
        failure_stage = "publish_NpmModules"
        currentBuild.result = 'FAILURE'
        throw err
      }
    }
  }
}

def apiDocs() {
  // Publish SDK_NODE API docs after successful merge
  stage("Publish API Docs") {
    sh 'echo "--------> Publish API Docs"'
    withCredentials([[$class     : 'UsernamePasswordMultiBinding',
      credentialsId: 'sdk-node-credentials',
      usernameVariable: 'NODE_SDK_USERNAME',
      passwordVariable: 'NODE_SDK_PASSWORD']]) {
    try {
      dir("$ROOTDIR/$PROJECT_DIR/scripts/ci_script") {
        sh './ciScript.sh --publish_ApiDocs'
      }
    }
    catch (err) {
      failure_stage = "publish_Api_Docs"
      currentBuild.result = 'FAILURE'
      throw err
    }
    }
  }
}
