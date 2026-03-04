import Database from "better-sqlite3";
const db = new Database(":memory:");
db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
db.prepare("INSERT INTO test (name) VALUES (?)").run("Hello");
const row = db.prepare("SELECT * FROM test").get();
console.log("DB TEST:", row);
