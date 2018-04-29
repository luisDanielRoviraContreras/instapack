import { Settings } from "../Settings";
import { TypeScriptBuildTool } from "../TypeScriptBuildTool";
import { Shout } from "../Shout";

/**
 * Accepts build task command as input parameter then run TypeScript build tool.
 */
export = async function typescriptBuildTask(input: IBuildCommand) {
    if (input.flags.watch) {
        Shout.enableNotification = input.flags.notification;
    }

    let settings = new Settings(input.root, input.settings);
    let tool = new TypeScriptBuildTool(settings, input.flags);

    await tool.build(); // Promise will never resolve if runs on watch mode!
}
