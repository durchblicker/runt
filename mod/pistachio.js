/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = compile;
module.exports.dependencies = dependencies;

var pistachio = require('pistachio').compiler;
var fs = require('fs');

function compile(source, target, options, callback) {
  pistachio(source.path, function(err, template) {
    if (err) return callback(err);
    fs.writeFile(target, template, 'utf-8', callback);
  });
}

function dependencies(source, callback) {
  pistachio.parse(source.path, function(err, template) {
    if (err) return callback(err);
    var partials=template.partials();
    return callback(undefined, partials);
  });
}
