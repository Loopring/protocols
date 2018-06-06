import ethUtil from 'ethereumjs-util';
/**
 * trim head space and tail space
 * @param str string
 */
export function trim(str) {
  return str.replace(/(^\s+)|(\s+$)/g, "");
}

/**
 * trim all spaces
 * @param str
 */
export function trimAll(str) {
  return trim(str).replace(/\s/g, "");
}

export function keccakHash(str) {
  return ethUtil.bufferToHex(ethUtil.keccak(str))
}