
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
            if (output != "") output += ", ";
            switch (value) {
                case "index":
                    output += index;
                    break;
                case "uuid":
                    output += `uuid_${index}`;
                    break;
                case "power.draw":
                    const power = (Math.random() * 30) + 80;
                    output += `${power.toFixed(2).toString()} W`;
                    break;
                case "power.limit":
                    output += `100.00 W`;
                    break;
                case "utilization.gpu":
                    const utilization = (Math.random() * 30) + 70;
                    output += `${utilization.toFixed().toString()} %`;
                    break;
                case "temperature.gpu":
                    const temperature = Math.floor((Math.random() * 30) + 50);
                    output += temperature.toString();
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