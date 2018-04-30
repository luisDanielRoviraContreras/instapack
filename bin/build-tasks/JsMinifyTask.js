"use strict";
const UglifyJS = require("uglify-js");
const PrettyUnits_1 = require("../PrettyUnits");
const chalk_1 = require("chalk");
const Shout_1 = require("../Shout");
module.exports = function jsMinifyTask(input) {
    return new Promise((ok, reject) => {
        let fileName = Object.keys(input.payload)[0];
        let fileBytes = Buffer.byteLength(input.payload[fileName], 'utf8');
        let fileSize = '(' + PrettyUnits_1.prettyBytes(fileBytes) + ')';
        Shout_1.Shout.timed(`Minifying ${chalk_1.default.blue(fileName)}... ${chalk_1.default.grey(fileSize)}`);
        let result = UglifyJS.minify(input.payload, input.options);
        if (result.error) {
            reject(result.error);
        }
        else {
            ok(result);
        }
    });
};
