/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

module.exports = compile;
module.exports.dependencies = dependencies;

var Parser = require('less').Parser;
var fs = require('fs');
var path = require('path');
var async = require('async');

function compile(source, target, siblings, options, callback) {
  var parser = new Parser({
    paths:[ path.dirname(source) ],
    filename:source
  });
  fs.readFile(source, 'utf-8', function(err, less) {
    parser.parse(less, function(err, tree) {
      if (err) return callback(err);
      try {
        tree = tree.toCSS(options);
      } catch(ex) {
        console.error('ERROR',ex);
        return callback(err);
      }
      fs.writeFile(target, tree, callback);
    });
  });
}

function find(file, callback) {
  fs.readFile(file, 'utf-8', function(err, less) {
    if (err) return callback(err);
    var comment;
    less = less.split(/\r?\n/).map(function(line) {
      if (/\*\//.test(line)) {
        comment = false;
        return;
      }
      if (comment) return;
      if (/\/\*/.test(line)) {
        comment = true;
        return;
      }
      if (/\s*\/\//.test(line)) return;

      var match = find.match.exec(line);
      return match ? path.resolve(path.dirname(file), match[1]) : undefined;
    }).filter(function(match) {
      return match && match.length;
    });
    async.map(less, find, function(err, imports) {
      if (err) err.source = file;
      imports = Array.prototype.concat.apply([ file ], imports || []);
      return callback(err, imports);
    });
  });
}
find.match = /\s*\@import\s+\"([^\"]+)";/;

function dependencies(file, options, callback) {
  find(file, function(err, depends) {
    if (err) return callback(err);
    var res={};
    (depends||[]).forEach(function(depend) {
      res[depend]=true;
    });
    callback(undefined, Object.keys(res));
  });
}
