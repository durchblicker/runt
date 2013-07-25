/*
** © 2013 by YOUSURE Tarifvergleich GmbH. All rights reserved.
*/

module.exports = watch;

var Pea=require('pea');
var Path = require('path');
var Glob = require('glob');
var Minimatch = require('minimatch');

function watch(config, log) {
  var fsevents;
  try {
    fsevents = require('fsevents');
  } catch(ex) {
    log.error('watching is only supported on Mac OS-X');
    return;
  }

  log.info('watching: '+config.base);
  var findsrc = Pea.map(config.rules, findsources.bind(log));
  var finddep = Pea.map(config.rules, dependencies.bind(log));
  var start = Pea(function(callback) {
    global.fsevents = fsevents(config.base);
    global.fsevents.on('change', function(path, info) {
      config.rules.forEach(function(rule) {
        if ((info.event === 'created') || (info.event === 'moved-in')) {
          if ('string' !== typeof rule.source) return;
          if (!Minimatch(path, rule.source)) return;
          Pea(findsources.bind(log), rule).success(function() {
            Pea(dependencies.bind(log), rule).success(function() {
              buildAll(log, path, rule);
            });
          });
          return;
        }

        if (rule.dependent.indexOf(path) < 0) return;
        if ((info.event === 'deleted') || (info.event === 'moved-out')) {
          Pea(findsources.bind(log), rule).success(function() {
            Pea(dependencies.bind(log), rule).success(function() {
              buildAll(log, path, rule);
            });
          });
        } else {
          if (rule.dependidx) {
            buildAny(log, path, rule.dependidx[path], rule);
          } else if(rule.resolved.indexOf(path) < 0) {
            buildAll(log, path, rule);
          } else {
            buildOne(log, path, rule);
          }
        }
      });
    });
    callback();
  });
  findsrc.next(finddep).next(start).success(function() {
    log.info('watcher setup complete');
  }).error(function(err) {
    if (!err) return;
    log.error(err.message);
  });
}

function findsources(rule, callback) {
  callback = arguments[arguments.length - 1];
  var log = this;

  if ('string' === typeof rule.source) {
    log.info('finding sources for: '+rule.name);
    Pea(Glob, rule.source, { cwd:rule.base }).success(function(sources) {
      rule.resolved = sources.map(function(path) { return Path.resolve(rule.base, path); });
      log.info('found '+sources.length+' sources for: '+rule.name);
      callback();
    }).failure(callback);
  } else {
    rule.resolved = [].concat(Array.isArray(rule.source) ? rule.source : [ rule.source ]).map(function(path) { return Path.resolve(rule.base, path); });
    callback();
  }
}

function dependencies(rule, callback) {
  callback = arguments[arguments.length - 1];
  var log = this;
  rule.dependent = [].concat(rule.resolved);
  if (!rule.module.module.dependencies) return callback();
  log.info('finding dependencies for: '+rule.name);

  Pea(rule.module.module.dependencies, rule.resolved).success(function(depend, dependidx) {
    rule.dependent = depend.map(function(path) { return Path.resolve(rule.base, path); });
    rule.dependidx = dependidx;
    log.info('found '+depend.length+' dependents for: '+rule.name);
    if (rule.dependidx) log.info('found depend-index for: '+Object.keys(rule.dependidx).length+' files');
    callback();
  }).failure(callback);
}

function buildAll(log, delta, rule) {
  log.info('delta: '+delta);
  buildRule(log, rule.module.module, rule.resolved, rule.target, rule.options, function(err, target) {
    if (err) return log.error('error: '+err.message);
    log.info('done: '+delta);
  });
}

function buildOne(log, delta, rule, callback) {
  if (('string' === typeof rule.target) && (rule.resolved.length > 1)) {
    return buildAll(log, delta, rule);
  }
  log.info('delta: '+delta);
  if (!rule.module.module.individual) {
    return log.error(rule.module.id+' can only aggregate');
  }
  var dest;
  if ('string' === typeof rule.target) {
    dest = rule.target;
  } else if (('object' === typeof rule.target) && (rule.target !== null) && (rule.target.search) && (rule.target.replace)) {
    dest = delta.replace(new RegExp(rule.target.search), rule.target.replace);
  } else {
    return log.error('invalid target');
  }
  rule.module.module.individual(delta, dest, rule.options, function(err) {
    if (err) {
      log.info('error: '+err.message);
    } else {
      log.info('built: '+dest);
    }
    log.info('done: '+delta);
    if ('function' === typeof callback) callback();
  });
}

function buildAny(log, delta, sources, rule) {
  log.info('delta: '+delta);
  sources = sources.filter(function(file) {
    return rule.resolved.indexOf(file) > -1;
  });
  Pea.map(sources, function(delta, callback) {
    buildOne(log, delta, rule, callback);
  }).success(function() {
    log.info('done: '+delta);
  });
}

function buildRule(log, module, sources, target, options, callback) {
  if ('string' === typeof target) {
    if (sources.length > 1) {
      if (!module.aggregate) return callback(new Error(module.id+' cannot aggregate ('+sources.length+')'));
      module.aggregate(sources, target, options, done(target, callback));
    } else {
      if (!module.individual) return callback(new Error(module.id+' can only aggregate ('+sources.length+')'));
      module.individual(sources[0], target, options, done(target, callback));
    }
  } else if (('object' === typeof target) && (target !== null) && (target.search) && (target.replace)) {
    if (!module.individual) return callback(new Error(module.id+' can only aggregate'));
    Pea.map(sources, function doit(file, callback) {
      var dest = file.replace(new RegExp(target.search), target.replace);
      module.individual(file, dest, options, done(dest, callback));
    }).success(function() {
      callback(null);
    }).failure(callback);
  } else {
    callback(new Error('bad target '+target));
  }

  function done(target, callback) {
    return function(err) {
      if (!err) {
        log.info('built: '+target);
      } else {
        log.error('error: '+err.message);
      }
      callback(err);
    };
  }
}

