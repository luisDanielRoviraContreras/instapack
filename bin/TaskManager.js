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
const child_process_1 = require("child_process");
let activeTasks = new Set();
function runTaskInBackground(modulePath, params) {
    let task = child_process_1.fork(__filename, [], {
        env: {
            INSTAPACK_TASK: modulePath
        }
    });
    let processId = task.pid;
    activeTasks.add(task);
    task.send(params);
    return new Promise((ok, reject) => {
        task.on('error', error => {
            reject(error);
        });
        task.on('message', (feedback) => {
            if (feedback.errorStack) {
                let error = new Error(`An unhandled exception has occurred in child process PID #${processId}:\n${feedback.errorStack}`);
                reject(error);
            }
            else {
                ok(feedback.result);
            }
            activeTasks.delete(task);
        });
    });
}
exports.runTaskInBackground = runTaskInBackground;
function killAllBackgroundTasks() {
    for (let task of activeTasks) {
        task.kill();
    }
    activeTasks.clear();
}
exports.killAllBackgroundTasks = killAllBackgroundTasks;
process.on('message', (params) => __awaiter(this, void 0, void 0, function* () {
    let modulePath = process.env.INSTAPACK_TASK;
    let valid = Boolean(process.send) && Boolean(modulePath);
    if (!valid) {
        return;
    }
    try {
        let taskModule = require(modulePath);
        let result = yield taskModule(params);
        process.send({
            errorStack: null,
            result: result
        });
    }
    catch (error) {
        process.send({
            errorStack: error.stack,
            result: null
        });
    }
    finally {
        process.exit();
    }
}));
