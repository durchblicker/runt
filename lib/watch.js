/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = watch;

var fs = require('fs');
var path = require('path');
var async = require('async');
var Emitter = require('events').EventEmitter;

var nextTick = ('function' === typeof setImmediate) ? setImmediate : process.nextTick;
var tasks;

function start() {
  if(tasks) return tasks;
  nextTick(function() {
    async.whilst(function() {
      if(!tasks.length) tasks = undefined;
      return tasks ? true : false;
    }, function(callback) {
      var task = tasks.shift();
      execute(task, callback);
    }, function(err) {
      tasks = undefined;
    });
  });
  tasks = [];
  return tasks;
}

function schedule(task) {
  tasks = start();
  tasks.push(task);
}

function execute(task, callback) {
  fs.stat(task.file, function(err, stat) {
    if(err && task.stat) return task.emitter.emit('error', err);
    if(err) return task.emitter.emit('delete', task.file);
    if(task.stat && (task.stat.mtime.getTime() !== stat.mtime.getTime())) task.emitter.emit('change', task.file, stat);
    task.stat = stat;
    setTimeout(function() {
      schedule(task);
    }, task.interval);
    callback();
  });
}

function watch(files, interval) {
  var emitter = new Emitter();
  files.forEach(function(file) {
    schedule({
      file: file,
      emitter: emitter,
      interval: interval || 1000
    });
  });
  return emitter;
}
