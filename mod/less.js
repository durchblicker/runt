/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

exports.individual = individual;
exports.dependencies = dependencies;

var Parser = require('less').Parser;
var Fs = require('fs');
var Path = require('path');
var Pea = require('pea');

function individual(source, target, options, callback) {
  var parser = new Parser({
    paths: [Path.dirname(source)],
    filename: source
  });
  Fs.readFile(source, 'utf-8', function(err, less) {
    parser.parse(less, function(err, tree) {
      if(err) return callback(err);
      try {
        tree = tree.toCSS(options);
      } catch(ex) {
        return callback(ex);
      }
      Fs.writeFile(target, tree, callback);
    });
  });
}

function extract(file, callback) {
  callback = arguments[arguments.length-1];
  var base = Path.dirname(file);
  var load = Pea(Fs.readFile, file, 'utf-8');
  var analyze = Pea(function(callback) {
    var cnt = this.previousValue;
    var imports = [];
    cnt = cnt.replace(/\/\*[\S|\s]*?\*\//g,'\n');
    cnt.split(/\r?\n/).forEach(function(line) {
      line = line.trim();
      line.replace(/\s*\@import\s+"(\S+?)"\s*;/g, function(match, child) {
        child = Path.resolve(base, child);
        imports.push(child);
      });
    });
    if (!imports.length) callback(null, [file]);
    Pea.map(imports, extract).success(function(dependencies) {
      callback(null, Array.prototype.concat.apply([ file ], dependencies));
    }).failure(callback);
  });
  load.next(analyze).then(callback).error(callback);
}

function dependencies(templates, callback) {
  Pea.map(templates, extract).success(function(result) {
    var files = {};
    result = Array.prototype.concat.apply([], result).forEach(function(file) {
      if (!(('string' === typeof file) && file.length)) return;
      files[file] = true;
    });
    callback(null, Object.keys(files).sort());
  }).failure(callback);
}
