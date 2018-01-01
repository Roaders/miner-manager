
import { Observable } from "rxjs";
import { Key } from "readline"

export function createKeypressStream(): Observable<Key> {
    require('keypress')(process.stdin);

    let stream: NodeJS.ReadStream | undefined;

    let handler: any;
    console.log(`Listening for keypresses...`);

    const addListener = (eventName: string, eventHandler: Function) => {
        console.log(`adding event listener '${eventName}' to process.stdin (${handler})`);

        handler = (ch: any, key: Key) => {

            if (key && key.ctrl && key.name == 'c') {
                console.log(`Exiting`);
                process.exit();
            } else if(key) {
                console.log(`passing events to handler (${key.name})`);

                eventHandler(key);
            }
        }

        stream = process.stdin.addListener(eventName, handler);

        (<any>process.stdin).setRawMode(true);
    }

    const removeListener = (eventName: string) => {

        if(stream){
            console.log(`removing event listener '${eventName}' from stream (${stream})`);
            stream.removeListener(eventName, handler)

            stream = undefined;
        }
    }

    return Observable.fromEvent({ addListener, removeListener }, "keypress");
}
