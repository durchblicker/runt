/*
** © 2013 by Philipp Dunkel <p.dunkel@me.com>. Licensed under MIT License.
*/

module.exports = watch;

var fs = require('fs');
var Emitter = require('events').EventEmitter;

function watch(files, callback) {
  var emitter = new Emitter();
  (files || []).map(function(file) { return JSON.parse(JSON.stringify(file)); }).forEach(function(file) {
    var watcher = fs.watch(file.path, watchListener.bind(file, emit.bind(emitter), files));
    Object.defineProperty(file, 'unwatch', { value:watcher.close.bind(watcher) });
  });
  Object.defineProperty(emitter, 'files', { get:Array.prototype.concat.bind([], files), enumerable:true });
  Object.defineProperty(emitter, 'end', { value:close.bind(emitter), enumerable:true });
  Object.defineProperty(emitter, 'events', { value:{} });
  Object.defineProperty(emitter, 'timer', { value:setInterval(doEmit.bind(emitter), 2500) });
  return callback(undefined, emitter);
}

function watchListener(emit, files, event) {
  var object = this;
  fs.stat(this.path, function(err, stat) {
    if (err || !stat) {
      stat = files.map(function(file, idx) {
        return { path:file.path, index:idx };
      }).filter(function(file) {
        return (file.path === object.path);
      }).shift();
      if (stat.index > -1) files.splice(stat.index, 1);
      object.unwatch();
      return emit('deleted', object, event);
    } else {
      object.modified = stat.mtime;
      object.created = stat.ctime;
      object.size = stat.size;
      object.isFile = stat.isFile();
      object.isDirectory = stat.isDirectory();
      object.isSpecial = (stat.isBlockDevice() || stat.isCharacterDevice() || stat.isFIFO() || stat.isSocket());
      return emit('modified', object, event);
    }
  });
}

function close() {
  this.files.forEach(function(file) {
    file.unwatch();
  });
  clearIntervall(this.timer);
  this.emit('end');
}

function emit(event, object, rawevent) {
  this.events[object.path]=[ event, object, rawevent ];
}

function doEmit() {
  var emitter = this;
  Object.keys(this.events).forEach(function(path) {
    emitter.emit.apply(emitter, emitter.events[path]);
    delete emitter.events[path];
  });
}


