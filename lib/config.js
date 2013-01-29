/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = configure;
var path = require('path');
var findFiles = require('./findfiles.js');
var async = require('async');
var glob=require('glob');

function configure(conffile, callback) {
  require('fs').readFile(conffile, 'utf-8', function(err, cfg) {
    console.log('Loading Configuration: '+conffile);
    if (err) return callback(err);
    cfg = JSON.parse(cfg);
    cfg.path = path.resolve(path.dirname(conffile));

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
      rule.source = (Array.isArray(rule.source) ? rule.source : [ rule.source ]).map(function(file) { return String(file); });
      var sources = [];
      async.map(rule.source, glob, function(err, sources) {
        if (err) return callback(err);
        sources=Array.prototype.concat.apply([], sources);
        async.map(sources, findFiles.stat, function(err, sources) {
          if (err) return callback(err);
          sources = sources.filter(function(file) { return file.isFile; });
          async.map(sources, function(source, callback) {
            if ('function' !== typeof cfg.moduleIndex[rule.module].module.dependencies) return callback(undefined, source);
            cfg.moduleIndex[rule.module].module.dependencies(source.path, function(err, dependencies) {
              if (err) return callback(err);
              async.map(dependencies, findFiles.stat, function(err, dependencies) {
                if (err) return callback(err);
                source.dependencies=dependencies.filter(function(file) { return file.isFile; });
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
