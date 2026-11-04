// The asm.js build of sql.js has the same API as the default (WebAssembly) entry point.
declare module 'sql.js/dist/sql-asm.js' {
  import initSqlJs from 'sql.js'
  export default initSqlJs
}
