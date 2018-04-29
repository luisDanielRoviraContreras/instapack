import * as UglifyJS from 'uglify-js';
import { IMinifyInputs } from '../IMinifyInputs';

/**
 * Accepts minification input parameter to used by UglifyJS minifier.
 */
export = function jsMinifyTask(input: IMinifyInputs) {
    let result = UglifyJS.minify(input.payload, input.options);

    return new Promise<UglifyJS.MinifyOutput>((ok, reject) => {
        if (result.error) {
            reject(result.error);
        } else {
            ok(result);
        }
    });
}
