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
const chalk_1 = require("chalk");
const chokidar = require("chokidar");
const upath = require("upath");
const child_process_1 = require("child_process");
const EventHub_1 = require("./EventHub");
const TypeScriptBuildTool_1 = require("./TypeScriptBuildTool");
const TypeScriptCheckerTool_1 = require("./TypeScriptCheckerTool");
const SassBuildTool_1 = require("./SassBuildTool");
const ConcatBuildTool_1 = require("./ConcatBuildTool");
const Settings_1 = require("./Settings");
const CompilerUtilities_1 = require("./CompilerUtilities");
class Compiler {
    constructor(settings, flags) {
        this.buildTasks = [];
        this.settings = settings;
        this.flags = flags;
    }
    static fromCommand(command) {
        let settings = new Settings_1.Settings(command.root, command.settings);
        let compiler = new Compiler(settings, command.flags);
        return compiler;
    }
    chat() {
        CompilerUtilities_1.timedLog('Output to folder', chalk_1.default.cyan(this.settings.outputFolder));
        if (this.flags.production) {
            CompilerUtilities_1.timedLog(chalk_1.default.yellow("Production"), "Mode: Outputs will be minified.", chalk_1.default.red("(Slow build)"));
        }
        else {
            CompilerUtilities_1.timedLog(chalk_1.default.yellow("Development"), "Mode: Outputs will", chalk_1.default.red("NOT be minified!"), "(Fast build)");
            CompilerUtilities_1.timedLog(chalk_1.default.red("Do not forget to minify"), "before pushing to repository or production server!");
        }
        if (this.flags.watch) {
            CompilerUtilities_1.timedLog(chalk_1.default.yellow("Watch"), "Mode: Source codes will be automatically compiled on changes.");
        }
        if (!this.flags.production || this.flags.watch) {
            this.flags.analyze = false;
        }
        if (this.flags.analyze) {
            let analysisPath = this.settings.outputJsFolder + '/analysis.html';
            CompilerUtilities_1.timedLog(chalk_1.default.yellow('Analyze'), 'Mode:', chalk_1.default.cyan(analysisPath));
        }
        CompilerUtilities_1.timedLog('Source Maps:', chalk_1.default.yellow(this.flags.sourceMap ? 'Enabled' : 'Disabled'));
    }
    startBackgroundTask(taskName) {
        return __awaiter(this, void 0, void 0, function* () {
            if (taskName === 'all') {
                let t1 = this.startBackgroundTask('js');
                let t2 = this.startBackgroundTask('css');
                let t3 = this.startBackgroundTask('concat');
                yield Promise.all([t1, t2, t3]);
                return;
            }
            let valid = yield this.validateBackgroundTask(taskName);
            if (!valid) {
                return;
            }
            let child = child_process_1.fork(__filename);
            child.send({
                build: taskName,
                root: this.settings.root,
                flags: this.flags,
                settings: this.settings.core
            });
            this.buildTasks.push(child);
            if (taskName === 'js') {
                yield this.startBackgroundTask('type-checker');
            }
        });
    }
    validateBackgroundTask(taskName) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (taskName) {
                case 'js': {
                    let entry = this.settings.jsEntry;
                    let tsconfig = this.settings.tsConfigJson;
                    let checkEntry = fse.pathExists(entry);
                    let checkProject = fse.pathExists(tsconfig);
                    if ((yield checkEntry) === false) {
                        CompilerUtilities_1.timedLog('Entry file', chalk_1.default.cyan(entry), 'was not found.', chalk_1.default.red('Aborting JS build!'));
                        return false;
                    }
                    if ((yield checkProject) === false) {
                        CompilerUtilities_1.timedLog('Project file', chalk_1.default.cyan(tsconfig), 'was not found.', chalk_1.default.red('Aborting JS build!'));
                        return false;
                    }
                    return true;
                }
                case 'css': {
                    let entry = this.settings.cssEntry;
                    let exist = yield fse.pathExists(entry);
                    if (!exist) {
                        CompilerUtilities_1.timedLog('Entry file', chalk_1.default.cyan(entry), 'was not found.', chalk_1.default.red('Aborting CSS build!'));
                    }
                    return exist;
                }
                case 'concat': {
                    return (this.settings.concatCount > 0);
                }
                case 'type-checker': {
                    return true;
                }
                default: {
                    throw Error('Task `' + taskName + '` does not exists!');
                }
            }
        });
    }
    killAllBuilds() {
        for (let task of this.buildTasks) {
            task.kill();
        }
        this.buildTasks = [];
    }
    restartBuildsOnConfigurationChanges() {
        chokidar.watch([this.settings.packageJson, this.settings.tsConfigJson], {
            ignoreInitial: true
        })
            .on('change', (file) => {
            file = upath.toUnix(file);
            CompilerUtilities_1.timedLog(chalk_1.default.cyan(file), 'was edited. Restarting builds...');
            this.killAllBuilds();
            this.settings = Settings_1.Settings.tryReadFromPackageJson(this.settings.root);
            this.build(this._userBuildTaskParameter);
        })
            .on('unlink', (file) => {
            file = upath.toUnix(file);
            CompilerUtilities_1.timedLog(chalk_1.default.cyan(file), 'was deleted.', chalk_1.default.red('BAD IDEA!'));
        });
    }
    build(taskName) {
        let task;
        if (process.send === undefined) {
            if (!this._userBuildTaskParameter) {
                this._userBuildTaskParameter = taskName;
                this.chat();
                if (this.flags.watch) {
                    this.restartBuildsOnConfigurationChanges();
                }
            }
            task = this.startBackgroundTask(taskName);
        }
        else {
            switch (taskName) {
                case 'js': {
                    task = this.buildJS();
                    break;
                }
                case 'css': {
                    task = this.buildCSS();
                    break;
                }
                case 'concat': {
                    task = this.buildConcat();
                    break;
                }
                case 'type-checker': {
                    task = this.checkTypeScript();
                    break;
                }
                default: {
                    throw Error('Task `' + taskName + '` does not exists!');
                }
            }
        }
        task.catch(error => {
            console.error(chalk_1.default.red('FATAL ERROR'), 'during', taskName.toUpperCase(), 'build:');
            console.error(error);
            EventHub_1.default.buildDone();
        });
    }
    buildJS() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fse.remove(this.settings.outputJsSourceMap);
            let tool = new TypeScriptBuildTool_1.TypeScriptBuildTool(this.settings, this.flags);
            tool.build();
        });
    }
    buildCSS() {
        return __awaiter(this, void 0, void 0, function* () {
            yield fse.remove(this.settings.outputCssSourceMap);
            let tool = new SassBuildTool_1.SassBuildTool(this.settings, this.flags);
            yield tool.buildWithStopwatch();
            if (this.flags.watch) {
                tool.watch();
            }
        });
    }
    buildConcat() {
        return __awaiter(this, void 0, void 0, function* () {
            CompilerUtilities_1.timedLog('Resolving', chalk_1.default.cyan(this.settings.concatCount.toString()), 'concat target(s)...');
            let tool = new ConcatBuildTool_1.ConcatBuildTool(this.settings, this.flags);
            yield tool.buildWithStopwatch();
        });
    }
    checkTypeScript() {
        return __awaiter(this, void 0, void 0, function* () {
            let tool = new TypeScriptCheckerTool_1.TypeScriptCheckerTool(this.settings);
            tool.typeCheck();
            if (this.flags.watch) {
                tool.watch();
            }
        });
    }
}
exports.Compiler = Compiler;
if (process.send) {
    process.on('message', (command) => {
        if (command.build) {
            if (!command.flags.watch || command.build === 'concat') {
                EventHub_1.default.exitOnBuildDone();
            }
            Compiler.fromCommand(command).build(command.build);
        }
    });
}
