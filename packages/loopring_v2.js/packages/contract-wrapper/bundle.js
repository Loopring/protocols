'use strict';

// UMD
(function(name, definition) {
  var theModule = definition(),
    // this is considered "safe":
    hasDefine = typeof define === 'function' && define.amd,
    // hasDefine = typeof define === 'function',
    hasExports = typeof module !== 'undefined' && module.exports;

  if (hasDefine) { // AMD Module
    define(theModule);
  } else if (hasExports) { // Node.js Module
    module.exports = theModule;
  } else { // Assign to common namespaces or simply the global object (window)
    (this.jQuery || this.ender || this.$ || this)[name] = theModule;
  }
})('contract-wrapper', function() {
  var module = this;
  module.plugins = [];
  module.highlightColor = "yellow";
  module.errorColor = "red";

  // Exposed public methods
  return {
    highlightColor: module.highlightColor
  };

});
