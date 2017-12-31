
import { getuid } from "process";

export function checkRoot(){

    console.log(`Checking root permissions...`);

    if(getuid != undefined && getuid() != 0){
        console.log(`This must be run as sudo. Exiting...`);

        process.exit();
    }

}