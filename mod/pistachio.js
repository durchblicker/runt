/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = compile;
module.exports.dependencies = dependencies;

var pistachio = require('pistachio').parse;
var fs = require('fs');

function compile(source, target, siblings, options, callback) {
  pistachio(source, function(err, template) {
    if (err) return callback(err);
    fs.writeFile(target, template.code(options), 'utf-8', callback);
  });
}

function dependencies(source, options, callback) {
  pistachio(source, function(err, template) {
    if (err) return callback(err);
    var partials=template.partials();
    return callback(undefined, partials);
  });
}
