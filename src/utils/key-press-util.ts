
import { Observable, Subject } from "rxjs";
import { Key } from "readline"

export function createKeypressStream(): Observable<Key> {
    require('keypress')(process.stdin);

    const refreshSubject = new Subject<Key>();

    process.stdin.on('keypress', (ch, key: Key) => {

        if (key && key.ctrl && key.name == 'c') {
            console.log(`Exiting`);
            process.exit();
        } else if (key) {
            refreshSubject.next(key);
        }
    });
    (<any>process.stdin).setRawMode(true);

    return refreshSubject;
}

