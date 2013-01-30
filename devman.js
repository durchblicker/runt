#!/usr/bin/env node

/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

require('./lib/options.js');
var async = require('async');
var watch = require('./lib/watchfiles.js');

require('./lib/config.js')(global.ARGV.options.config, loadModule, function(err, config) {
  if (err) return error(err);
  if (global.ARGV.options['show-config']) console.log(JSON.stringify(config, undefined, '  '));
  buildAll(config, function() {
    watchAll(config, function() {
      console.log(global.PACKAGE.copyright);
    });
  });
});

function buildAll(config, callback) {
  if (!global.ARGV.options.build) return callback();
  console.log('Building');
  async.forEach(config.rules, function(rule, callback) {
    async.forEach(('string' === typeof rule.target)?rule.source.slice(0,1):rule.source, function(source, callback) {
      var target;
      switch(typeof rule.target) {
        case 'object':
          if (rule.target.search && rule.target.replace) {
            target=source.path.replace(new RegExp(rule.target.search), rule.target.replace);
            break;
          }
        default:
          target=String(rule.target);
      }

      config.moduleIndex[rule.module].module.call(rule, source, target, mergeOpts(config.moduleIndex[rule.module].options, rule.options), function(err) {
        if (err) {
          status(rule.name+' ('+status.file(target)+')', false);
          error(err);
          return callback(err);
        }
        status(rule.name+' ('+status.file(target)+')', true);
        return callback(err);
      });
    }, callback);
  }, function(err) {
    if (err) error(err);
    status('Building', err?false:true);
    return callback(err);
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

function watchAll(config, callback) {
  if (!global.ARGV.options.watch) return callback();
  console.log('Watching Sources');
  async.forEach(config.rules, function(rule, callback) {
    async.forEach(rule.source, function(source, callback) {
      watch(source.dependencies || [ source ], function(err, watcher) {
        if (err) return callback(err);
        watcher.on('modified', fileModified.bind(rule, config, rule, source, watcher));
      });
    }, callback);
  }, callback);
}

function fileModified(config, rule, source, watcher, file) {
  console.log('Modified '+rule.name+' ('+file.path+')');
  var target;
  switch(typeof rule.target) {
    case 'object':
      if (rule.target.search && rule.target.replace) {
        target=source.path.replace(new RegExp(rule.target.search), rule.target.replace);
        break;
      }
    default:
      target=String(rule.target);
  }
  config.moduleIndex[rule.module].module.call(rule, source, target, mergeOpts(config.moduleIndex[rule.module].options, rule.options), function(err) {
    if (err) {
      status(rule.name+' ('+status.file(target)+')',false);
      return error(err);
    }
    status(rule.name+' ('+status.file(target)+')',true);
  });
}

function error(msg) {
  [].concat(arguments).forEach(function(msg) {
    console.error('ERROR:', msg);
  });
}

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

function loadModule(mod) {
  try {
    return require(mod);
  } catch(ex) {
    return require('./'+mod);
  }
}
