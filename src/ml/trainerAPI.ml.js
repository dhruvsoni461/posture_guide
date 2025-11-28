/**
 * Trainer API for Posture Detection
 * Non-invasive API for collecting labeled samples and training models
 */

import { DEFAULT_CONFIG } from './constants.js';
import { computeFeaturesFromKeypoints, computeNormalizationStats } from './poseUtils.ml.js';
import { buildModel, trainModel, saveModel, loadModel, prepareTrainingData, getModelInfo } from './modelService.ml.js';
import { saveDataset, loadDataset, saveModelMeta, loadModelMeta } from './storage.ml.js';

class PostureTrainer {
  constructor() {
    this.getKeypoints = null;
    this.onStatus = null;
    this.isRecording = false;
    this.recordingData = [];
    this.currentLabel = null;
    this.recordingTimer = null;
    this.baselineAngle = null;
    this.datasets = { good: [], slouch: [] };
    this.model = null;
    this.normalizationStats = null;
    
    // Load existing data on initialization
    this.loadExistingData();
  }

  async loadExistingData() {
    try {
      const savedDataset = await loadDataset();
      if (savedDataset) {
        this.datasets = {
          good: savedDataset.good || [],
          slouch: savedDataset.slouch || []
        };
        this.baselineAngle = savedDataset.baselineAngle || null;
        this.normalizationStats = savedDataset.normalizationStats || null;
        console.log('Loaded existing dataset:', this.getDatasetStats());
      }
    } catch (error) {
      console.warn('Could not load existing dataset:', error);
    }
  }

  /**
   * Initialize trainer with keypoint source and callbacks
   */
  init({ getKeypoints, onStatus } = {}) {
    // Set up keypoint getter
    if (getKeypoints && typeof getKeypoints === 'function') {
      this.getKeypoints = getKeypoints;
    } else {
      // Auto-detect global keypoint sources
      this.getKeypoints = this.autoDetectKeypointSource();
    }

    this.onStatus = onStatus || ((msg) => console.log('[Trainer]', msg));

    if (!this.getKeypoints) {
      const msg = 'No keypoint source found. Please provide getKeypoints function or set window.getLatestKeypoints() or window.__LATEST_KEYPOINTS__';
      this.onStatus(msg);
      console.warn(msg);
      return false;
    }

    this.onStatus('Trainer initialized successfully');
    return true;
  }

  /**
   * Auto-detect keypoint source from global variables/functions
   */
  autoDetectKeypointSource() {
    if (typeof window === 'undefined') return null;

    // Try function first
    if (typeof window.getLatestKeypoints === 'function') {
      console.log('Using window.getLatestKeypoints()');
      return window.getLatestKeypoints;
    }

    // Try variable
    if (window.__LATEST_KEYPOINTS__) {
      console.log('Using window.__LATEST_KEYPOINTS__');
      return () => window.__LATEST_KEYPOINTS__;
    }

    // Try common camera component patterns
    const cameraElements = document.querySelectorAll('[data-keypoints], [id*="camera"], [class*="camera"]');
    for (const element of cameraElements) {
      if (element.__keypoints || element.keypoints) {
        console.log('Found keypoints on DOM element:', element);
        return () => element.__keypoints || element.keypoints;
      }
    }

    return null;
  }

  /**
   * Start recording samples for a specific label
   */
  async startRecording(label, durationMs = 6000) {
    if (!this.getKeypoints) {
      throw new Error('Trainer not initialized. Call init() first.');
    }

    if (this.isRecording) {
      throw new Error('Already recording. Stop current recording first.');
    }

    if (!label || !['good', 'slouch'].includes(label)) {
      throw new Error('Label must be "good" or "slouch"');
    }

    this.isRecording = true;
    this.currentLabel = label;
    this.recordingData = [];

    this.onStatus(`Recording ${label} posture for ${durationMs/1000}s...`);

    // Collect samples at regular intervals
    const sampleInterval = 500; // 2 FPS
    const totalSamples = Math.floor(durationMs / sampleInterval);
    let sampleCount = 0;

    const collectSample = () => {
      if (!this.isRecording) return;

      try {
        const keypoints = this.getKeypoints();
        if (keypoints) {
          const result = computeFeaturesFromKeypoints(keypoints, {
            baselineAngle: this.baselineAngle
          });

          if (result.features && result.confidence > DEFAULT_CONFIG.MIN_CONFIDENCE) {
            this.recordingData.push({
              features: result.features,
              confidence: result.confidence,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        console.warn('Error collecting sample:', error);
      }

      sampleCount++;
      this.onStatus(`Recording ${label}: ${sampleCount}/${totalSamples} samples`);

      if (sampleCount < totalSamples && this.isRecording) {
        setTimeout(collectSample, sampleInterval);
      } else {
        this.finishRecording();
      }
    };

    // Start collecting
    collectSample();

    return new Promise((resolve) => {
      this.recordingTimer = setTimeout(() => {
        resolve(this.finishRecording());
      }, durationMs);
    });
  }

  /**
   * Stop current recording
   */
  stopRecording() {
    if (!this.isRecording) return null;

    if (this.recordingTimer) {
      clearTimeout(this.recordingTimer);
      this.recordingTimer = null;
    }

    return this.finishRecording();
  }

  /**
   * Finish recording and save samples
   */
  async finishRecording() {
    if (!this.isRecording) return null;

    this.isRecording = false;
    const label = this.currentLabel;
    const samples = this.recordingData.slice();

    if (samples.length === 0) {
      this.onStatus(`No valid samples recorded for ${label}`);
      return { label, count: 0 };
    }

    // Add samples to dataset
    const features = samples.map(s => s.features);
    this.datasets[label].push(...features);

    // Save dataset
    await this.saveDataset();

    const message = `Recorded ${samples.length} samples for ${label}`;
    this.onStatus(message);
    console.log(message, this.getDatasetStats());

    return { label, count: samples.length, totalSamples: this.datasets[label].length };
  }

  /**
   * Get dataset statistics
   */
  getDatasetStats() {
    return {
      good: this.datasets.good.length,
      slouch: this.datasets.slouch.length,
      total: this.datasets.good.length + this.datasets.slouch.length,
      canTrain: this.datasets.good.length >= DEFAULT_CONFIG.MIN_SAMPLES_PER_CLASS && 
                this.datasets.slouch.length >= DEFAULT_CONFIG.MIN_SAMPLES_PER_CLASS
    };
  }

  /**
   * Train model with collected data
   */
  async train({ epochs = DEFAULT_CONFIG.EPOCHS, batchSize = DEFAULT_CONFIG.BATCH_SIZE, validationSplit = DEFAULT_CONFIG.VALIDATION_SPLIT, onProgress } = {}) {
    const stats = this.getDatasetStats();
    
    if (!stats.canTrain) {
      throw new Error(`Insufficient training data. Need at least ${DEFAULT_CONFIG.MIN_SAMPLES_PER_CLASS} samples per class. Current: ${stats.good} good, ${stats.slouch} slouch`);
    }

    this.onStatus('Starting training...');

    try {
      // Compute normalization statistics
      const allFeatures = [...this.datasets.good, ...this.datasets.slouch];
      this.normalizationStats = computeNormalizationStats(allFeatures);

      // Prepare training data
      const trainingData = prepareTrainingData(this.datasets, this.normalizationStats);

      // Build model
      const model = buildModel(DEFAULT_CONFIG.FEATURE_COUNT);

      // Train model
      const progressCallback = (progress) => {
        const message = `Epoch ${progress.epoch}/${progress.totalEpochs}: Loss=${progress.loss.toFixed(4)}, Acc=${progress.accuracy.toFixed(3)}`;
        this.onStatus(message);
        if (onProgress) onProgress(progress);
      };

      const result = await trainModel(model, trainingData, progressCallback);

      // Save model and metadata
      const modelMeta = {
        accuracy: result.metrics.finalAccuracy,
        loss: result.metrics.finalLoss,
        trainingSamples: result.metrics.trainingSamples,
        epochs: result.metrics.epochs,
        normalizationStats: this.normalizationStats,
        baselineAngle: this.baselineAngle,
        trainedAt: new Date().toISOString()
      };

      await saveModel(result.model, DEFAULT_CONFIG.MODEL_NAME, modelMeta);
      await saveModelMeta(modelMeta);

      this.model = result.model;

      const successMessage = `Training completed! Accuracy: ${(result.metrics.finalAccuracy * 100).toFixed(1)}%`;
      this.onStatus(successMessage);

      return {
        success: true,
        accuracy: result.metrics.finalAccuracy,
        loss: result.metrics.finalLoss,
        epochs: result.metrics.epochs,
        samples: result.metrics.trainingSamples
      };

    } catch (error) {
      const errorMessage = `Training failed: ${error.message}`;
      this.onStatus(errorMessage);
      console.error('Training error:', error);
      throw error;
    }
  }

  /**
   * Load trained model
   */
  async loadModel() {
    try {
      this.model = await loadModel(DEFAULT_CONFIG.MODEL_NAME);
      
      if (this.model) {
        // Load normalization stats
        const metadata = await loadModelMeta();
        if (metadata) {
          this.normalizationStats = metadata.normalizationStats;
          this.baselineAngle = metadata.baselineAngle;
        }
        
        this.onStatus('Model loaded successfully');
        return true;
      } else {
        this.onStatus('No trained model found');
        return false;
      }
    } catch (error) {
      this.onStatus(`Failed to load model: ${error.message}`);
      return false;
    }
  }

  /**
   * Get model status
   */
  async getModelStatus() {
    try {
      const info = await getModelInfo();
      const isLoaded = !!this.model;
      
      return {
        loaded: isLoaded,
        exists: info?.exists || false,
        accuracy: info?.accuracy,
        lastTrainedAt: info?.trainedAt,
        samples: info ? this.getDatasetStats() : null
      };
    } catch (error) {
      return {
        loaded: false,
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * Export dataset as JSON
   */
  exportDataset() {
    const exportData = {
      datasets: this.datasets,
      normalizationStats: this.normalizationStats,
      baselineAngle: this.baselineAngle,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import dataset from JSON
   */
  async importDataset(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (!data.datasets || !data.datasets.good || !data.datasets.slouch) {
        throw new Error('Invalid dataset format');
      }

      this.datasets = data.datasets;
      this.normalizationStats = data.normalizationStats || null;
      this.baselineAngle = data.baselineAngle || null;

      await this.saveDataset();

      const stats = this.getDatasetStats();
      this.onStatus(`Imported dataset: ${stats.good} good, ${stats.slouch} slouch samples`);
      
      return stats;
    } catch (error) {
      const errorMessage = `Failed to import dataset: ${error.message}`;
      this.onStatus(errorMessage);
      throw error;
    }
  }

  /**
   * Set baseline angle for normalization
   */
  setBaselineAngle(angle) {
    this.baselineAngle = angle;
    this.onStatus(`Baseline angle set to ${angle}°`);
    this.saveDataset(); // Save updated baseline
  }

  /**
   * Clear all training data
   */
  async clearDataset() {
    this.datasets = { good: [], slouch: [] };
    this.normalizationStats = null;
    await this.saveDataset();
    this.onStatus('Dataset cleared');
  }

  /**
   * Save dataset to storage
   */
  async saveDataset() {
    const datasetWithMeta = {
      ...this.datasets,
      baselineAngle: this.baselineAngle,
      normalizationStats: this.normalizationStats,
      lastUpdated: new Date().toISOString()
    };

    await saveDataset(datasetWithMeta);
  }
}

// Global trainer instance
let trainerInstance = null;

/**
 * Initialize trainer API
 */
export function initTrainer(options = {}) {
  if (!trainerInstance) {
    trainerInstance = new PostureTrainer();
  }
  
  return trainerInstance.init(options);
}

/**
 * Start recording samples
 */
export function startRecording(label, durationMs = 6000) {
  if (!trainerInstance) {
    throw new Error('Trainer not initialized. Call initTrainer() first.');
  }
  
  return trainerInstance.startRecording(label, durationMs);
}

/**
 * Stop current recording
 */
export function stopRecording() {
  if (!trainerInstance) return null;
  return trainerInstance.stopRecording();
}

/**
 * Get dataset statistics
 */
export function getDatasetStats() {
  if (!trainerInstance) return { good: 0, slouch: 0, total: 0, canTrain: false };
  return trainerInstance.getDatasetStats();
}

/**
 * Train model
 */
export function train(options = {}) {
  if (!trainerInstance) {
    throw new Error('Trainer not initialized. Call initTrainer() first.');
  }
  
  return trainerInstance.train(options);
}

/**
 * Load model
 */
export function loadModel() {
  if (!trainerInstance) {
    throw new Error('Trainer not initialized. Call initTrainer() first.');
  }
  
  return trainerInstance.loadModel();
}

/**
 * Get model status
 */
export function getModelStatus() {
  if (!trainerInstance) return { loaded: false, exists: false };
  return trainerInstance.getModelStatus();
}

/**
 * Export dataset
 */
export function exportDataset() {
  if (!trainerInstance) return '{}';
  return trainerInstance.exportDataset();
}

/**
 * Import dataset
 */
export function importDataset(jsonString) {
  if (!trainerInstance) {
    throw new Error('Trainer not initialized. Call initTrainer() first.');
  }
  
  return trainerInstance.importDataset(jsonString);
}

/**
 * Set baseline angle
 */
export function setBaselineAngle(angle) {
  if (!trainerInstance) {
    throw new Error('Trainer not initialized. Call initTrainer() first.');
  }
  
  trainerInstance.setBaselineAngle(angle);
}

/**
 * Clear dataset
 */
export function clearDataset() {
  if (!trainerInstance) return;
  return trainerInstance.clearDataset();
}

// Example usage (for testing in console):
/*
// Initialize trainer (auto-detect keypoints)
import('./ml/trainerAPI.ml.js').then(trainer => {
  // Method 1: Auto-detect
  trainer.initTrainer();
  
  // Method 2: Provide keypoint function
  // trainer.initTrainer({
  //   getKeypoints: () => window.__LATEST_KEYPOINTS__,
  //   onStatus: (msg) => console.log('Status:', msg)
  // });
  
  // Record samples
  // trainer.startRecording('good', 5000).then(result => {
  //   console.log('Recording result:', result);
  // });
  
  // Check dataset
  // console.log('Dataset stats:', trainer.getDatasetStats());
  
  // Train model (after collecting enough samples)
  // trainer.train({ epochs: 10 }).then(result => {
  //   console.log('Training result:', result);
  // });
  
  // Export dataset
  // const datasetJson = trainer.exportDataset();
  // console.log('Dataset JSON:', datasetJson);
});
*/
