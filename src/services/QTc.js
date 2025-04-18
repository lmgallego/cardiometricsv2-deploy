import Metric from './Metric'
import { sqrt, median, mean, quantileSeq } from 'mathjs'
import EcgService from './Ecg.js'

export default class QTc extends Metric {
  constructor(device, options = {}) {
    super(device, {
      ...options,
      unit: 'ms',
      precision: 0
    })
    
    this.pulsesNumber = options.rrIntervals || 100
    
    // Initialize services
    this.ecgService = null
    
    // Data storage
    this.rrIntervals = []
    this.qtIntervals = []
    
    // Additional subscription
    this.qtIntervalSubscription = null
    
    // Configuration
    this.formula = options.qtcFormula || 'fridericia' // 'bazett' or 'fridericia'
    this.useMedianRR = true
    this.outlierPercentile = 0.1 // Remove the top and bottom 10% of QT values
  }

  setupSubscription() {
    // Initialize ECG service
    this.ecgService = new EcgService(this.device)
    
    // Subscribe to QT interval observable
    this.qtIntervalSubscription = this.ecgService
      .getQtIntervalObservable()
      .subscribe(data => {
        this.handleQtInterval(data.qtInterval)
      })
    
    // Subscribe to RR interval observable
    if (this.device && this.device.observeRRInterval) {
      this.subscription = this.device
        .observeRRInterval()
        .subscribe((rri) => this.handleRrInterval(rri))
    } else {
      console.error('Device does not support observeRRInterval().')
    }
  }

  handleRrInterval(rri) {
    if (this.validateRrInterval(rri)) {
      this.rrIntervals.push(rri)
      
      // Keep only the most recent RR intervals based on pulsesNumber
      if (this.rrIntervals.length > this.pulsesNumber) {
        this.rrIntervals.shift()
      }
      
      // If we have QT intervals, calculate QTc
      if (this.qtIntervals && this.qtIntervals.length > 0) {
        const value = this.calculate()
        this.valueSubject.next(value)
      }
    }
  }
  
  handleQtInterval(qtInterval) {
    // Only record QT intervals in a physiological range
    if (qtInterval >= 200 && qtInterval <= 600) {
      if (!this.qtIntervals) {
        this.qtIntervals = []
      }
      
      this.qtIntervals.push(qtInterval)
      if (this.qtIntervals.length > this.pulsesNumber) {
        this.qtIntervals.shift()
      }
      
      // If we have RR intervals, calculate QTc
      if (this.rrIntervals && this.rrIntervals.length > 0) {
        const value = this.calculate()
        this.valueSubject.next(value)
      }
    }
  }

  validateRrInterval(rri) {
    return rri >= 300 && rri <= 2000
  }

  /**
   * Remove outliers from a dataset using interquartile range method
   */
  removeOutliers(data) {
    if (data.length < 4) return data;
    
    // Sort the data to apply percentile filtering
    const sortedData = [...data].sort((a, b) => a - b);
    
    // Remove extreme values (top and bottom percentiles)
    const lowIndex = Math.floor(data.length * this.outlierPercentile);
    const highIndex = Math.ceil(data.length * (1 - this.outlierPercentile));
    
    // Return the filtered data
    return sortedData.slice(lowIndex, highIndex);
  }

  /**
   * Calculate average RR interval with outlier rejection
   */
  getRepresentativeRR() {
    if (this.rrIntervals.length === 0) return 0;
    
    // Filter outliers
    const filteredRR = this.removeOutliers(this.rrIntervals);
    
    // Use median or mean based on configuration
    return this.useMedianRR ? 
      median(filteredRR) : 
      mean(filteredRR);
  }

  /**
   * Calculate average QT interval with outlier rejection
   */
  getRepresentativeQT() {
    if (this.qtIntervals.length === 0) return 0;
    
    // Filter outliers
    const filteredQT = this.removeOutliers(this.qtIntervals);
    
    // Use median for more stability
    return median(filteredQT);
  }

  calculate() {
    // Need both QT intervals and RR intervals to calculate QTc
    if (!this.qtIntervals || !this.rrIntervals || 
        this.qtIntervals.length === 0 || this.rrIntervals.length === 0) {
      return 0
    }
    
    // Get representative values
    const qtInterval = this.getRepresentativeQT();
    const rrInterval = this.getRepresentativeRR();
    
    if (qtInterval === 0 || rrInterval === 0) return 0;
    
    // Convert RR to seconds for formula
    const rrInSeconds = rrInterval / 1000;
    
    // Apply correction formula
    if (this.formula === 'bazett') {
      // Bazett's formula: QTc = QT / √(RR)
      return qtInterval / sqrt(rrInSeconds);
    } else {
      // Fridericia's formula: QTc = QT / ∛(RR)
      // This is less sensitive to heart rate changes
      return qtInterval / Math.cbrt(rrInSeconds);
    }
  }

  destroy() {
    // Clean up QT interval subscription
    if (this.qtIntervalSubscription) {
      this.qtIntervalSubscription.unsubscribe()
      this.qtIntervalSubscription = null
    }
    
    // Destroy ECG service
    if (this.ecgService) {
      this.ecgService.destroy()
      this.ecgService = null
    }
    
    // Call parent destroy to clean up other resources
    super.destroy()
  }
} 