/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = compile;
module.exports.dependencies = dependencies;

var UglifyJS = require('uglify-js');
var Path = require('path');
var Fs = require('fs');
var Pea = require('pea');

function compile(source, target, siblings, options, callback) {
  options.sourceRoot = options.sourceRoot = Path.normalize(this.resolve(options.sourceRoot));
  resolve({}, source, function(err, modules) {
    if (err) return callback(err);

    modules = Object.keys(modules).map(function(file) { return modules[file]; }).filter(function(module) { return !!module; });
    modules = order(modules);
    modules = modules.map(assemble);

    modules.unshift({ name:'<require>', file:'<require>', uglify:requirefunc(), source:'function() { [magic] }' });
    var top = null;
    var sources = {};
    modules.forEach(function(module) {
      var name = (module.file==='<require>')?'<require>':module.file.substr((options.sourceRoot||'').length);
      sources[name] = module.source;
      top = UglifyJS.parse(module.uglify, { filename:name , toplevel: top });
    });

    top.figure_out_scope();
    top = top.transform(UglifyJS.Compressor(options.compress));
    if (options.mangle !== false) {
      top.figure_out_scope();
      top.compute_char_frequency();
      top.mangle_names();
    }
    var map = UglifyJS.SourceMap();
    var stream = UglifyJS.OutputStream({ source_map:map });

    top.print(stream);
    top = { code:stream.toString(), map:JSON.parse(map.toString()) };
    top.map.sourcesContent = top.map.sources.map(function(src) { return sources[src]; });
    top.map=JSON.stringify(top.map);

    Fs.writeFile(target, top.code+'\n\n'+'//@ sourceMappingURL='+Path.basename(target, '.js')+'.map?t='+Date.now(), function(err) {
      if (err) return callback(err);
      Fs.writeFile(Path.resolve(Path.dirname(target), Path.basename(target, '.js')+'.map'), top.map, callback);
    });
  });
}

function dependencies(source, options, callback) {
  var modules={};
  resolve(modules, source, function(err, modules) {
    if (err) return callback(err);
    callback(null, Object.keys(modules));
  });
}

function resolve(modules, source, callback) {
  callback = arguments[arguments.length-1];
  if (!!modules[source]) return callback(null, modules);
  Pea(Fs.readFile, source, 'utf-8').success(function(content) {
    var paths = [];
    content.replace(/\brequire\s*\(\s*("|')([\s|\S]+?)\1\s*\)/g, function(match, quote, name) { paths.push(name); return match; });
    Pea.map(paths, find, Path.dirname(source)).success(function(paths) {
      var module = {};
      var names = {};
      (paths||[]).forEach(function(path) {
        module[path.file] = true;
        names[path.name] = path.file;
      });
      module = { file:source, source:content, dependencies:Object.keys(module), names:names };

      modules[module.file] = module;
      paths = module.dependencies.filter(function(path) { return !modules[path.file]; });
      Pea.each(paths, resolve, modules).success(function() {
        callback(null, modules)
      }).failure(callback);
    }).failure(callback);
  }).failure(callback);
}

function find(base, name, callback) {
  callback = arguments[arguments.length-1];
  var file = (!Path.extname(name).length) ? (name + '.js') : name;
  Fs.stat(Path.resolve(base, file), function(err, stat) {
    if (err || !stat || stat.isDirectory()) {
      base = Path.dirname(base);
      if (base.length > 2) return find(base, name, callback);
      return callback(new Error('source not found: '+name));
    }
    var res = {
      name: name,
      file: Path.resolve(base, file)
    };
    return callback(null, res);
  });
}

function order(modules) {
  var result = [], cnt=100;
  while (modules.length && cnt) {
    modules = modules.filter(function(module, idx) {
      var fulfilled = !module.dependencies.filter(function(depend) {
        return !result.filter(function(module) { return module.file===depend; }).length;
      }).length;
      //console.error(cnt, module.file, fulfilled, module.dependencies, result.map(function(m) { return m.file; }));
      if (!fulfilled) return true;
      result.push(module);
      return false;
    });
    cnt-=1;
  }
  if (modules.length) throw(new Error('could not order dependencies'));
  return result;
}

function assemble(module) {
  callback=arguments[arguments.length-1];
  module.uglify = module.source.replace(/\brequire\s*\(\s*("|')([\s|\S]+?)\1\s*\)/g, function(match, quote, name) {
    return ['require(', module.names[name], ')'].join(quote);
  });
  module.uglify = [
    '(function() { var module={ exports:{}, names:["'+module.file+'"] }; (function(module, exports, alias, define, __filename, __dirname) {',
    module.uglify,
    '}(module, module.exports, function(name) { module.names.push(name); }, window.require.d, "'+module.file+'", "'+Path.dirname(module.file)+'"));for(var idx=0; idx<module.names.length; idx++) window.require.d(module.names[idx], module.exports);}())'
  ].join('');
  return module;
}

function requirefunc() {
  var lines = [
     '(function(){'
    ,'  var m={};'
    ,'  function require(n) {'
    ,'    if(n===undefined) return m;'
    ,'    if (!m[n]) { throw new Error("Missing Module: "+n); }'
    ,'    return m[n];'
    ,'  }'
    ,'  function define(n, e) {'
    ,'    m[n]=e;'
    ,'  }'
    ,'  window.require=require; window.require.d=define;'
    ,'}());'
  ];
  return lines.join('');
}
