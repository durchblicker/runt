/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = configure;
var path = require('path');
var findFiles = require('./findfiles.js');
var async = require('async');
var glob=require('glob');

function configure(conffile, require, callback) {
  require('fs').readFile(conffile, 'utf-8', function(err, cfg) {
    console.log('Loading Configuration: '+conffile);
    if (err) return callback(err);
    cfg = JSON.parse(cfg);
    cfg.path = path.resolve(path.dirname(conffile))+'/';

    try {
      cfg.moduleIndex = {};
      cfg.modules = (cfg.modules || []).map(function(module) {
        if (!module.id) throw (new Error('Bad Module-Definition: missing id'));
        if (!module.module) throw(new Error('Bad Module-Definition: missing module'));
        try {
          module.module = require(module.module);
        } catch(err) {
          throw(new Error('Bad Module-Definition: '+module.module+' cannot be loaded.'+err.message));
        }
        cfg.moduleIndex[module.id]=module;
        return module;
      });
    } catch(ex) {
      return callback(ex);
    }

    try {
      cfg.rules = cfg.rules || [];
      cfg.rules.forEach(function(rule) {
        if (!rule.name) throw(new Error('Bad Rule-Definition: missing name'));
        if (!rule.module) throw(new Error('Bad Rule-Definition: missing module'));
        if (!rule.source) throw(new Error('Bad Rule-Definition: missing source'));
        if (!rule.target) throw(new Error('Bad Rule-Definition: missing target'));
        if (!cfg.modules.filter(function(module) {
          return module.id===rule.module;
        }).length) throw(new Error('Bad Rule-Definition: '+rule.module+' not found'));
        return rule;
      });
    } catch(err) {
      return callback(err);
    }

    if (global.ARGV.targets.length) {
      cfg.rules = cfg.rules.filter(function(rule) {
        return (global.ARGV.targets.indexOf(rule.name) > -1);
      });
    }

    async.map(cfg.rules, function(rule, callback) {
      Object.defineProperty(rule, 'resolve', { value:path.resolve.bind(path, cfg.path) });
      rule.source = (Array.isArray(rule.source) ? rule.source : [ rule.source ]).map(function(file) { return path.resolve(cfg.path, file); });
      async.map(rule.source, glob, function(err, sources) {
        if (err) return callback(err);
        sources.forEach(function(source) { source.sort(); });
        sources=Array.prototype.concat.apply([], sources);
        var target;
        switch(typeof rule.target) {
          case 'object':
            if (rule.target.search && rule.target.replace) break;
          default:
            target=path.resolve(cfg.path,String(rule.target));
        }
        async.map(sources, findFiles.stat, function(err, sources) {
          if (err) return callback(err);

          sources = sources.filter(function(file) { return file.isFile && (('object' === typeof target) || (target != file.path)); });
          async.map(sources, function(source, callback) {
            if ('function' !== typeof cfg.moduleIndex[rule.module].module.dependencies) return callback(undefined, source);
            var options=mergeOpts(cfg.moduleIndex[rule.module].options, rule.options);
            cfg.moduleIndex[rule.module].module.dependencies.call(rule, source, options, function(err, dependencies) {
              if (err) {
                status('Dependecies: '+status.file(source.path),false);
                return callback(err);
              }
              async.map(dependencies, findFiles.stat, function(err, dependencies) {
                if (err) {
                  status('Dependecies: '+status.file(source.path),false);
                  if (err.source) console.error('    '+err.source);
                  return callback(err);
                }
                source.dependencies=dependencies.filter(function(file) { return file.isFile; });
                //status('Dependecies(): '+status.file(source.path),true);
                callback(undefined, source);
              });
            });
          }, function(err, sources) {
            if (err) return callback(err);
            rule.source = sources;
            return callback(undefined, rule);
          });
        });
      });
    }, function(err, rules) {
      if (err) return callback(err, cfg);
      cfg.rules = rules;
      callback(undefined, cfg);
    });
  });
}

function status(text, success) {
  text=String(text);
  while(text.length < (100 - 12)) text+=' ';
  text += '[ '+(success?'DONE':'FAIL')+' ]';
  console.log(text);
}
status.file = function(file) {
  var max=68;
  return (file.length > max)?('…'+file.substr(-1*(max-1))):file;
};
function mergeOpts(def, cst) {
  def = def || {};
  cst = cst || {};
  var res = {};
  Object.keys(def).forEach(function(key) {
    switch(typeof def[key]) {
      case 'object':
        res[key] = mergeOpts({}, def[key]);
        break;
      default:
        res[key] = def[key];
    }
  });
  Object.keys(cst).forEach(function(key) {
    switch(typeof cst[key]) {
      case 'object':
        res[key] = mergeOpts(res[key], cst[key]);
        break;
      default:
        res[key] = cst[key];
    }
  });
  return res;
}
