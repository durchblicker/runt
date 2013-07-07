/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT-License
*/

exports.individual = individual;
exports.dependencies = dependencies;

var Parser = require('less').Parser;
var Fs = require('fs');
var Path = require('path');

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
        return callback(err);
      }
      Fs.writeFile(target, tree, callback);
    });
  });
}

function extract(file, callback) {
  callback = arguments[arguments.length-1];
  var base = Path.dirname(file);
  var imports = [];
  Pea(Fs.readFile, file, 'utf-8').success(function(cnt) {
    cnt = cnt.replace(/\/\*[\S|\s]*?\*\//,g,'\n');
    cnt.split(/\r?\n/).forEach(function(line) {
      line = line.trim().replace(/\/\/.*$/,'');
      (/\s*\@import\s+\"([^\"]+)";/).exec(line, function(match, child) {
        imports.push(Path.resolve(base, child));
      });
    });
  }).failure(callback);
  if (!imports.length) {
    Pea.map(imports, extract).success(function(children) {
      callback(null, Array.prototype.concat.apply(imports, children));
    }).failure(callback);
  } else {
    callback(null, imports);
  }
}

function dependencies(file, options, callback) {
  find(file, function(err, depends) {
    if(err) return callback(err);
    var res = {};
    (depends || []).forEach(function(depend) {
      res[depend] = true;
    });
    callback(undefined, Object.keys(res));
  });
}
