/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = findFiles;
module.exports.stat = statFile;

var glob = require('glob');
var async = require('async');
var fs = require('fs');
var path = require('path');

function findFiles(basedir, pattern, callback) {
  glob(pattern, { cwd:basedir, nonull:false }, function(err, files) {
    if (err) return callback(err);
    files = (files || []).map(function(item) {
      return path.resolve(basedir, item);
    });
    async.map(files, statFile, function(err, files) {
      if (err) return callback(err);
      files = (files || []).filter(function(file) {
        return (file && file.name && ('undefined' !== typeof file.isFile) && ('undefined' !== typeof file.isDirectory));
      });
      callback(undefined, files);
    });
  });
}

function statFile(file, callback) {
  file = String(file);
  file = { path:file, name:path.basename(file), extension:path.extname(file), directory:path.dirname(file) };
  fs.stat(file.path, function(err, stat) {
    if (!err && stat) {
      file.modified = stat.mtime;
      file.created = stat.ctime;
      file.size = stat.size;
      file.isFile = stat.isFile();
      file.isDirectory = stat.isDirectory();
      file.isSpecial = (stat.isBlockDevice() || stat.isCharacterDevice() || stat.isFIFO() || stat.isSocket());
    }
    callback(undefined, file);
  });
}
