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
     env.VERSION = sh(returnStdout: true, script: 'curl -O https://raw.githubusercontent.com/hyperledger/fabric/master/Makefile && cat Makefile | grep "BASE_VERSION =" | cut -d "=" -f2').trim()
     env.VERSION = "$VERSION" // BASE_VERSION from fabric Makefile
     env.ARCH = "amd64"
     env.IMAGE_TAG = "${ARCH}-${VERSION}-stable" // fabric latest stable version from nexus
     env.PROJECT_VERSION = "${VERSION}-stable"
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.GOPATH = "$WORKSPACE/gopath"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:${nodeHome}/bin:$PATH"
     def jobname = sh(returnStdout: true, script: 'echo ${JOB_NAME} | grep -q "verify" && echo patchset || echo merge').trim()
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") {
          try {
             if (jobname == "patchset")  {
                   println "$GERRIT_REFSPEC"
                   println "$GERRIT_BRANCH"
                   checkout([
                       $class: 'GitSCM',
                       branches: [[name: '$GERRIT_REFSPEC']],
                       extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'gopath/src/github.com/hyperledger/$PROJECT'], [$class: 'CheckoutOption', timeout: 10]],
                       userRemoteConfigs: [[credentialsId: 'hyperledger-jobbuilder', name: 'origin', refspec: '$GERRIT_REFSPEC:$GERRIT_REFSPEC', url: '$GIT_BASE']]])
              } else {
                   // Clone fabric-sdk-node on merge
                   println "Clone $PROJECT repository"
                   checkout([
                       $class: 'GitSCM',
                       branches: [[name: 'refs/heads/$GERRIT_BRANCH']],
                       extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'gopath/src/github.com/hyperledger/$PROJECT']],
                       userRemoteConfigs: [[credentialsId: 'hyperledger-jobbuilder', name: 'origin', refspec: '+refs/heads/$GERRIT_BRANCH:refs/remotes/origin/$GERRIT_BRANCH', url: '$GIT_BASE']]])
              }
              dir("${ROOTDIR}/$PROJECT_DIR/$PROJECT") {
              sh '''
                 # Print last two commit details
                 echo
                 git log -n2 --pretty=oneline --abbrev-commit
                 echo
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
          wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
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
         }

// Pull fabric,fabric-ca and Javaenv
      stage("Pull Docker Images") {
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
      stage("Headless & Integration Tests") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-sdk-node/scripts/Jenkins_Scripts") {
                 // Get the testFabricVersion and thirdpartyVersion from package.json
                 // and Pull the DockerImages from dockerhub and run the Integration Tests
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
     echo "------> Don't publish npm modules from VERIFY job"
   }

// Publish API Docs from merged job only
if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from VERIFY job"
   }

    } finally { // Code for coverage report
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, failNoReports: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.JOB_NAME == "fabric-sdk-node-merge-x86_64") {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               // Sends merge failure notifications to Jenkins-robot RocketChat Channel
               rocketSend message: "Build Notification - STATUS: *${currentBuild.result}* - BRANCH: *${env.GERRIT_BRANCH}* - PROJECT: *${env.PROJECT}* - BUILD_URL:  (<${env.BUILD_URL}|Open>)"
              }
           }
      } // finally block
  } // timestamps block
} // node block block
} // timeout block

def publishNpm() {
// Publish npm modules after successful merge
      stage("Publish npm Modules") {
        sh 'echo "-------> Publish npm Modules"'
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
        sh 'echo "--------> Publish API Docs"'
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
