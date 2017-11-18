
import {Observable} from "rxjs";

const messages = [
    "Setting DAG epoch #152...",
    "Setting DAG epoch #152 for GPU0",
    "Create GPU buffer for GPU0",
    "GPU0 DAG creation time - 7355 ms",
    "Setting DAG epoch #152 for GPU0 done"
];

console.log(`CUDA initializing...`);

Observable.from(messages)
    .concatMap(message => Observable.of(message).delay((Math.random() * 500) + 100))
    .subscribe(message => console.log(message));
