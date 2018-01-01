
import { getuid } from "process";

export function checkRoot(showLogs: boolean = true, exit: boolean = true): boolean {

    logMessage(showLogs, `Checking root permissions...`);

    if (getuid != undefined && getuid() != 0) {
        logMessage(showLogs, `This must be run as sudo. Exiting...`);

        if (exit) {
            process.exit();
        }

        return false;
    }

    return true;
}

function logMessage(showLogs: boolean, message: string) {
    if (!showLogs) {
        return;
    }

    console.log(message);
}