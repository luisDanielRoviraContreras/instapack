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
        let fileName = Object.keys(input.payload)[0];
        let fileBytes = Buffer.byteLength(input.payload[fileName], 'utf8');
        let fileSize = '(' + prettyBytes(fileBytes) + ')';
        Shout.timed(`Minifying ${chalk.blue(fileName)}... ${chalk.grey(fileSize)}`);
        
        let result = UglifyJS.minify(input.payload, input.options);
        if (result.error) {
            reject(result.error);
        } else {
            ok(result);
        }
    });
}
