import { Settings } from "../Settings";
import { Shout } from "../Shout";
import { SassBuildTool } from "../SassBuildTool";

/**
 * Accepts build task command as input parameter then run Sass build tool.
 * If watch mode is detected, returned Promise will never resolve.
 */
export = async function sassBuildTask(input: IBuildCommand) {
    if (input.flags.watch) {
        Shout.enableNotification = input.flags.notification;
    }

    let settings = new Settings(input.root, input.settings);
    let tool = new SassBuildTool(settings, input.flags);

    await tool.buildWithStopwatch();
    if (input.flags.watch) {
        tool.watch();
        await new Promise((ok, reject) => {
            // keep process alive
        });
    }
}
