/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = compile;

var UglifyJS = require('uglify-js');
var path = require('path');
var fs = require('fs');
var async = require('async');

function compile(source, target, options, callback) {
  options.documentRoot = path.normalize(options.documentRoot+'/');
  options.outSourceMap = path.relative(options.documentRoot, target+'.map');
  options.sourceRoot = '/';
  var result = UglifyJS.minify(this.source.map(function(s) { return s.path; }), options);
  async.forEach([
    { path:target, content:[ result.code, '//@ sourceMappingURL=/'+options.outSourceMap ].join('\n\n') },
    { path:target+'.map', content:String(result.map).split(options.documentRoot).join('') }
  ], function(file, callback) {
    console.log('Writing('+file.content.length+'): ',file.path);
    fs.writeFile(file.path, file.content, callback);
  }, callback);
}
