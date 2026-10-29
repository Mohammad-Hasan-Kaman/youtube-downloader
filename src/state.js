'use strict';
/**
 * KamanTube - persistent app state (JSON in userData).
 * Language, download dir, and the cached working tunnel recipe.
 */
const path = require('path');
const fs = require('fs');

let file_ = null;
let data_ = null;

function userDataDir() {
  try {
    const electron = require('electron');
    if (electron && electron.app && electron.app.getPath) {
      const d = electron.app.getPath('userData');
      fs.mkdirSync(d, { recursive: true });
      return d;
    }
  } catch (_) { /* plain node (tests) */ }
  const d = path.join(require('os').homedir(), 'AppData', 'Roaming', 'KamanTube');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function file() {
  if (!file_) {
    file_ = path.join(userDataDir(), 'settings.json');
  }
  return file_;
}

function load() {
  if (data_ === null) {
    try {
      data_ = JSON.parse(fs.readFileSync(file(), 'utf8'));
    } catch (_) {
      data_ = {};
    }
  }
  return data_;
}

function save() {
  try {
    fs.writeFileSync(file(), JSON.stringify(data_, null, 2), 'utf8');
  } catch (_) { /* non-fatal */ }
}

module.exports = {
  get(key, def) {
    const d = load();
    return key in d ? d[key] : def;
  },
  set(key, value) {
    load();
    data_[key] = value;
    save();
  },
  reset() {
    data_ = {};
    try { fs.rmSync(file(), { force: true }); } catch (_) { /* ignore */ }
  },
  data: load,
  file,
};
