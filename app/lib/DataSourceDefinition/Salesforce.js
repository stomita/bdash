import jsforce from 'jsforce';
import Base from './Base';

export default class Salesforce extends Base {
  static get key() { return 'salesforce'; }
  static get label() { return 'Salesforce'; }
  static get configSchema() {
    return [
      { name: 'loginUrl', label: 'Login URL', type: 'string', placeholder: 'https://login.salesforce.com' },
      { name: 'username', label: 'Username', type: 'string', placeholder: process.env.USERNAME },
      { name: 'password', label: 'Password', type: 'password' },
    ];
  }

  constructor(config) {
    super(config);
    this._qid = 1;
  }

  _establishConnection() {
    if (!this._conn) {
      this._conn = new jsforce.Connection({ loginUrl: this.config.loginUrl });
      this._loggedIn = this._conn.login(this.config.username, this.config.password);
    }
    return this._loggedIn;
  }

  execute(query) {
    console.log(this);
    if (this._currentQid) {
      return Promise.reject(new Error('A query is running'));
    }
    const execQid = this._qid++;
    this._currentQid = execQid;
    return this._establishConnection()
      .then(() => this._conn.query(query))
      .then((qr) => {
        if (this._currentQid !== execQid) { // canceled
          return;
        }
        const fields = Object.keys(qr.records[0]).filter(field => field !== 'attributes');
        return {
          fields,
          rows: qr.records.map((record) => fields.reduce((row, field) => row.concat(record[field]), [])),
        };
      })
      .catch((error) => {
        this._currentQid = null;
        throw error;
      });
  }

  cancel() {
    this._currentQid = null;
    return Promise.resolve();
  }

  connectionTest() {
    console.log('connectionTest');
    return this.execute('SELECT Id FROM User').then(() => true);
  }

  fetchTables() {
    return this._establishConnection()
      .then(() => this._conn.describeGlobal())
      .then(ret => ret.sobjects.map(({ name }) => ({ name, type: 'table' })));
  }

  fetchTableSummary({ name }) {
    return this._establishConnection()
      .then(() => this._conn.describe(name))
      .then((so) => ({
        name,
        defs: {
          fields: ['name', 'type', 'label'],
          rows: so.fields.map((f) => [f.name, f.type, f.label]),
        },
      }));
  }
}
