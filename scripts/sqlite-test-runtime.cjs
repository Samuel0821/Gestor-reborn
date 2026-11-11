// Optional SQLite adapter for Node; normal test runs use Electron's better-sqlite3.
if (process.argv.includes('--node-sqlite')) {
  const { DatabaseSync } = require('node:sqlite');
  const Module = require('node:module');
  const load = Module._load;
  class Database {
    constructor(filename) { this.db = new DatabaseSync(filename); this.depth = 0; }
    pragma(sql) { this.db.exec('PRAGMA ' + sql); }
    exec(sql) { this.db.exec(sql); }
    close() { this.db.close(); }
    prepare(sql) {
      const statement = this.db.prepare(sql);
      return { run: (...args) => statement.run(...args), get: (...args) => { const row = statement.get(...args); return row && { ...row }; }, all: (...args) => statement.all(...args).map(row => ({ ...row })) };
    }
    transaction(fn) { return (...args) => {
      const name = 'test_' + this.depth++;
      this.exec('SAVEPOINT ' + name);
      try { const result = fn(...args); this.exec('RELEASE ' + name); return result; }
      catch (error) { this.exec(`ROLLBACK TO ${name}; RELEASE ${name}`); throw error; }
      finally { this.depth--; }
    }; }
  }
  Module._load = function(name, ...args) { return name === 'better-sqlite3' ? Database : load.call(this, name, ...args); };
}
