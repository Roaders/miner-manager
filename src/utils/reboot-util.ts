
import { checkRoot } from "./root-util"
import { createKeypressStream } from "./key-press-util"
import { Observable } from "rxjs";

export function reboot(message: string) {

    const rebootTimeoutInS = 10;

    const root = checkRoot(false, false);

    console.log(`${message}`);

    if (root) {

        console.log(`System will reboot in ${rebootTimeoutInS} seconds`);
        console.log(`Ctrl-C to prevent this or space to reboot now.`);

        const keyPresses = createKeypressStream()
            .do(key => console.log(`keypress: ${key.name}`))
            .take(1);

        const timeout = Observable.interval(rebootTimeoutInS * 1000)
            .take(1);

        timeout
            .takeUntil(keyPresses)
            .subscribe(() => {
                console.log(`Rebooting now...`);
            },
            () => { },
            () => console.log(`stream complete`));
    } else {
        console.log(`${message}`);
        console.log(`Please reboot system.`);
        process.exit();
    }
}