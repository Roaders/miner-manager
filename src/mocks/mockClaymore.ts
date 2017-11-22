
import { Observable } from "rxjs";
import * as http from "http";
import { timeout } from "rxjs/operator/timeout";

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

let port: number | undefined;

const portRegExp = /-mport +(\d+)/

process.argv.forEach(arg => {
    const result = portRegExp.exec(arg);
    if(result){
        port = parseInt(result[1]);
    }
})

port = port ? port : 3333;

console.log(`launching server: ${port}`);

http.createServer((request, response) => {
    response.writeHead(200, {'Content-Type': 'text/plain'}); 
    response.end(`Hello World port ${port}\n`);
}).listen(port);

setTimeout(() => process.exit(), (Math.random() * 60 * 1000) + 500);