#!/usr/bin/env node
/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

var Package = require('./package.json');
var Program = require('commander');
var Path = require('path');
var Util = require('util');
var Merge =require('merge').bind(null, true);
var Pea = require('pea');

var Log = require('./lib/log');
var build = require('./lib/build');
var watch = require('./lib/watch');

(function() {
  Program.version(Package.version);
  Program.description(Package.description);
  try { require('fsevents'); Program.option('-w, --watch', 'watch for changes'); } catch(ex) {}
  Program.option('-b, --build', 'build rules');
  Program.option('-c, --config [config]', 'configuration file', Path.resolve, Path.resolve('runt.json'));
  Program.option('-s, --show-config', 'show the parsed configuration');
  Program.filter = [];
  Program.command('*').action(function(command){
    Program.filter.push(command);
  });
  Program.parse(process.argv);

  var config = require(Program.config);
  config.base = Path.dirname(Program.config);
  if (Program.filter.length) config.rules = config.rules.filter(function(rule) {
    return Program.filter.indexOf(rule.name) > -1;
  });
  var log = new Log('info');
  var modules = {};
  Pea.map(config.modules, function(mod, callback) {
    callback = arguments[arguments.length-1];
    if (mod.module.indexOf('/') && (mod.module[0]!=='.')) mod.module = Path.resolve(__dirname, mod.module);
    mod.module = require(mod.module);
    modules[mod.id] = mod;
    callback();
  }).success(function() {
    config.modules = modules;
    Pea.map(config.rules, function(rule, callback) {
      callback = arguments[arguments.length-1];
      if (!config.modules[rule.module]) return callback('no such module: '+rule.module);
      rule.module = config.modules[rule.module];
      rule.base = config.base;
      rule.options = Merge(Merge({}, rule.module.options || {}), rule.options || {});
      if (!rule.module.module.options) return callback();
      rule.module.module.options(rule, callback);
    }).success(function() {
      log.info('runt started');
      if (Program.showConfig) process.stdout.write(Util.inspect(config, { depth:10 })+'\n');
      if (Program.build) build(config, log);
      if (Program.watch) watch(config, log);
    }).failure(function(err) {
      err.forEach(function(err) {
        log.error('error: '+err.message);
      });
    });
  }).failure(function(err) {
    log.error('error: '+err.message);
  });
}());
