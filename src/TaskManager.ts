import { fork, ChildProcess } from 'child_process';

/**
 * Contains objects returned from child process.
 * On successful execution, result will contain returned values from background task and error will be nulled. 
 * If an unhandled error occurred, errorStack will contain stack trace in the child process and result will be nulled.
 */
interface IBackgroundTaskFeedback<T> {
    errorStack: string;
    result: T;
}

/**
 * A task module should return an asynchronous function.
 */
declare type TaskModuleFunction = (input: any) => Promise<any>;

let activeTasks: Set<ChildProcess> = new Set<ChildProcess>();

/**
 * Accepts async function module path to be executed in child process and input parameter for that function.
 * Returns a Promise which resolves to the result of that function.
 * @param modulePath 
 * @param params 
 */
export function runTaskInBackground<T>(modulePath: string, params) {
    let task = fork(__filename, [], {
        env: {
            INSTAPACK_TASK: modulePath
        }
    });

    let processId = task.pid;
    activeTasks.add(task);
    task.send(params);

    return new Promise<T>((ok, reject) => {
        task.on('error', error => {
            reject(error);
        });
        task.on('message', (feedback: IBackgroundTaskFeedback<T>) => {
            // console.log(processId + ' FINISHED');
            if (feedback.errorStack) {
                let error = new Error(`An unhandled exception has occurred in child process PID #${processId}:\n${feedback.errorStack}`)
                reject(error)
            } else {
                ok(feedback.result);
            }
            activeTasks.delete(task);
        });
    });
}

/**
 * Destroy all currently running background tasks.
 */
export function killAllBackgroundTasks() {
    for (let task of activeTasks) {
        task.kill();
    }
    activeTasks.clear();
}

process.on('message', async (params) => {
    let modulePath: string = process.env.INSTAPACK_TASK;
    let valid = Boolean(process.send) && Boolean(modulePath);
    if (!valid) {
        return;
    }

    // console.log(process.pid + ' ' + modulePath);
    try {
        let taskModule = require(modulePath) as TaskModuleFunction;
        let result = await taskModule(params);
        process.send({
            errorStack: null,
            result: result
        } as IBackgroundTaskFeedback<any>);
    } catch (error) {
        process.send({
            errorStack: (error as Error).stack,
            result: null
        } as IBackgroundTaskFeedback<any>);
    } finally {
        process.exit();
    }
});
