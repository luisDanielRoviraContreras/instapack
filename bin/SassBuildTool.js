"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fse = require("fs-extra");
const upath = require("upath");
const chalk_1 = require("chalk");
const chokidar = require("chokidar");
const sass = require("node-sass");
const postcss = require("postcss");
const autoprefixer = require("autoprefixer");
const discardComments = require("postcss-discard-comments");
const enhanced_resolve_1 = require("enhanced-resolve");
const CompilerUtilities_1 = require("./CompilerUtilities");
const PrettyUnits_1 = require("./PrettyUnits");
const Shout_1 = require("./Shout");
let resolver = enhanced_resolve_1.ResolverFactory.createResolver({
    fileSystem: new enhanced_resolve_1.NodeJsInputFileSystem(),
    extensions: ['.scss', '.css'],
    mainFields: ['style']
});
class SassBuildTool {
    constructor(settings, flags) {
        this.settings = settings;
        this.flags = flags;
    }
    compileSassAsync(options) {
        return new Promise((ok, reject) => {
            sass.render(options, (error, result) => {
                if (error) {
                    reject(error);
                }
                else {
                    ok(result);
                }
            });
        });
    }
    fixSourceMap(sm) {
        sm.sourceRoot = 'instapack://';
        let cssProjectFolder = this.settings.inputCssFolder;
        sm.sources = sm.sources.map(s => {
            let absolute = upath.join(cssProjectFolder, s);
            return '/' + upath.relative(this.settings.root, absolute);
        });
    }
    resolveAsync(lookupStartPath, request) {
        return new Promise((ok, reject) => {
            resolver.resolve({}, lookupStartPath, request, {}, (error, result) => {
                if (error) {
                    reject(error);
                }
                else {
                    ok(result);
                }
            });
        });
    }
    sassImport(source, request) {
        return __awaiter(this, void 0, void 0, function* () {
            let lookupStartPath = upath.dirname(source);
            let requestFileName = upath.basename(request);
            if (!requestFileName.startsWith('_')) {
                let requestDir = upath.dirname(request);
                let relativeLookupDir = upath.join(lookupStartPath, requestDir);
                let partialFileName = '_' + upath.addExt(requestFileName, '.scss');
                let partialPath = upath.resolve(relativeLookupDir, partialFileName);
                if (yield fse.pathExists(partialPath)) {
                    return partialPath;
                }
            }
            let isRelative = request.startsWith('./') || request.startsWith('../');
            if (!isRelative) {
                try {
                    return yield this.resolveAsync(lookupStartPath, './' + request);
                }
                catch (_a) {
                }
            }
            return yield this.resolveAsync(lookupStartPath, request);
        });
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            let cssInput = this.settings.cssEntry;
            let cssOutput = this.settings.outputCssFile;
            let sassOptions = {
                file: cssInput,
                outFile: cssOutput,
                data: yield fse.readFile(cssInput, 'utf8'),
                outputStyle: (this.flags.production ? 'compressed' : 'expanded'),
                sourceMap: this.flags.sourceMap,
                sourceMapEmbed: this.flags.sourceMap,
                sourceMapContents: this.flags.sourceMap,
                importer: (request, source, done) => {
                    this.sassImport(source, request).then(result => {
                        done({
                            file: upath.removeExt(result, '.css')
                        });
                    }).catch(error => {
                        done(error);
                    });
                }
            };
            let sassResult = yield this.compileSassAsync(sassOptions);
            let cssResult = yield postcss(this.postcssPlugins).process(sassResult.css, this.postcssOptions);
            let t1 = CompilerUtilities_1.outputFileThenLog(cssOutput, cssResult.css);
            if (cssResult.map) {
                let sm = cssResult.map.toJSON();
                this.fixSourceMap(sm);
                yield CompilerUtilities_1.outputFileThenLog(cssOutput + '.map', JSON.stringify(sm));
            }
            yield t1;
        });
    }
    get postcssPlugins() {
        let plugins = [autoprefixer];
        if (this.flags.production) {
            plugins.push(discardComments({
                removeAll: true
            }));
        }
        return plugins;
    }
    get postcssOptions() {
        let cssOutput = this.settings.outputCssFile;
        let options = {
            from: cssOutput,
            to: cssOutput
        };
        if (this.flags.sourceMap) {
            options.map = {
                inline: false
            };
        }
        return options;
    }
    buildWithStopwatch() {
        return __awaiter(this, void 0, void 0, function* () {
            Shout_1.Shout.timed('Compiling', chalk_1.default.cyan('index.scss'), chalk_1.default.grey('in ' + this.settings.inputCssFolder + '/'));
            let start = process.hrtime();
            try {
                yield this.build();
            }
            catch (error) {
                let render;
                Shout_1.Shout.notify('You have one or more CSS build errors!');
                if (error['formatted']) {
                    let formatted = 'Sass Compile' + error['formatted'].trim();
                    render = chalk_1.default.red(formatted);
                    console.error('\n' + render + '\n');
                }
                else {
                    Shout_1.Shout.error('during CSS build:', error);
                }
            }
            finally {
                let time = PrettyUnits_1.prettyHrTime(process.hrtime(start));
                Shout_1.Shout.timed('Finished CSS build after', chalk_1.default.green(time));
            }
        });
    }
    watch() {
        let debounced;
        let debounce = () => {
            clearTimeout(debounced);
            debounced = setTimeout(() => {
                this.buildWithStopwatch();
            }, 300);
        };
        chokidar.watch(this.settings.scssGlob, {
            ignoreInitial: true
        })
            .on('add', file => {
            file = upath.toUnix(file);
            Shout_1.Shout.sass(chalk_1.default.grey('tracking new file:', file));
            debounce();
        })
            .on('change', file => {
            file = upath.toUnix(file);
            Shout_1.Shout.sass(chalk_1.default.grey('updating file:', file));
            debounce();
        })
            .on('unlink', file => {
            file = upath.toUnix(file);
            Shout_1.Shout.sass(chalk_1.default.grey('removing file:', file));
            debounce();
        });
    }
}
exports.SassBuildTool = SassBuildTool;
