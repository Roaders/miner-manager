
import { Observable } from "rxjs";
import * as http from "http";
import { timeout } from "rxjs/operator/timeout";

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

// http.createServer((request, response) => {
//     response.writeHead(200, {'Content-Type': 'text/plain'}); 
//     response.end(`Hello World port ${port}\n`);
// }).listen(port);

const dieTime = (Math.random() * 8500) + 1500;

console.log(`dieTime: ${dieTime}`);

setTimeout(() => process.exit(), dieTime);