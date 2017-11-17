
import * as http from "http";

interface ICommandArgument {
    name: string;
    value: string[]
}

function formatArgument(input: string): ICommandArgument {
    const [name, valueString] = input.split("=");
    const value = valueString.split(",");
    return { name, value };
}

function queryGpu(args: ICommandArgument[]) {
    const query: ICommandArgument | undefined = args.filter(c => c.name === "--query-gpu")[0];

    for (let index = 0; index < 8; index++) {
        let output = "";

        query.value.forEach(value => {
            switch (value) {
                case "index":
                    if (output != "") output += ", ";
                    output += index;
                    break;
                case "uuid":
                    if (output != "") output += ", ";
                    output += `uuid_${index}`;
                    break;
            }
        })

        console.log(output);
    }
}

const args = process.argv.slice(2)
    .map(formatArgument);

args.forEach(arg => {
    switch (arg.name) {
        case "--query-gpu":
            queryGpu(args);
            break;
    }
});