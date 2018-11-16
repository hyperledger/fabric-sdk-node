// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
timeout(40) {
node ('hyp-x') { // trigger build on x86_64 node
  timestamps {
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
     def nodeHome = tool 'nodejs-8.11.3'
     env.ARCH = "amd64"
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.GOPATH = "$WORKSPACE/gopath"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:${nodeHome}/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/fabric-sdk-node ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR
                 # Clone fabric-sdk-node repository
                 git clone git://cloud.hyperledger.org/mirror/fabric-sdk-node && cd fabric-sdk-node
                 # Checkout to Branch and Apply patchset on latest commit
                 git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
                 # Print last two commit details
                 echo "************"
                 git log -n2 --pretty=oneline --abbrev-commit
                 echo "************"
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
// clean environment and get env data
      stage("Clean Environment - Get Env Info") {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --clean_Environment --env_Info'
                 }
               }
           catch (err) {
                 failure_stage = "Clean Environment - Get Env Info"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
        }
      }

// Run gulp tests (headless and Integration tests)
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
if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
    publishNpm()
}  else {
     echo "------> Don't publish npm modules from verify job"
   }

// Publish API Docs from merged job only
if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from verify job"
   }
     } finally {
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false,  failNoReports: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               // Send Merge failure notifications to Jenkins-robot RocketChat channel
               rocketSend message: "Build Notification - STATUS: *${currentBuild.result}* - BRANCH: *${env.GERRIT_BRANCH}* - PROJECT: *${env.PROJECT}* - BUILD_URL:  (<${env.BUILD_URL}|Open>)"
              }
           }
       }
  } // timestamps block
} // node block
} // timeout block

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
                 failure_stage = "publish_ApiDocs"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
      }
      }
}
