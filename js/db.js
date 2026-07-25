class TaskDB {
  constructor() {
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('DailyPlanner', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const s = db.createObjectStore('tasks', { keyPath: 'id' });
        s.createIndex('date', 'date', { unique: false });
      };
      req.onsuccess = e => { this.db = e.target.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  getTasks(date) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const req = tx.objectStore('tasks').index('date').getAll(date);
      req.onsuccess = () => resolve(req.result.sort((a, b) => a.order - b.order));
      req.onerror = () => reject(req.error);
    });
  }

  getAllTasks() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const req = tx.objectStore('tasks').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  addTask(task) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const req = tx.objectStore('tasks').add(task);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  updateTask(id, fields) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const get = store.get(id);
      get.onsuccess = () => {
        Object.assign(get.result, fields);
        store.put(get.result);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  deleteTask(id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      tx.objectStore('tasks').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
