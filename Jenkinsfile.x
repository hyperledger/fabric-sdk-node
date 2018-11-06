// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
node ('hyp-x') { // trigger build on x86_64 node
 timestamps {
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>
     env.NODE_VER = "8.11.3"
     env.VERSION = sh(returnStdout: true, script: 'curl -O https://raw.githubusercontent.com/hyperledger/fabric/master/Makefile && cat Makefile | grep "BASE_VERSION =" | cut -d "=" -f2').trim()
     env.VERSION = "$VERSION" // BASE_VERSION from fabric Makefile
     env.ARCH = "amd64"
     env.IMAGE_TAG = "${ARCH}-${VERSION}-stable" // fabric latest stable version from nexus
     env.PROJECT_VERSION = "${VERSION}-stable"
     env.BASE_IMAGE_VER = sh(returnStdout: true, script: 'cat Makefile | grep BASEIMAGE_RELEASE= | cut -d "=" -f2').trim() // BASEIMAGE Version from fabric Makefile
     env.BASE_IMAGE_TAG = "${ARCH}-${BASE_IMAGE_VER}" //fabric baseimage version
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.GOPATH = "$WORKSPACE/gopath"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:~/npm/bin:/home/jenkins/.nvm/versions/node/v${NODE_VER}/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/fabric-sdk-node ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR
                 git clone git://cloud.hyperledger.org/mirror/fabric-sdk-node && cd fabric-sdk-node
                 git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 throw err
           }
         }
// clean environment and get env data
      stage("Clean Environment - Get Env Info") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --clean_Environment --env_Info'
                 }
               }
           catch (err) {
                 failure_stage = "Clean Environment - Get Env Info"
                 throw err
           }
         }

// Pull Couchdb Image
      stage("Pull Couchdb image") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --pull_Thirdparty_Images'
                 }
               }
           catch (err) {
                 failure_stage = "Pull couchdb docker image"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Pull fabric,fabric-ca and Javaenv
      stage("Pull Docker images") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --pull_Docker_Images'
                 }
               }
           catch (err) {
                 failure_stage = "Pull docker images"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Run gulp tests (headless and integration tests)
      stage("Integration Tests") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --sdk_E2e_Tests'
                 }
               }
           catch (err) {
                 failure_stage = "sdk_E2e_Tests"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Publish npm modules from merged job
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    publishNpm()
}  else {
     echo "------> Don't publish npm modules from verify job"
   }

// Publish API Docs from merged job only
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from verify job"
   }

    } finally { // Code for coverage report
           junit '**/cobertura-coverage.xml'
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, failNoReports: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.GERRIT_EVENT_TYPE == 'change-merged') {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               rocketSend channel: "Build Notification - STATUS: ${currentBuild.result} - BRANCH: ${env.GERRIT_BRANCH} - PROJECT: ${env.PROJECT} - BUILD_URL:  (<${env.BUILD_URL}|Open>)"
              }
           }
      } // finally block end here
  } // timestamps end here
} // node block end here

def publishNpm() {
// Publish npm modules after successful merge
      stage("Publish npm Modules") {
        def ROOTDIR = pwd()
        withCredentials([[$class       : 'StringBinding',
                      credentialsId: 'NPM_LOCAL',
                      variable : 'NPM_TOKEN']]) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_NpmModules'
                 }
               }
           catch (err) {
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
        def ROOTDIR = pwd()
        withCredentials([[$class     : 'UsernamePasswordMultiBinding',
                         credentialsId: 'sdk-node-credentials',
                         usernameVariable: 'NODE_SDK_USERNAME',
                         passwordVariable: 'NODE_SDK_PASSWORD']]) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_ApiDocs'
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
