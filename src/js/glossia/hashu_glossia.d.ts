/* tslint:disable */
/* eslint-disable */
/**
 * `cashuB…` → a paragraph of English. JSON `{ words }` or `{ error }`.
 */
export function cashuToWords(token: string): string;
/**
 * A paragraph of English → `cashuB…`. Text around the paragraph is
 * ignored. JSON `{ token, repaired }` (how many words parity repaired) or
 * `{ error }`.
 */
export function cashuFromWords(text: string): string;
/**
 * Every word a voucher paragraph can contain, for snapping OCR misreads to
 * the nearest real word. JSON `{ payload, cover }` (lower-case) or
 * `{ error }`. Mirrors glossia's own `get_payload_words`/`get_cover_words`.
 */
export function vocabulary(): string;
/**
 * `creqA…` → a paragraph of English. JSON `{ words }` or `{ error }`.
 */
export function requestToWords(request: string): string;
/**
 * A paragraph of English → `creqA…`. JSON `{ request, repaired }` or
 * `{ error }`.
 */
export function requestFromWords(text: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly cashuFromWords: (a: number, b: number) => [number, number];
  readonly cashuToWords: (a: number, b: number) => [number, number];
  readonly requestFromWords: (a: number, b: number) => [number, number];
  readonly requestToWords: (a: number, b: number) => [number, number];
  readonly vocabulary: () => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
