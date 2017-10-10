/*
  Copyright 2017 Google Inc.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const assert = require('assert');
const path = require('path');

const errors = require('./errors');
const filterFiles = require('./filter-files');
const getCompositeDetails = require('./get-composite-details');
const getFileDetails = require('./get-file-details');
const getStringDetails = require('./get-string-details');

/**
 * @typedef {Object} ManifestEntry
 * @property {String} url The URL to the asset in the manifest.
 * @property {String} revision The revision details for the file. This is a
 * hash generated by node based on the file contents.
 *
 * @memberof module:workbox-build
 */

module.exports = async ({
  dontCacheBustUrlsMatching,
  globDirectory,
  globIgnores,
  globPatterns,
  manifestTransforms,
  maximumFileSizeToCacheInBytes,
  modifyUrlPrefix,
  swDest,
  templatedUrls,
}) => {
  // Initialize to an empty array so that we can still pass something to
  // filterFiles() and get a normalized output.
  let fileDetails = [];
  const fileSet = new Set();

  if (globDirectory) {
    if (swDest) {
      // Ensure that we ignore the SW file we're eventually writing to disk.
      globIgnores.push(`**/${path.basename(swDest)}`);
    }

    fileDetails = globPatterns.reduce((accumulated, globPattern) => {
      const globbedFileDetails = getFileDetails({
        globDirectory,
        globPattern,
        globIgnores,
      });

      globbedFileDetails.forEach((fileDetails) => {
        if (fileSet.has(fileDetails.file)) {
          return;
        }

        fileSet.add(fileDetails.file);
        accumulated.push(fileDetails);
      });
      return accumulated;
    }, []);
  }

  if (templatedUrls) {
    for (let url of Object.keys(templatedUrls)) {
      assert(!fileSet.has(url), errors['templated-url-matches-glob']);

      const dependencies = templatedUrls[url];
      if (Array.isArray(dependencies)) {
        const details = dependencies.reduce((previous, globPattern) => {
          try {
            const globbedFileDetails = getFileDetails({
              globDirectory,
              globPattern,
              globIgnores,
            });
            return previous.concat(globbedFileDetails);
          } catch (error) {
            const debugObj = {};
            debugObj[url] = dependencies;
            throw new Error(`${errors['bad-template-urls-asset']} ` +
              `'${globPattern}' from '${JSON.stringify(debugObj)}':\n` +
              error);
          }
        }, []);
        fileDetails.push(getCompositeDetails(url, details));
      } else if (typeof dependencies === 'string') {
        fileDetails.push(getStringDetails(url, dependencies));
      }
    }
  }

  return filterFiles({fileDetails, maximumFileSizeToCacheInBytes,
    modifyUrlPrefix, dontCacheBustUrlsMatching, manifestTransforms});
};
