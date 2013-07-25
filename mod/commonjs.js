/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

exports.individual=individual;
exports.dependencies=dependencies;
exports.options=options;

var Pea = require('pea');
var Path = require('path');
var Fs = require('fs');
var UglifyJS = require('uglify-js');

var REQUIRE=/\brequire\s*\(\s*(["|'])(\S+?)\1\s*\)/g;
var DEBUG = function(){};

function individual(source, target, options, callback) {
  DEBUG('indiviual', source, target);
  var modules = {};
  Pea(load, source, modules).next(Pea(order, modules)).done(function(modules) {
    DEBUG('load-order-done', source);
    Pea(compile, modules, options).next(Pea(link, modules, options)).done(function(assembly) {
      Pea.Soup.stir([
        Pea(Fs.writeFile, target, assembly.code+'\n\n//@ sourceMappingURL='+Path.basename(target, '.js')+'.map?t='+Date.now()),
        Pea(Fs.writeFile, Path.join(Path.dirname(target), Path.basename(target, '.js')+'.map'), assembly.map)
      ]).then(callback);
    }).error(callback)
  }).error(callback);
}

function dependencies(files, callback) {
  Pea.map(files, load, {}).done(function(modules) {
    modules = modules.shift();
    var list = Object.keys(modules);
    var index = {};
    list.forEach(function(file) {
      var module = modules[file];
      index[file] = index[file] || [];
      index[file].push(file);
      values(module.required).forEach(function(dep) {
        index[dep] = index[dep] || [];
        index[dep].push(file);
      });
    });
    callback(null, list, index);
  }).fail(callback)
}

function options(rule, callback) {
  rule.options.sourceRoot = Path.normalize(Path.resolve(rule.base, rule.options.sourceRoot)+'/');
  callback();
}

function load(file, modules, callback) {
  DEBUG('load', file);
  if (modules[file]) return callback(null, modules);
  Pea(Fs.readFile, file, 'utf-8').done(function(content) {
    DEBUG('load-read', file);
    Pea(parse, file, content, modules).then(callback);
  }).fail(callback);
}

function parse(file, content, modules, callback) {
  DEBUG('parse', file);
  var required = {};
  modules[file] = {
    file:file,
    content:content,
    required:required
  };
  content.replace(REQUIRE, function(match, quote, name) { required[name] = true });
  Pea.map(Object.keys(required), findrequire, Path.dirname(file), modules).done(function(resolved) {
    DEBUG('parse-resolved', file);
    resolved.forEach(function(module) { required[module.name] = module.path; });
    Pea.map(values(required), load, modules).done(function() {
      DEBUG('parse-loaded', file);
      callback(null, modules);
    }).fail(callback);
  }).fail(callback);
}

function findrequire(name, base, modules, callback) {
  base = base.split('/');
  var file = (!Path.extname(name).length) ? (name + '.js') : name;
  var options = [];
  while(base.length)  {
    options.push(Path.normalize(base.concat(file).join('/')));
    base.pop();
  }
  Pea.first(options, stat).done(function(stat) {
    if (modules[stat.path]) return callback(null, { name:name, path:stat.path });
    Pea(load, stat.path, modules).done(function(modules) {
      callback(null, { name:name, path:stat.path });
    }).fail(callback);
  }).fail(function(err) {
    callback(new Error('could not find require("'+name+'")'));
  });
}

function stat(path, callback) {
  Fs.stat(path, function(err, stat) {
    if (err || !stat) return callback(err || new Error('no stat'));
    stat.path = path;
    callback(null, stat);
  });
}

function unique(array) {
  var result = {};
  array.forEach(function(key) { result[key]=true; });
  return Object.keys(result);
}

function values(object) {
  return Object.keys(object).map(function(key) {
    return object[key];
  });
}

function order(modules, callback) {
  mods = values(modules);
  var result=[];
  var rounds = 100;
  while (mods.length && rounds) {
    mods = mods.filter(function(module) {
      if (!fulfilled(result, values(module.required))) return true;
      result.push(module.file);
      return false;
    });
    rounds -= 1;
  }
  if (mods.length) return callback(new Error('could not order dependencies'));
  result = result.map(function(file) { return modules[file]; });
  callback(null, result);
}
function fulfilled(list, dependencies) {
  var notfound = dependencies.filter(function(item) {
    return (list.indexOf(item) === -1);
  });
  return !notfound.length;
}

function compile(modules, options, callback) {
  var prefix=(modules.length).toString(16).split('').map(function(c) { return '0' }).join('');
  var index = {};
  modules.forEach(function(module, idx) {
    module.id=(prefix+(idx+1).toString(16)).slice(-1 * prefix.length);
    index[module.file] = module.id;
    if (options.sourceRoot && (module.file.indexOf(options.sourceRoot)===0)) {
      module.file = module.file.substr(options.sourceRoot.length);
    }
  });
  modules.forEach(function(module) {
    module.source = [
      '(function() { var module={ exports:{}, names:["('+module.id+')"] }; (function(module, exports, alias, define) {',
      module.content.replace(REQUIRE, function(match, quote, name) {
        return ['require(', '('+index[module.required[name]]+')', ')'].join(quote);
      }),
      '}(module, module.exports, function(name) { module.names.push(name); }, window.require.d));for(var idx=0; idx<module.names.length; idx++) window.require.d(module.names[idx], module.exports);}())'
    ].join('');
  });
  callback(null, modules);
}

function link(modules, options, callback) {
  modules.unshift({
    id: (modules.length).toString(16).split('').map(function(c) { return '0' }).join(''),
    file: '<commonjs>',
    content:[
       '(function(){'
      ,'  if (window.require && window.require.d) return;'
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
    ].join('')
  });
  var top = null;
  var sources = {};
  try {
    modules.forEach(function(module) {
      sources[module.file] = module.content;
      top = UglifyJS.parse(module.source || module.content, { filename:module.file , toplevel: top });
    });
  } catch(err) {
    return callback(err);
  }
  if (!top) return callback(new Error('Compile Error'));
  top.figure_out_scope();
  if (options.compress !== false) {
    options.compress = options.compress || {};
    options.compress.warnings=false;
    top = top.transform(UglifyJS.Compressor(options.compress));
  }
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
  callback(null, top);
}
