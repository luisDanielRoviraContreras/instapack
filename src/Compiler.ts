import * as fse from 'fs-extra';
import chalk from 'chalk';
import * as chokidar from 'chokidar';
import * as upath from 'upath';
import * as assert from 'assert'
import { Settings } from './Settings';
import { Shout } from './Shout';
import { runTaskInBackground, killAllBackgroundTasks } from './TaskManager';

const typeScriptBuildTaskModulePath = require.resolve('./build-tasks/TypeScriptBuildTask');
const typeScriptCheckTaskModulePath = require.resolve('./build-tasks/TypeScriptCheckTask');
const sassBuildTaskModulePath = require.resolve('./build-tasks/SassBuildTask');
const concatBuildTaskModulePath = require.resolve('./build-tasks/ConcatBuildTask');

/**
 * Contains methods for assembling and invoking the build tasks.
 */
export class Compiler {

    /**
     * Gets or sets the project settings.
     */
    private settings: Settings;

    /**
     * Gets the compiler build flags.
     */
    private readonly flags: IBuildFlags;

    /**
     * Constructs a new instance of Compiler using the specified settings and build flags. 
     * @param settings 
     * @param flags 
     */
    constructor(settings: Settings, flags: IBuildFlags) {
        this.settings = settings;
        this.flags = flags;
    }

    /**
     * Displays information about currently used build flags.
     */
    private chat() {
        if (this.flags.watch) {
            Shout.timed(chalk.yellow("Watch"), "Mode: Source code will be automatically compiled on changes.");
        }

        if (this.flags.production) {
            Shout.timed(chalk.yellow("Production"), "Mode: Outputs minification is enabled.", chalk.red("(Slow build)"));
        } else {
            Shout.timed(chalk.yellow("Development"), "Mode: Outputs minification", chalk.red("is disabled!"), chalk.grey("(Fast build)"));
            Shout.timed(chalk.red("REMEMBER TO MINIFY"), "before pushing to production server!");
        }

        if (!this.flags.production || this.flags.watch) {
            this.flags.stats = false;
        }

        Shout.timed('Source Maps:', chalk.yellow(this.flags.sourceMap ? 'Enabled' : 'Disabled'));

        if (this.flags.stats) {
            Shout.timed('JS build stats:', chalk.cyan(this.settings.statJsonPath));
        }
    }

    /**
     * Checks whether JS build task can be run.
     * If not, display validation error messages.
     */
    private async validateJsBuildTask() {
        let entry = this.settings.jsEntry;
        let tsconfig = this.settings.tsConfigJson
        let checkEntry = fse.pathExists(entry);
        let checkProject = fse.pathExists(tsconfig);

        if (await checkEntry === false) {
            Shout.timed('Entry file', chalk.cyan(entry), 'was not found.', chalk.red('Aborting JS build!'));
            return false;
        }

        if (await checkProject === false) {
            Shout.timed('Project file', chalk.cyan(tsconfig), 'was not found.', chalk.red('Aborting JS build!'));
            return false;
        }

        return true;
    }

    /**
     * Checks whether the CSS build task can be run.
     * If not, display validation error messages.
     */
    private async validateCssBuildTask() {
        let entry = this.settings.cssEntry;
        let exist = await fse.pathExists(entry);
        if (!exist) {
            Shout.timed('Entry file', chalk.cyan(entry), 'was not found.', chalk.red('Aborting CSS build!'));
        }
        return exist;
    }

    /**
     * A *slow* but sure implementation of object deep equality comparer using Node assert.
     * @param a 
     * @param b 
     */
    deepEqual(a, b) {
        try {
            assert.deepStrictEqual(a, b);
            return true;
        } catch{
            return false;
        }
    }

    /**
     * Restart invoked build task(s) when package.json and tsconfig.json are edited!
     */
    async restartBuildsOnConfigurationChanges(taskName: string) {

        let readPackageJson = fse.readJson(this.settings.packageJson);
        let readTsConfigJson = fse.readJson(this.settings.tsConfigJson);

        let snapshots = {
            [this.settings.packageJson]: await readPackageJson,
            [this.settings.tsConfigJson]: await readTsConfigJson,
        };

        let debounced: NodeJS.Timer;
        let debounce = (file: string) => {
            clearTimeout(debounced);
            debounced = setTimeout(async () => {
                let snap = await fse.readJson(file);
                if (this.deepEqual(snapshots[file], snap)) {
                    return;
                }

                snapshots[file] = snap;
                Shout.timed(chalk.cyan(file), 'was edited. Restarting builds...');
                killAllBackgroundTasks();

                this.settings = await Settings.tryReadFromPackageJson(this.settings.root);
                this.runBuildTasks(taskName)
            }, 600);
        };

        chokidar.watch([this.settings.packageJson, this.settings.tsConfigJson], {
            ignoreInitial: true
        })
            .on('change', (file: string) => {
                file = upath.toUnix(file);
                debounce(file);
            })
            .on('unlink', (file: string) => {
                file = upath.toUnix(file);
                snapshots[file] = null;
                Shout.danger(chalk.cyan(file), 'was deleted!'); // "wtf are you doing?"
            });
    }

    /**
     * Display build information then run relevant build tasks.
     * @param taskName 
     */
    build(taskName: string) {
        this.chat();
        this.runBuildTasks(taskName);

        if (this.flags.watch) {
            this.restartBuildsOnConfigurationChanges(taskName);
        }
    }

    /**
     * Gets the serializable parameters for build workers.
     */
    get buildCommand(): IBuildCommand {
        return {
            root: this.settings.root,
            flags: this.flags,
            settings: this.settings.core
        }
    };

    /**
     * Run build workers for the input task.
     * @param taskName 
     */
    private async runBuildTasks(taskName: string) {
        switch (taskName) {
            case 'all':
                this.runBuildTasks('js');
                this.runBuildTasks('css');
                this.runBuildTasks('concat');
                return;

            case 'js':
                let valid = await this.validateJsBuildTask();
                if (valid) {
                    runTaskInBackground<void>(typeScriptBuildTaskModulePath, this.buildCommand).catch(error => {
                        Shout.fatal(`during JS build:`, error);
                        Shout.notify(`FATAL ERROR during JS build!`);
                    });
                    runTaskInBackground<void>(typeScriptCheckTaskModulePath, this.buildCommand).catch(error => {
                        Shout.fatal(`during type-checking:`, error);
                        Shout.notify(`FATAL ERROR during type-checking!`);
                    });
                }
                return;

            case 'css': {
                let valid = await this.validateCssBuildTask();
                if (valid) {
                    runTaskInBackground<void>(sassBuildTaskModulePath, this.buildCommand).catch(error => {
                        Shout.fatal(`during CSS build:`, error);
                        Shout.notify(`FATAL ERROR during CSS build!`);
                    });
                }
                return;
            }

            case 'concat': {
                let valid = (this.settings.concatCount > 0);
                if (valid) {
                    runTaskInBackground<void>(concatBuildTaskModulePath, this.buildCommand).catch(error => {
                        Shout.fatal(`during JS concat:`, error);
                        Shout.notify(`FATAL ERROR during JS concat!`);
                    });
                }
                return;
            }

            default:
                throw Error('Task `' + taskName + '` does not exists!');
        }
    }
}
