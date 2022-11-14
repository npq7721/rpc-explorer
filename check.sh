#!/bin/bash

HEALTH_LOG=/applogs/healthcheck.log

function GetNumber () {
  if [[ ${1} =~ ^[+-]?[0-9]+([.][0-9]+)?$ ]]; then
    echo "${1}"
  else
    echo "-1"
  fi
}

function log() {
  echo "$(date -u) $@"
  echo "$(date -u) $@" >> $HEALTH_LOG
}

function externalBlockHeight() {
  if [[ -n "${CHAIN_API_URL}" ]]; then
    block_height_result=$(curl -k -X GET ${CHAIN_API_URL}/rtm/getblockcount/)
    block_height=$(GetNumber block_height_result)
    echo $block_height
  fi
  echo -1
}

current_block="$(curl -X GET http://localhost:${BTCEXP_PORT}/api/getblockcount?nocache=true)"
function checkHeight() {
  if [[ $current_block == *"error"* ]]; then
    log "unable to get current block: $current_block"
    return 1
  fi

  current_block=$(GetNumber "$current_block")
  external_block_height=$(externalBlockHeight)
  height_diff=$((( current_block - external_block_height));)
  height_diff="${height_diff/#-}"
  if (( current_block > 0 && (external_block_height < 0 || height_diff < 5))); then
    log "explorer is ok explorer height/external_height ${current_block}/${external_block_height}"
    return 0
  fi

  log "explorer may not be ok explorer height/external_height ${current_block}/${external_block_height}"
  return 1
}

checkHeight
