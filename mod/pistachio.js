/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

exports.individual = individual;
exports.dependencies = dependencies;

var Pistachio = require('pistachio');
var Fs = require('fs');
var Pea = require('pea');

function individual(source, target, options, callback) {
  Pistachio.compile(source, options, function(err, code) {
    if (err) return callback(err);
    Fs.writeFile(target, code, callback);
  });
}

function dependencies(templates, callback) {
  var result = [];
  var index = {};
  Pea.map(templates, function(file, callback) {
    callback=arguments[arguments.length-1];
    Pea(Pistachio.parse, file).success(function(tpl) {
      var parts = tpl.partials();
      result = result.concat(parts);
      parts.forEach(function(part) {
        index[part] = index[part] || [];
        index[part].push(file);
        //console.error('Registering '+file+' depends on '+part);
      });
      callback();
    }).failure(callback);
  }).success(function() {
    var res = {};
    result.forEach(function(file) { res[file]=true; });
    result = Object.keys(res).sort(function(a,b) { return a.length-b.length; });
    callback(null, result, index);
  }).failure(callback);
}
