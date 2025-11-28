/**
 * Simple test file for ML modules
 * Run in browser console to verify functionality
 */

// Test data
const mockKeypoints = {
  left_shoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
  right_shoulder: { x: 0.6, y: 0.3, confidence: 0.9 },
  left_hip: { x: 0.45, y: 0.6, confidence: 0.9 },
  right_hip: { x: 0.55, y: 0.6, confidence: 0.9 },
  nose: { x: 0.5, y: 0.2, confidence: 0.9 }
};

const slouchKeypoints = {
  left_shoulder: { x: 0.3, y: 0.3, confidence: 0.9 },
  right_shoulder: { x: 0.5, y: 0.3, confidence: 0.9 },
  left_hip: { x: 0.4, y: 0.6, confidence: 0.9 },
  right_hip: { x: 0.6, y: 0.6, confidence: 0.9 },
  nose: { x: 0.4, y: 0.2, confidence: 0.9 }
};

/**
 * Test feature extraction
 */
export async function testFeatureExtraction() {
  console.log('=== Testing Feature Extraction ===');
  
  try {
    const { computeFeaturesFromKeypoints } = await import('./poseUtils.ml.js');
    
    const goodResult = computeFeaturesFromKeypoints(mockKeypoints);
    console.log('Good posture features:', goodResult);
    
    const slouchResult = computeFeaturesFromKeypoints(slouchKeypoints);
    console.log('Slouch posture features:', slouchResult);
    
    return { goodResult, slouchResult };
  } catch (error) {
    console.error('Feature extraction test failed:', error);
    return null;
  }
}

/**
 * Test storage operations
 */
export async function testStorage() {
  console.log('=== Testing Storage ===');
  
  try {
    const storage = await import('./storage.ml.js');
    
    // Test dataset save/load
    const testDataset = {
      good: [[1, 2, 3, 4, 5], [1.1, 2.1, 3.1, 4.1, 5.1]],
      slouch: [[2, 3, 4, 5, 6], [2.1, 3.1, 4.1, 5.1, 6.1]]
    };
    
    await storage.saveDataset(testDataset, 'test_dataset');
    console.log('✓ Dataset saved');
    
    const loaded = await storage.loadDataset('test_dataset');
    console.log('✓ Dataset loaded:', loaded);
    
    // Test storage info
    const info = await storage.getStorageInfo();
    console.log('✓ Storage info:', info);
    
    return true;
  } catch (error) {
    console.error('Storage test failed:', error);
    return false;
  }
}

/**
 * Test model operations (requires TensorFlow.js)
 */
export async function testModel() {
  console.log('=== Testing Model Operations ===');
  
  if (typeof tf === 'undefined') {
    console.warn('TensorFlow.js not available, skipping model tests');
    return false;
  }
  
  try {
    const modelService = await import('./modelService.ml.js');
    
    // Build model
    const model = modelService.buildModel(5);
    console.log('✓ Model built');
    
    // Test prediction with random data
    const randomFeatures = [Math.random() * 10, Math.random() * 10, Math.random(), Math.random() * 5, 0.9];
    const prediction = modelService.predict(model, randomFeatures);
    console.log('✓ Prediction test:', prediction);
    
    // Clean up
    model.dispose();
    
    return true;
  } catch (error) {
    console.error('Model test failed:', error);
    return false;
  }
}

/**
 * Test trainer API
 */
export async function testTrainer() {
  console.log('=== Testing Trainer API ===');
  
  try {
    const trainer = await import('./trainerAPI.ml.js');
    
    // Set up mock keypoints
    window.__LATEST_KEYPOINTS__ = mockKeypoints;
    
    // Initialize trainer
    const initialized = trainer.initTrainer();
    console.log('✓ Trainer initialized:', initialized);
    
    // Check dataset stats
    const stats = trainer.getDatasetStats();
    console.log('✓ Dataset stats:', stats);
    
    // Test model status
    const modelStatus = await trainer.getModelStatus();
    console.log('✓ Model status:', modelStatus);
    
    return true;
  } catch (error) {
    console.error('Trainer test failed:', error);
    return false;
  }
}

/**
 * Test detector API
 */
export async function testDetector() {
  console.log('=== Testing Detector API ===');
  
  try {
    const detector = await import('./detectorAPI.ml.js');
    
    // Set up mock keypoints
    window.__LATEST_KEYPOINTS__ = mockKeypoints;
    
    // Initialize detector
    const initialized = await detector.initDetector({
      onAlert: (alert) => console.log('🚨 Test Alert:', alert.message),
      onUpdate: (status) => console.log('📊 Status:', status)
    });
    console.log('✓ Detector initialized:', initialized);
    
    // Test single inference
    const result = await detector.forceInferOnce();
    console.log('✓ Inference result:', result);
    
    // Check status
    const status = detector.getStatus();
    console.log('✓ Detector status:', status);
    
    return true;
  } catch (error) {
    console.error('Detector test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🧪 Running ML Module Tests...\n');
  
  const results = {
    features: await testFeatureExtraction(),
    storage: await testStorage(),
    model: await testModel(),
    trainer: await testTrainer(),
    detector: await testDetector()
  };
  
  console.log('\n📊 Test Results Summary:');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
  
  return results;
}

// Auto-run tests if this file is imported directly
if (typeof window !== 'undefined' && window.location.pathname.includes('test')) {
  runAllTests();
}

// Console usage examples
console.log(`
🧪 ML Module Test Commands:

// Run all tests
import('./src/ml/test.ml.js').then(test => test.runAllTests());

// Run individual tests
import('./src/ml/test.ml.js').then(test => test.testFeatureExtraction());
import('./src/ml/test.ml.js').then(test => test.testStorage());
import('./src/ml/test.ml.js').then(test => test.testModel());
import('./src/ml/test.ml.js').then(test => test.testTrainer());
import('./src/ml/test.ml.js').then(test => test.testDetector());

// Quick integration test
window.__LATEST_KEYPOINTS__ = {
  left_shoulder: { x: 0.4, y: 0.3, confidence: 0.9 },
  right_shoulder: { x: 0.6, y: 0.3, confidence: 0.9 },
  left_hip: { x: 0.45, y: 0.6, confidence: 0.9 },
  right_hip: { x: 0.55, y: 0.6, confidence: 0.9 }
};

import('./src/ml/detectorAPI.ml.js').then(d => d.initDetector().then(() => d.forceInferOnce()));
`);
