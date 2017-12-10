
import { Observable, Subject } from "rxjs";

export function createRefreshStream(){
    require('keypress')(process.stdin);
    
    const refreshSubject = new Subject();
    
    process.stdin.on('keypress', function (ch, key) {
        if (key && key.name == 's') {
            refreshSubject.next(key);
        } else if(key && key.ctrl && key.name == 'c'){
            console.log(`Exiting`);
            process.exit();
        }
    });
    (<any>process.stdin).setRawMode(true);

    return refreshSubject;
}

