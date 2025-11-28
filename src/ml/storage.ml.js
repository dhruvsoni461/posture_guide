/**
 * Storage utilities for ML models and datasets
 * Handles IndexedDB with localStorage fallback
 */

import { DEFAULT_CONFIG } from './constants.ml.js';

// Simple IndexedDB wrapper with localStorage fallback
class SimpleStorage {
  constructor() {
    this.dbName = 'PostureMLDB';
    this.version = 1;
    this.db = null;
    this.isIndexedDBAvailable = this.checkIndexedDBSupport();
  }

  checkIndexedDBSupport() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  async init() {
    if (!this.isIndexedDBAvailable) {
      console.warn('IndexedDB not available, falling back to localStorage');
      return;
    }

    try {
      this.db = await this.openDB();
    } catch (error) {
      console.warn('Failed to open IndexedDB, falling back to localStorage:', error);
      this.isIndexedDBAvailable = false;
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('datasets')) {
          db.createObjectStore('datasets');
        }
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models');
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata');
        }
      };
    });
  }

  async set(storeName, key, value) {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        await new Promise((resolve, reject) => {
          const request = store.put(value, key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        return;
      } catch (error) {
        console.warn('IndexedDB write failed, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${this.dbName}_${storeName}_${key}`;
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error('localStorage write failed:', error);
      throw error;
    }
  }

  async get(storeName, key) {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        const tx = this.db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        return await new Promise((resolve, reject) => {
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.warn('IndexedDB read failed, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${this.dbName}_${storeName}_${key}`;
      const item = localStorage.getItem(storageKey);
      return item ? JSON.parse(item) : undefined;
    } catch (error) {
      console.error('localStorage read failed:', error);
      return undefined;
    }
  }

  async delete(storeName, key) {
    if (this.isIndexedDBAvailable && this.db) {
      try {
        const tx = this.db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        await new Promise((resolve, reject) => {
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
        return;
      } catch (error) {
        console.warn('IndexedDB delete failed, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    try {
      const storageKey = `${this.dbName}_${storeName}_${key}`;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('localStorage delete failed:', error);
    }
  }
}

// Global storage instance
const storage = new SimpleStorage();

// Initialize storage on first use
let storageInitialized = false;
async function ensureStorageInit() {
  if (!storageInitialized) {
    await storage.init();
    storageInitialized = true;
  }
}

/**
 * Save dataset to storage
 */
export async function saveDataset(dataset, key = DEFAULT_CONFIG.DATASET_KEY) {
  await ensureStorageInit();
  
  try {
    // Validate dataset structure
    if (!dataset || typeof dataset !== 'object') {
      throw new Error('Invalid dataset format');
    }

    const datasetWithMeta = {
      ...dataset,
      savedAt: new Date().toISOString(),
      version: '1.0'
    };

    await storage.set('datasets', key, datasetWithMeta);
    console.log(`Dataset saved to storage with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save dataset:', error);
    throw error;
  }
}

/**
 * Load dataset from storage
 */
export async function loadDataset(key = DEFAULT_CONFIG.DATASET_KEY) {
  await ensureStorageInit();
  
  try {
    const dataset = await storage.get('datasets', key);
    if (dataset) {
      console.log(`Dataset loaded from storage with key: ${key}`);
      return dataset;
    }
    return null;
  } catch (error) {
    console.error('Failed to load dataset:', error);
    return null;
  }
}

/**
 * Save model metadata
 */
export async function saveModelMeta(metadata, key = DEFAULT_CONFIG.MODEL_META_KEY) {
  await ensureStorageInit();
  
  try {
    const metaWithTimestamp = {
      ...metadata,
      savedAt: new Date().toISOString()
    };

    await storage.set('metadata', key, metaWithTimestamp);
    console.log(`Model metadata saved with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to save model metadata:', error);
    throw error;
  }
}

/**
 * Load model metadata
 */
export async function loadModelMeta(key = DEFAULT_CONFIG.MODEL_META_KEY) {
  await ensureStorageInit();
  
  try {
    const metadata = await storage.get('metadata', key);
    if (metadata) {
      console.log(`Model metadata loaded with key: ${key}`);
      return metadata;
    }
    return null;
  } catch (error) {
    console.error('Failed to load model metadata:', error);
    return null;
  }
}

/**
 * Delete dataset
 */
export async function deleteDataset(key = DEFAULT_CONFIG.DATASET_KEY) {
  await ensureStorageInit();
  
  try {
    await storage.delete('datasets', key);
    console.log(`Dataset deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to delete dataset:', error);
    return false;
  }
}

/**
 * Delete model metadata
 */
export async function deleteModelMeta(key = DEFAULT_CONFIG.MODEL_META_KEY) {
  await ensureStorageInit();
  
  try {
    await storage.delete('metadata', key);
    console.log(`Model metadata deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Failed to delete model metadata:', error);
    return false;
  }
}

/**
 * Get storage info and usage
 */
export async function getStorageInfo() {
  await ensureStorageInit();
  
  const info = {
    type: storage.isIndexedDBAvailable ? 'IndexedDB' : 'localStorage',
    available: true
  };

  try {
    if (storage.isIndexedDBAvailable && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      info.quota = estimate.quota;
      info.usage = estimate.usage;
      info.usagePercentage = estimate.quota ? (estimate.usage / estimate.quota * 100).toFixed(2) : 'unknown';
    }
  } catch (error) {
    console.warn('Could not get storage estimate:', error);
  }

  return info;
}

/**
 * Clear all ML-related storage
 */
export async function clearAllStorage() {
  await ensureStorageInit();
  
  try {
    await Promise.all([
      deleteDataset(),
      deleteModelMeta()
    ]);
    
    // Also try to clear any TensorFlow.js models
    if (typeof tf !== 'undefined' && tf.io && tf.io.listModels) {
      const models = await tf.io.listModels();
      const postureModels = Object.keys(models).filter(name => 
        name.includes('posture') || name.includes(DEFAULT_CONFIG.MODEL_NAME)
      );
      
      for (const modelName of postureModels) {
        try {
          await tf.io.removeModel(modelName);
          console.log(`Removed TensorFlow.js model: ${modelName}`);
        } catch (error) {
          console.warn(`Failed to remove model ${modelName}:`, error);
        }
      }
    }
    
    console.log('All ML storage cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear storage:', error);
    return false;
  }
}

// Example usage (for testing in console):
/*
// Test storage operations
(async () => {
  // Save test dataset
  const testDataset = {
    good: [[1, 2, 3, 4, 5], [1.1, 2.1, 3.1, 4.1, 5.1]],
    slouch: [[2, 3, 4, 5, 6], [2.1, 3.1, 4.1, 5.1, 6.1]]
  };
  
  await saveDataset(testDataset, 'test_dataset');
  const loaded = await loadDataset('test_dataset');
  console.log('Loaded dataset:', loaded);
  
  // Get storage info
  const info = await getStorageInfo();
  console.log('Storage info:', info);
})();
*/
