import * as UglifyJS from 'uglify-js';
import { IMinifyInputs } from '../IMinifyInputs';
import { prettyBytes } from '../PrettyUnits';
import chalk from 'chalk';
import { Shout } from '../Shout';

/**
 * Accepts minification input parameter to used by UglifyJS minifier.
 */
export = function jsMinifyTask(input: IMinifyInputs) {
    return new Promise<UglifyJS.MinifyOutput>((ok, reject) => {
        let fileBytes = Buffer.byteLength(input.code, 'utf8');
        let fileSize = '(' + prettyBytes(fileBytes) + ')';
        Shout.timed(`Minifying ${chalk.blue(input.fileName)}... ${chalk.grey(fileSize)}`);

        let option: UglifyJS.MinifyOptions;
        if (input.map) {
            option = {
                sourceMap: {
                    content: input.map as any // HACK78
                }
            }
        }

        let result = UglifyJS.minify({
            [input.fileName]: input.code
        }, option);

        if (result.error) {
            reject(result.error);
        } else {
            ok(result);
        }
    });
}
