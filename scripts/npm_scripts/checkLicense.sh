#!/bin/bash
#
# Copyright IBM Corp, SecureKey Technologies Inc. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#

CHECK=$(find . -type f \
    -not -path '*/.git/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/vendor/*' \
    -not -path './coverage/*' \
    -not -path './docs/*' \
    -not -path './LICENSE' \
    -not -path './test/fixtures/*' \
    -not -path './test/ts-fixtures/*' \
    -not -path './fabric-protos/bundle.js' \
    -not -path './fabric-protos/types/index.d.ts' \
    -not -path './fabric-network/lib/*' \
    -not -name '.*' \
    -not -name '*.txt' \
    -not -name '*.rst' \
    -not -name '*.json' \
    -not -name '*.md' \
    -not -name '*.yaml' \
    -not -name '*.yml' \
    -not -name '*.proto' \
    -not -name '*.id' \
    -not -name '*.gradle' \
    -not -name '*.pem' \
    -not -name '*.log' \
    -print | sort -u)

if [[ -z "$CHECK" ]]; then
    echo "All files are excluded from having license headers"
    exit 1
fi

missing=`echo "$CHECK" | xargs grep -L "SPDX-License-Identifier"`
if [[ -z "$missing" ]]; then
   echo "All files have SPDX-License-Identifier headers"
   exit 0
fi
echo "The following files are missing SPDX-License-Identifier headers:"
echo "$missing"
echo
echo "Please replace the Apache license header comment text with:"
echo "SPDX-License-Identifier: Apache-2.0"

echo
echo "Checking committed files for traditional Apache License headers ..."
missing=`echo "$missing" | xargs grep -L "http://www.apache.org/licenses/LICENSE-2.0"`
if [[ -z "$missing" ]]; then
   echo "All remaining files have Apache 2.0 headers"
   exit 0
fi
echo "The following files are missing traditional Apache 2.0 headers:"
echo "$missing"
echo "Fatal Error - All files must have a license header"
exit 1
