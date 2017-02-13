/* Copyright 2013 Joseph Spencer.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var which = require('which');
var fs = require('fs');
var path = require('path');
var dirname = path.dirname;
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var exists = fs.existsSync;
var stat = fs.statSync;
var readlink = fs.readlinkSync;
var resolve = path.resolve;
var lstat = fs.lstatSync;
var javaHome;

module.exports = findJavaHome;

var isWindows = process.platform.indexOf('win') === 0;
var JAVAC_FILENAME = 'javac' + (isWindows ? '.exe' : '');
var REG_CMD = 'REG';
var REG_TYPE_PATTERN = /(REG_SZ|REG_MULTI_SZ|REG_EXPAND_SZ|REG_DWORD|REG_QWORD|REG_BINARY|REG_NONE)/

function findJavaHome(options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = null;
    }
    options = options || {
        allowJre: false
    };
    var macUtility;
    var possibleKeyPaths;

    if (process.env.JAVA_HOME && dirIsJavaHome(process.env.JAVA_HOME)) {
        javaHome = process.env.JAVA_HOME;
    }

    if (javaHome) return next(cb, null, javaHome);

    //windows
    if (process.platform.indexOf('win') === 0) {
        //java_home can be in many places
        //JDK paths
        possibleKeyPaths = [
            'HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit'
        ];
        //JRE paths
        if (options.allowJre) {
            possibleKeyPaths = possibleKeyPaths.concat([
                'HKLM\\SOFTWARE\\JavaSoft\\Java Runtime Environment',
            ]);
        }

        javaHome = findInRegistry(possibleKeyPaths);
        if (javaHome) return next(cb, null, javaHome);
    }

    which(JAVAC_FILENAME, function(err, proposed) {
        if (err) return next(cb, err, null);

        //resolve symlinks
        proposed = findLinkedFile(proposed);

        //get the /bin directory
        proposed = dirname(proposed);

        //on mac, java install has a utility script called java_home that does the
        //dirty work for us
        macUtility = resolve(proposed, 'java_home');
        if (exists(macUtility)) {
            exec(macUtility, {
                cwd: proposed
            }, function(error, out, err) {
                if (error || err) return next(cb, error || '' + err, null);
                javaHome = '' + out.replace(/\n$/, '');
                next(cb, null, javaHome);
            });
            return;
        }

        //up one from /bin
        javaHome = dirname(proposed);

        next(cb, null, javaHome);
    });
}

function findInRegistry(paths) {
    if (!paths.length) return null;

    var done = false;
    var currVer;

    for (var i in paths) {
        var key = paths[i];
        var cv = getRegValueByName(key, 'CurrentVersion');
        var registryJavaHome = getRegValueByName(key + '\\' + cv, 'JavaHome');


        if (registryJavaHome) break;
    }

    return registryJavaHome;
}

// iterate through symbolic links until
// file is found
function findLinkedFile(file) {
    if (!lstat(file).isSymbolicLink()) return file;
    return findLinkedFile(readlink(file));
}

function next(cb, err, home) {
    return cb(err, home);
}

function dirIsJavaHome(dir) {
    return exists('' + dir) && stat(dir).isDirectory() && exists(path.resolve(dir, 'bin', JAVAC_FILENAME));
}

function after(count, cb) {
    return function() {
        if (count <= 1) return process.nextTick(cb);
        --count;
    };
}

function getRegValueByName(path, name) {
    var cmd = [REG_CMD, 'QUERY', '"' + path + '"', '/v', name].join(' ');

    try {
        var result = execSync(cmd, {
            cwd: undefined,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        return result.toString().split(REG_TYPE_PATTERN).pop().trim();
    } catch (e) {
        return null;
    }
}
