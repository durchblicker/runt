/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = configure;
var path = require('path');
var findFiles = require('./findfiles.js');
var async = require('async');

function configure(conffile, callback) {
  require('fs').readFile(conffile, 'utf-8', function(err, cfg) {
    if (err) return callback(err);
    cfg = JSON.parse(cfg);
    cfg.path = path.resolve(path.dirname(conffile));

    try {
      cfg.modules = (cfg.modules || []).map(function(module) {
        if (!module.id) throw (new Error('Bad Module-Definition: missing id'));
        if (!module.module) throw(new Error('Bad Module-Definition: missing module'));
        try {
          module.module = require(module.module);
        } catch(err) {
          throw(new Error('Bad Module-Definition: '+module.module+' cannot be loaded.'+err.message));
        }
        return module;
      });
    } catch(ex) {
      return callback(ex);
    }

    cfg.rules = (cfg.rules || []).map(function(rule) {
      if (!rule.files) error('Bad Rule-Definition: missing files');
      if (!rule.module) error('Bad Rule-Definition: missing module');
      if (!cfg.modules.filter(function(module) { return module.id===rule.module; }).length) error('Bad Rule-Definition: '+rule.module+' not found');
      return rule;
    });

    if (global.ARGV.targets.length) {
      cfg.rules = cfg.rules.filter(function(rule) {
        return (global.ARGV.targets.indexOf(rule.name) > -1);
      });
    }

    async.map(cfg.rules, function(rule, callback) {
      if (Array.isArray(rule.files)) {
        rule.files = rule.files.map(function(file) { return String(file); });
        async.map(rule.files, findFiles.stat, function(err, files) {
          if (err) return callback(err);
          rule.files = rule.allowDirectories ? files : files.filter(function(file) { return file.isFile; });
          return callback(undefined, rule);
        });
      } else {
        findFiles(cfg.path, rule.files, function(err, files) {
          if (err) return callback(err);
          rule.files = rule.allowDirectories ? files : files.filter(function(file) { return file.isFile; });
          return callback(undefined, rule);
        });
      }
    }, function(err, rules) {
      if (err) return callback(err);
      cfg.rules = rules;
      return callback(undefined, cfg);
    });
  });
}
