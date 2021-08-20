#!/usr/bin/bash

set -e

SELF=$(readlink -f "$0")
DIR=$(dirname "$SELF")

curl https://jsonlogic.com/tests.json -o "$DIR/tests.json"
#curl https://jsonlogic.com/rule_like.json -o "$DIR/rule_like.json"
