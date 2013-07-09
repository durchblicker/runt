/*
** © 2013 by YOUSURE Tarifvergleich GmbH. All rights reserved.
*/

module.exports = build;

var Pea = require('pea');
var Glob = require('glob');
var Path = require('path');

function build(config, log) {
  log.info('building');
  Pea.map(config.rules, function(rule, callback) {
    callback=arguments[arguments.length-1];
    log.info('building '+rule.name);
    if (!Array.isArray(rule.source)) {
      Pea(Glob, rule.source, { cwd:config.base }).success(function(sources) {
        sources = sources.map(function(path) { return Path.resolve(config.base, path); });
        buildRule(log, rule.module.module, sources, rule.target, rule.options, callback);
      }).failure(callback);
    } else {
      var sources = rule.source.map(function(source) {
        return Path.resolve(rule.base, source);
      });
      buildRule(log, rule.module.module, sources, rule.target, rule.options, callback);
    }
  }).success(function() {
    log.info('building complete');
  }).failure(function(err) {
    if (!err) return;
    log.error('Error: '+(err.message || err));
    log.info('building failed');
  });
}

function buildRule(log, module, sources, target, options, callback) {
  if ('string' === typeof target) {
    if (sources.length > 1) {
      if (!module.aggregate) return callback(new Error(module.id+' cannot aggregate ('+sources.length+')'));
      module.aggregate(sources, target, options, callback);
    } else {
      if (!module.individual) return callback(new Error(module.id+' can only aggregate ('+sources.length+')'));
      module.individual(sources[0], target, options, callback);
    }
  } else if (('object' === typeof target) && (target !== null) && (target.search) && (target.replace)) {
    if (!module.individual) {
      console.error(module);
      return callback(new Error(module.id+' can only aggregate'));
    }
    Pea.map(sources, function(source, callback) {
      callback = arguments[arguments.length - 1];
      var dest = source.replace(new RegExp(target.search), target.replace);
      log.info('build: '+source);
      module.individual(source, dest, options, function(err) {
        if (err) return callback(err);
        log.info('done:  '+dest);
        callback();
      });
    }).then(callback);
  }
}
