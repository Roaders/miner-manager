
import { ChildProcess } from "child_process";
import { Observable, Subject } from "rxjs";
import { Readable } from "stream";


export type sourceType = "stdout" | "stderr" | "childprocess";
export type eventName = "close" | "data" | "end" | "readable" | "error";

export interface IChildEvent {
  source: sourceType;
  event: "close" | "end" | "readable" | "exit";
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
    const exitSubject = new Subject();
    const childStream = new Subject<IChildEvent>();
    const childProcess = launchCommand();

    const stoutStream = setupEventHandling(childProcess.stdout, "stdout");
    const sterrStream = setupEventHandling(childProcess.stderr, "stderr");

    childProcess.on('exit', (code) => {
      childStream.next({source: "childprocess", event: "exit"});
      exitSubject.next();
      exitSubject.complete();
    });

    return childStream
      .merge(stoutStream)
      .merge(sterrStream)
      .takeUntil(exitSubject);
  });
}

function setupEventHandling(stream: Readable, source: sourceType): Observable<childEvent> {

  const closeStream = fromStream<void>(stream, "close").map<void,IChildEvent>(() => ({source, event: "close"}));
  const endStream = fromStream<void>(stream, "end").map<void,IChildEvent>(() => ({source, event: "end"}));
  const readableStream = fromStream<void>(stream, "readable").map<void,IChildEvent>(() => ({source, event: "readable"}));

  const errorStream = fromStream<Error>(stream, "error").map<Error,IChildErrorEvent>(error => ({source, event: "error", error}));
  const dataStream = fromStream<string | Buffer>(stream, "data")
    .map<string | Buffer,string>(data => data.toString())
    .scan((currentLine, data) => trimPreviousLine(currentLine) + data, "") // join data together removing complete lines at start
    .filter(data => hasLineBreakAtEnd(data)) // only emit lines that are complete (have line break at end)
    .flatMap(data => Observable.from(data.split(/[\n\r]+/))) // split multiple lines in one message into separate lines
    .filter(line => line != null && line != "") // remove empty lines
    .map<string,IChildDataEvent>(data => ({source, event: "data", data}));

    return dataStream
      .merge(errorStream,readableStream,closeStream,endStream)
      .takeUntil(endStream);
} 

function hasLineBreakAtEnd(line: string): boolean{
  const newLineIndex = line.lastIndexOf("\n");
  const carriageReturnIndex = line.lastIndexOf("\r");

  return line.length -1 === newLineIndex || line.length -1 === carriageReturnIndex;
}

function trimPreviousLine(line: string): string{
  const newLineIndex = line.lastIndexOf("\n");
  const carriageReturnIndex = line.lastIndexOf("\r");

  const lineEnd = Math.max(newLineIndex, carriageReturnIndex);

  return lineEnd >= 0 ? line.substr(lineEnd + 1) : line;
}

function fromStream<T>(stream: Readable, event: eventName): Observable<T>{
  const subject = new Subject<T>();

  stream.on(event, payload => subject.next(payload));

  return subject
}

function handleEvent(source: sourceType, event: eventName, subject: Subject<childEvent>) {
  subject.next(<IChildEvent>{ source, event });

  switch (event) {
    case "end":
      subject.complete();
  }
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