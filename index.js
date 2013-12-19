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
var findInPath = require('find-in-path');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var dirname = path.dirname;
var exec = child_process.exec;
var exists = fs.existsSync;
var readlink = fs.readlinkSync;
var resolve = path.resolve;

var javaHome;

module.exports = findJavaHome;

function findJavaHome(cb){
  var macUtility;

  if(process.env.JAVA_HOME){
    javaHome = process.env.JAVA_HOME;
  }

  if(javaHome)return next(cb, null, javaHome);

  findInPath('javac', function(err, proposed){
    if(err)return next(cb, err, null);

    //resolve symlinks
    proposed = readlink(proposed);

    //get the /bin directory
    proposed = dirname(proposed);

    //on mac, java install has a utility script called java_home that does the
    //dirty work for us
    macUtility = resolve(proposed, 'java_home');
    if(exists(macUtility)){
      exec(macUtility, {cwd:proposed}, function(error, out, err){
        if(error || err)return next(cb, error || ""+err, null);
        javaHome = ""+out;
        next(cb, null, javaHome);
      }) ;
      return;
    }

    //check for windows last
    if(process.platform.indexOf("win") === 0){
      exec(
        'reg',
        [
          'query',
          '"hkey_local_machine\software\javasoft\java dev elopment kit"'
        ], 
        function(error, out, err){
          if(error || err)return next(cb, error || ""+err, null);

        });
      return;
    }

    //up one from /bin
    javaHome = dirname(proposed);

    next(cb, null, javaHome);
  });
}

function next(){
  var args = [].slice.apply(arguments);
  var cb = args.shift();
  process.nextTick(function(){cb.apply(null, args);});
}