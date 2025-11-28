/**
 * Model Service for Posture Detection
 * Handles TensorFlow.js model creation, training, and inference
 */

import { DEFAULT_CONFIG } from './constants.ml.js';
import { saveModelMeta, loadModelMeta } from './storage.ml.js';

// Ensure TensorFlow.js is available
let tf = null;
try {
  if (typeof window !== 'undefined' && window.tf) {
    tf = window.tf;
  } else if (typeof require !== 'undefined') {
    tf = require('@tensorflow/tfjs');
  }
} catch (error) {
  console.warn('TensorFlow.js not found. Please include @tensorflow/tfjs');
}

/**
 * Build a neural network model for posture classification
 * @param {number} inputDim - Number of input features
 * @returns {tf.Model} Untrained TensorFlow.js model
 */
export function buildModel(inputDim = DEFAULT_CONFIG.FEATURE_COUNT) {
  if (!tf) {
    throw new Error('TensorFlow.js is not available. Please include @tensorflow/tfjs');
  }

  const model = tf.sequential({
    layers: [
      // Input layer
      tf.layers.dense({
        inputShape: [inputDim],
        units: 32,
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
        name: 'dense_1'
      }),
      
      // Dropout for regularization
      tf.layers.dropout({
        rate: 0.3,
        name: 'dropout_1'
      }),
      
      // Hidden layer
      tf.layers.dense({
        units: 16,
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
        name: 'dense_2'
      }),
      
      // Dropout for regularization
      tf.layers.dropout({
        rate: 0.2,
        name: 'dropout_2'
      }),
      
      // Output layer (binary classification)
      tf.layers.dense({
        units: 2,
        activation: 'softmax',
        name: 'output'
      })
    ]
  });

  // Compile model
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log('Model built successfully');
  model.summary();
  
  return model;
}

/**
 * Train the model with provided datasets
 * @param {tf.Model} model - The model to train
 * @param {Object} datasets - Training data {features: Array, labels: Array}
 * @param {Function} onProgress - Progress callback
 * @returns {Object} {model, history, metrics}
 */
export async function trainModel(model, datasets, onProgress = null) {
  if (!tf || !model) {
    throw new Error('Invalid model or TensorFlow.js not available');
  }

  const { features, labels } = datasets;
  
  if (!features || !labels || features.length !== labels.length) {
    throw new Error('Invalid training data format');
  }

  if (features.length < DEFAULT_CONFIG.MIN_SAMPLES_PER_CLASS * 2) {
    throw new Error(`Insufficient training data. Need at least ${DEFAULT_CONFIG.MIN_SAMPLES_PER_CLASS * 2} samples total`);
  }

  try {
    // Convert to tensors
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels);

    console.log(`Training with ${features.length} samples`);
    console.log('Input shape:', xs.shape);
    console.log('Output shape:', ys.shape);

    // Training configuration
    const trainConfig = {
      epochs: DEFAULT_CONFIG.EPOCHS,
      batchSize: DEFAULT_CONFIG.BATCH_SIZE,
      validationSplit: DEFAULT_CONFIG.VALIDATION_SPLIT,
      shuffle: true,
      verbose: 0,
      callbacks: []
    };

    // Add progress callback if provided
    if (onProgress) {
      trainConfig.callbacks.push({
        onEpochEnd: (epoch, logs) => {
          const progress = {
            epoch: epoch + 1,
            totalEpochs: trainConfig.epochs,
            loss: logs.loss,
            accuracy: logs.acc || logs.accuracy,
            valLoss: logs.val_loss,
            valAccuracy: logs.val_acc || logs.val_accuracy
          };
          onProgress(progress);
        }
      });
    }

    // Train the model
    const history = await model.fit(xs, ys, trainConfig);

    // Calculate final metrics
    const evaluation = model.evaluate(xs, ys);
    const finalLoss = await evaluation[0].data();
    const finalAccuracy = await evaluation[1].data();

    const metrics = {
      finalLoss: finalLoss[0],
      finalAccuracy: finalAccuracy[0],
      trainingSamples: features.length,
      epochs: trainConfig.epochs
    };

    // Clean up tensors
    xs.dispose();
    ys.dispose();
    evaluation[0].dispose();
    evaluation[1].dispose();

    console.log('Training completed:', metrics);
    
    return {
      model,
      history: history.history,
      metrics
    };

  } catch (error) {
    console.error('Training failed:', error);
    throw error;
  }
}

/**
 * Save model to IndexedDB
 * @param {tf.Model} model - Trained model
 * @param {string} name - Model name
 * @param {Object} metadata - Additional metadata
 */
export async function saveModel(model, name = DEFAULT_CONFIG.MODEL_NAME, metadata = {}) {
  if (!tf || !model) {
    throw new Error('Invalid model or TensorFlow.js not available');
  }

  try {
    const modelUrl = `indexeddb://${name}`;
    
    // Save the model
    await model.save(modelUrl);
    
    // Save metadata
    const modelMeta = {
      name,
      url: modelUrl,
      inputShape: model.inputs[0].shape,
      outputShape: model.outputs[0].shape,
      trainedAt: new Date().toISOString(),
      ...metadata
    };
    
    await saveModelMeta(modelMeta);
    
    console.log(`Model saved as: ${name}`);
    return true;
    
  } catch (error) {
    console.error('Failed to save model:', error);
    throw error;
  }
}

/**
 * Load model from IndexedDB
 * @param {string} name - Model name
 * @returns {tf.Model|null} Loaded model or null
 */
export async function loadModel(name = DEFAULT_CONFIG.MODEL_NAME) {
  if (!tf) {
    console.warn('TensorFlow.js not available');
    return null;
  }

  try {
    const modelUrl = `indexeddb://${name}`;
    
    // Check if model exists
    const models = await tf.io.listModels();
    if (!models[modelUrl]) {
      console.log(`Model ${name} not found in storage`);
      return null;
    }
    
    // Load the model
    const model = await tf.loadLayersModel(modelUrl);
    console.log(`Model ${name} loaded successfully`);
    
    return model;
    
  } catch (error) {
    console.error('Failed to load model:', error);
    return null;
  }
}

/**
 * Run inference on a single feature vector
 * @param {tf.Model} model - Trained model
 * @param {Array} features - Feature vector
 * @returns {Object} {label, probs, confidence}
 */
export function predict(model, features) {
  if (!tf || !model) {
    throw new Error('Invalid model or TensorFlow.js not available');
  }

  if (!Array.isArray(features) || features.length !== DEFAULT_CONFIG.FEATURE_COUNT) {
    throw new Error(`Invalid feature vector. Expected ${DEFAULT_CONFIG.FEATURE_COUNT} features`);
  }

  try {
    // Convert to tensor
    const inputTensor = tf.tensor2d([features]);
    
    // Run prediction
    const prediction = model.predict(inputTensor);
    const probabilities = prediction.dataSync();
    
    // Get predicted class
    const goodProb = probabilities[0];
    const slouchProb = probabilities[1];
    
    const label = slouchProb > goodProb ? DEFAULT_CONFIG.LABELS.SLOUCH : DEFAULT_CONFIG.LABELS.GOOD;
    const confidence = Math.max(goodProb, slouchProb);
    
    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();
    
    return {
      label,
      probs: {
        [DEFAULT_CONFIG.LABELS.GOOD]: goodProb,
        [DEFAULT_CONFIG.LABELS.SLOUCH]: slouchProb
      },
      confidence
    };
    
  } catch (error) {
    console.error('Prediction failed:', error);
    throw error;
  }
}

/**
 * Get model information
 * @param {string} name - Model name
 * @returns {Object|null} Model info or null
 */
export async function getModelInfo(name = DEFAULT_CONFIG.MODEL_NAME) {
  try {
    const metadata = await loadModelMeta();
    
    if (tf) {
      const models = await tf.io.listModels();
      const modelUrl = `indexeddb://${name}`;
      
      if (models[modelUrl]) {
        return {
          ...metadata,
          exists: true,
          size: models[modelUrl].modelTopology ? 'Available' : 'Unknown',
          lastAccessed: models[modelUrl].dateSaved
        };
      }
    }
    
    return metadata ? { ...metadata, exists: false } : null;
    
  } catch (error) {
    console.error('Failed to get model info:', error);
    return null;
  }
}

/**
 * Delete model from storage
 * @param {string} name - Model name
 */
export async function deleteModel(name = DEFAULT_CONFIG.MODEL_NAME) {
  try {
    const modelUrl = `indexeddb://${name}`;
    
    if (tf) {
      await tf.io.removeModel(modelUrl);
    }
    
    // Also remove metadata
    await deleteModelMeta();
    
    console.log(`Model ${name} deleted`);
    return true;
    
  } catch (error) {
    console.error('Failed to delete model:', error);
    return false;
  }
}

/**
 * Prepare training data from raw datasets
 * @param {Object} rawDatasets - {good: Array, slouch: Array}
 * @param {Object} normalizationStats - Normalization parameters
 * @returns {Object} {features, labels}
 */
export function prepareTrainingData(rawDatasets, normalizationStats = null) {
  const features = [];
  const labels = [];
  
  // Process good posture samples
  if (rawDatasets.good) {
    rawDatasets.good.forEach(sample => {
      if (Array.isArray(sample) && sample.length === DEFAULT_CONFIG.FEATURE_COUNT) {
        let processedFeatures = sample.slice();
        
        // Apply normalization if provided
        if (normalizationStats) {
          processedFeatures = processedFeatures.map((f, i) => {
            const mean = normalizationStats.means[i] || 0;
            const std = normalizationStats.stds[i] || 1;
            return std > 0 ? (f - mean) / std : f - mean;
          });
        }
        
        features.push(processedFeatures);
        labels.push([1, 0]); // One-hot: [good, slouch]
      }
    });
  }
  
  // Process slouch samples
  if (rawDatasets.slouch) {
    rawDatasets.slouch.forEach(sample => {
      if (Array.isArray(sample) && sample.length === DEFAULT_CONFIG.FEATURE_COUNT) {
        let processedFeatures = sample.slice();
        
        // Apply normalization if provided
        if (normalizationStats) {
          processedFeatures = processedFeatures.map((f, i) => {
            const mean = normalizationStats.means[i] || 0;
            const std = normalizationStats.stds[i] || 1;
            return std > 0 ? (f - mean) / std : f - mean;
          });
        }
        
        features.push(processedFeatures);
        labels.push([0, 1]); // One-hot: [good, slouch]
      }
    });
  }
  
  console.log(`Prepared ${features.length} training samples (${rawDatasets.good?.length || 0} good, ${rawDatasets.slouch?.length || 0} slouch)`);
  
  return { features, labels };
}

// Example usage (for testing in console):
/*
// Test model operations (requires TensorFlow.js to be loaded)
(async () => {
  if (typeof tf !== 'undefined') {
    // Build model
    const model = buildModel(5);
    
    // Create mock training data
    const mockData = {
      features: [
        [0, 0, 0, 0, 0.9], // good
        [1, 1, 1, 1, 0.9], // good
        [20, 15, 2, 10, 0.9], // slouch
        [25, 20, 3, 15, 0.9]  // slouch
      ],
      labels: [
        [1, 0], [1, 0], // good labels
        [0, 1], [0, 1]  // slouch labels
      ]
    };
    
    // Train model
    const result = await trainModel(model, mockData, (progress) => {
      console.log(`Epoch ${progress.epoch}/${progress.totalEpochs}, Accuracy: ${progress.accuracy.toFixed(3)}`);
    });
    
    // Test prediction
    const prediction = predict(result.model, [10, 5, 1, 5, 0.9]);
    console.log('Prediction:', prediction);
    
    // Save model
    await saveModel(result.model, 'test-model');
    
    // Load model
    const loadedModel = await loadModel('test-model');
    console.log('Model loaded:', !!loadedModel);
  } else {
    console.log('TensorFlow.js not available for testing');
  }
})();
*/
