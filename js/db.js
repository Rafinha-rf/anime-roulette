export class AnimeDatabase {
    constructor() {
        this.dbName = 'AnimeRouletteDB';
        this.version = 2; 
        this.db = null;
    }

    async open() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('user_lists')) {
                    db.createObjectStore('user_lists', { keyPath: 'username' });
                }

                if (!db.objectStoreNames.contains('history')) {
                    db.createObjectStore('history', { keyPath: 'id' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error("Erro ao abrir IndexedDB:", e);
                reject(e.target.error);
            };
        });
    }

    async saveUserLists(username, planning, completed) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['user_lists'], 'readwrite');
            const store = transaction.objectStore('user_lists');
            const data = {
                username: username.toLowerCase(),
                planning: planning,
                completed: completed,
                timestamp: Date.now()
            };
            store.put(data);
            transaction.oncomplete = () => resolve(data);
            transaction.onerror = (e) => reject(e);
        });
    }

    async getUserLists(username) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['user_lists'], 'readonly');
            const store = transaction.objectStore('user_lists');
            const request = store.get(username.toLowerCase());
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e);
        });
    }


async saveHistory(anime) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            
            const data = {
                id: anime.id,
                title: anime.title.romaji || anime.title.english || "Sem título",
                cover: anime.coverImage.large,
                url: anime.siteUrl,
                score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "0.0",
                timestamp: Date.now()
            };

            store.put(data);

            const getAllRequest = store.getAll();
            
            getAllRequest.onsuccess = () => {
                const allItems = getAllRequest.result;
                
                if (allItems.length > 4) {
                    allItems.sort((a, b) => b.timestamp - a.timestamp);
                    const itensParaDeletar = allItems.slice(4);
                    
                    itensParaDeletar.forEach(item => {
                        store.delete(item.id);
                    });
                }
            };
            
            transaction.oncomplete = () => resolve(data);
            transaction.onerror = (e) => reject(e);
        });
    }

    async getAllHistory() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readonly');
            const store = transaction.objectStore('history');
            const request = store.getAll();

            request.onsuccess = () => {
                const sorted = request.result.sort((a, b) => b.timestamp - a.timestamp);
                resolve(sorted.slice(0, 4));
            };
            request.onerror = (e) => reject(e);
        });
    }

    async clearHistory() {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['history'], 'readwrite');
            const store = transaction.objectStore('history');
            store.clear();
            transaction.oncomplete = () => resolve();
        });
    }
}