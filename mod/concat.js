/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

exports.aggregate = aggregate

var Pea = require('pea');
var path = require('path');
var Fs = require('fs');

function aggregate(sources, target, options, callback) {
  Pea.map(sources, function(source, callback) {
    callback = arguments[arguments.length - 1];
    Fs.readFile(source, 'utf-8', function(err, content) {
      return callback(err, {
        source: source,
        content: content
      });
    });
  }).success(function(sources) {
    var combine = compile[compile.combine || 'noop'];
    combine = ('function' === typeof combine) ? combine : compile.noop;
    sources = sources.map(combine).join('\n');
    Fs.writeFile(target, sources, callback);
  }).failure(callback);
}

var compile={};
compile.console = function(file) {
  return [
    '/* START: ' + file.source + ' */',
  //'if (window.console && window.console.log) { window.console.log("START: '+file.source+'"); } else { alert("START: '+file.source+'"); }',
  'try {',
  file.content,
    '} catch(err) {',
    '  if (window.console && window.console.log) { window.console.log("ERROR("+err.message+"): ' + file.source + '"); } else { alert("ERROR("+err.message+"): ' + file.source + '"); }',
    '}',
  //'if (window.console && window.console.log) { window.console.log("END: '+file.source+'"); } else { alert("END: '+file.source+'"); }',
  '/* END: ' + file.source + ' */'].join('\n');
};
compile.comment = function(file) {
  return [
  ('/* START: ' + file.source + ' */'),
  file.content, ('/* END: ' + file.source + ' */')].join('\n');
};
compile.noop = function(file) {
  return file.content;
};
