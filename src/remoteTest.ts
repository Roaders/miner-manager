
import { ClaymoreService } from "./services/claymoreService";

const service = new ClaymoreService(3331, "192.168.86.150");

service.getMinerStats().subscribe(data => console.log(`result: ${JSON.stringify(data)}`));