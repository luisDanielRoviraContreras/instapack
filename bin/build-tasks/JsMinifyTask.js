"use strict";
const UglifyJS = require("uglify-js");
module.exports = function (input) {
    let result = UglifyJS.minify(input.payload, input.options);
    return new Promise((ok, reject) => {
        if (result.error) {
            reject(result.error);
        }
        else {
            ok(result);
        }
    });
};
