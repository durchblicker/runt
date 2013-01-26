/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

require('./lib/options.js');
var async = require('async');
var watch = require('./lib/watchfiles.js');

require('./lib/config.js')(global.ARGV.options.config, function(err, config) {
  if (err) error(err);
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
  async.forEach(config.rules, build.bind(config, config), function(err) {
    if (err) error(err);
    console.log('Building complete');
    return callback();
  });
}

function watchAll(config, callback) {
  if (!global.ARGV.options.watch) return callback();
  async.forEach(config.rules, function(rule, callback) {
    watch(rule.files, function(err, watcher) {
      if (err) return callback(err);
      watcher.on('modified', fileModified.bind(rule, config, rule, watcher));
    });
  }, callback);
}

function fileModified(config, rule, watcher, file) {
  console.log('Building '+rule.name+' ('+file.path+')');
  build(config, rule, file, function(err) {
    if (err) return error(err);
    console.log('Building '+rule.name+' ('+file.path+') complete');
  });
}

function build(config, rule, file, callback) {
  if (('function' === typeof file) && !callback) {
    callback = file;
    file = undefined;
  }
  var module = config.modules.filter(function(module) { return module.id===rule.module; }).shift();
  if (!module) return error(new Error('Missing Module!'));
  var files = (file && !rule.aggregate) ? rule.files.filter(function(item) { return item.path===file.path; }) : rule.files;
  files = !rule.aggregate ? files.slice(0,1) : files;
  console.log('Build '+rule.name+' ('+files.length+')');
  async.forEach(files, function(file, callback) {
    try {
      module.module(rule, file, module.options, callback);
    } catch(err) {
      return callback(err);
    }
  }, function(err) {
    if (err) callback(err);
    console.log('Build '+rule.name+' complete');
    callback();
  });
}

function error(msg) {
  [].concat(arguments).forEach(function(msg) {
    console.error('ERROR:', msg);
  });
}
