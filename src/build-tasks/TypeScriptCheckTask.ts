import { Settings } from "../Settings";
import { Shout } from "../Shout";
import { TypeScriptCheckerTool } from "../TypeScriptCheckerTool";

/**
 * Accepts build task command as input parameter then run TypeScript check tool.
 * If watch mode is detected, do not send task completion signal to worker farm.
 */
export = async function typescriptCheckTask(input: IBuildCommand) {
    if (input.flags.watch) {
        Shout.enableNotification = input.flags.notification;
    }

    let settings = new Settings(input.root, input.settings);
    let tool = new TypeScriptCheckerTool(settings);

    await tool.typeCheck();
    if (input.flags.watch) {
        tool.watch();
        await new Promise((ok, reject) => {
            // keep process alive
        });
    }
}
