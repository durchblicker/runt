/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

exports.aggregate = aggregate;
exports.individual = individual;
exports.options = options;

var Pea = require('pea');
var UglifyJS = require('uglify-js');
var Path = require('path');
var Fs = require('fs');

function aggregate(sources, target, options, callback) {
  var sources;
  options.outSourceMap = Path.join(Path.dirname(target), Path.basename(target, '.js') + '.map');

  if (options.compress !== false) {
    options.compress = options.compress || {};
    options.compress.warnings=false;
  }
  var result = UglifyJS.minify(sources, options);

  var writejs = Pea(Fs.writeFile, target, [result.code, '//@ sourceMappingURL=' + options.outSourceMap].join('\n\n'));
  var writemap = Pea(Fs.writeFile, options.outSourceMap, String(result.map).split(options.documentRoot).join('/'));
  Pea.all(writejs, writemap).then(callback);
}

function individual(source, target, options, callback) {
  return aggregate([source], target, options, callback);
}

function options(rule, callback) {
  rule.options.documentRoot = Path.normalize(Path.resolve(rule.base, rule.options.documentRoot)+'/');
  callback();
}
