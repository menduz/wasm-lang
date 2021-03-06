import { Log, logToString } from './log';
import { parse, Parsed } from './parser';
import { RawType, codeToString, Import } from './ssa';
import { compile } from './compiler';
import { encodeWASM } from './wasm';
import { library, createImports, Imports } from './library';

export function run(input: string): {log: string, wasm: Uint8Array | null, debug: string | null, imports: Imports} {
  const sourceNames = ['<stdin>', '<library>'];
  const sources = [input, library];
  const log: Log = {messages: []};
  const parsed: Parsed = {librarySource: 1, sourceNames, types: [], defs: [], vars: []};
  const imports = createImports();

  for (let i = 0; i < sources.length; i++) {
    parse(log, sources[i], i, parsed);
  }

  if (log.messages.length > 0) {
    return {log: logToString(log, sourceNames, sources), wasm: null, debug: null, imports};
  }

  const code = compile(log, parsed, RawType.I32);

  if (log.messages.length > 0) {
    return {log: logToString(log, sourceNames, sources), wasm: null, debug: null, imports};
  }

  return {log: '', wasm: encodeWASM(code), debug: codeToString(code), imports};
}
