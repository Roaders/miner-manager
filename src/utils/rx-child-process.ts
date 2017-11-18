
import { ChildProcess } from "child_process";
import { Observable, Subject } from "rxjs";

export function launchChild(launchCommand: () => ChildProcess): Observable<string> {

  return Observable.defer(() => {
    const subject = new Subject<string>();
    const childProcess = launchCommand();

    childProcess.stdout.on('data', (data) => {
      if (data instanceof Buffer) {
        data = data.toString();
      }

      data.split(/[\n\r]+/)
        .filter(line => line != null && line != "")
        .forEach(line => subject.next(line));
    });

    childProcess.stderr.on('data', (data) => {
      subject.error(data);
    });

    childProcess.on('exit', (code) => {
      subject.complete();
    });

    return subject;
  });
}