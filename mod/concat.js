/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

module.exports = compile;

var path = require('path');
var fs = require('fs');
var async = require('async');

function compile(source, target, options, callback) {
  options.documentRoot = path.normalize(this.resolve(options.documentRoot)+'/');
  var sources = this.source.map(function(s) { return s.path; });
  async.map(sources, function(source, callback) {
    fs.readFile(source, 'utf-8', function(err, content) {
      return callback(err, { source:source, content:content });
    });
  }, function(err, sources) {
    if (err) return callback(err);

    var combine = compile[compile.combine||'noop'];
    combine = ('function' === typeof combine) ? combine : compile.noop;

    sources = sources.map(combine).join('\n');
    fs.writeFile(target, sources, callback);
  });
}
compile.console = function(file) {
  return [
    '/* START: '+file.source+' */',
    //'if (window.console && window.console.log) { window.console.log("START: '+file.source+'"); } else { alert("START: '+file.source+'"); }',
    'try {',
    file.content,
    '} catch(err) {',
    '  if (window.console && window.console.log) { window.console.log("ERROR("+err.message+"): '+file.source+'"); } else { alert("ERROR("+err.message+"): '+file.source+'"); }',
    '}',
    //'if (window.console && window.console.log) { window.console.log("END: '+file.source+'"); } else { alert("END: '+file.source+'"); }',
    '/* END: '+file.source+' */'
  ].join('\n');
};
compile.comment = function(file) {
  return [
    '/* START: '+file.source+' */',
    file.content,
    '/* END: '+file.source+' */'
  ].join('\n')
};
compile.noop = function(file) {
  return file.content;
};
