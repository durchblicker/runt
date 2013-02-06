/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = compile;

var UglifyJS = require('uglify-js');
var path = require('path');
var fs = require('fs');
var async = require('async');

function compile(source, target, options, callback) {
  var sources;
  options.documentRoot = path.normalize(this.resolve(options.documentRoot)+'/');
  if (('object' === typeof target) && target.search && target.replace) {
    target = source.path.replace(new RegExp(target.search,'g'), target.replace);
    sources = [ source.path ];
  } else {
    sources = this.source.map(function(s) { return s.path; });
  }

  options.outSourceMap = path.basename(target+'.map');
  var result = UglifyJS.minify(sources, options);
  async.forEach([
    { path:target, content:[ result.code, '//@ sourceMappingURL='+options.outSourceMap ].join('\n\n') },
    { path:target+'.map', content:String(result.map).split(options.documentRoot).join('/') }
  ], function(file, callback) {
    //console.log('Writing('+file.content.length+'): ',file.path);
    fs.writeFile(file.path, file.content, callback);
  }, callback);
}
