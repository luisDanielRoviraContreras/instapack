"use strict";
const UglifyJS = require("uglify-js");
const PrettyUnits_1 = require("../PrettyUnits");
const chalk_1 = require("chalk");
const Shout_1 = require("../Shout");
module.exports = function jsMinifyTask(input) {
    return new Promise((ok, reject) => {
        let fileBytes = Buffer.byteLength(input.code, 'utf8');
        let fileSize = '(' + PrettyUnits_1.prettyBytes(fileBytes) + ')';
        Shout_1.Shout.timed(`Minifying ${chalk_1.default.blue(input.fileName)}... ${chalk_1.default.grey(fileSize)}`);
        let option;
        if (input.map) {
            option = {
                sourceMap: {
                    content: input.map
                }
            };
        }
        let result = UglifyJS.minify({
            [input.fileName]: input.code
        }, option);
        if (result.error) {
            reject(result.error);
        }
        else {
            ok(result);
        }
    });
};
