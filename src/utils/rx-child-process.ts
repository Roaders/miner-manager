
import { ChildProcess } from "child_process";
import { Observable, Subject } from "rxjs";
import { Readable } from "stream";


export type sourceType = "stdout" | "stderr";
export type eventName = "close" | "data" | "end" | "readable" | "error";

export interface IChildEvent {
  source: sourceType;
  event: "close" | "end" | "readable";
}

export interface IChildDataEvent {
  source: sourceType;
  event: "data";
  data: string;
}

export interface IChildErrorEvent {
  source: sourceType;
  event: "error";
  error: Error;
}

export type childEvent = IChildEvent | IChildDataEvent | IChildErrorEvent;

export function launchChild(launchCommand: () => ChildProcess): Observable<childEvent> {

  return Observable.defer(() => {
    const subject = new Subject<childEvent>();
    const childProcess = launchCommand();

    setupEventHandling(childProcess.stdout, "stdout", subject);
    setupEventHandling(childProcess.stderr, "stderr", subject);

    childProcess.stdout.on('data', (data) => {
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

function setupEventHandling(stream: Readable, source: sourceType, subject: Subject<childEvent>) {
  stream.on("close", () => handleEvent(source, "close", subject));
  stream.on("data", data => handleData(source, subject, data));
  stream.on("end", () => handleEvent(source, "close", subject));
  stream.on("readable", () => handleEvent(source, "close", subject));
  stream.on("error", (error) => handleError(source, subject, error));
}

function handleEvent(source: sourceType, event: eventName, subject: Subject<childEvent>) {
  subject.next(<IChildEvent>{ source, event });
}

function handleData(source: sourceType, subject: Subject<childEvent>, data: string | Buffer) {
  if (data instanceof Buffer) {
    data = data.toString();
  }

  data.split(/[\n\r]+/)
    .filter(line => line != null && line != "")
    .forEach(line => subject.next({ source, event: "data", data: line }));
}

function handleError(source: sourceType, subject: Subject<childEvent>, error: Error) {
  subject.next({ source, event: "error", error });
}