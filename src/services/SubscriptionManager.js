import log from '@/log'

/**
 * Utility class for managing subscriptions consistently
 * throughout the application
 */
export default class SubscriptionManager {
  constructor() {
    this.subscriptions = new Map()
  }

  /**
   * Add a subscription with a given key
   * @param {string} key - Unique identifier for the subscription
   * @param {Subscription} subscription - The RxJS subscription object
   */
  add(key, subscription) {
    if (!subscription || typeof subscription.unsubscribe !== 'function') {
      log.debug(`Cannot add invalid subscription for key: ${key}`)
      return
    }
    
    // If there's already a subscription with this key, unsubscribe first
    this.remove(key)
    
    // Store the new subscription
    this.subscriptions.set(key, subscription)
    log.debug(`Added subscription: ${key}`)
  }

  /**
   * Remove and unsubscribe a subscription by key
   * @param {string} key - Identifier for the subscription to remove
   */
  remove(key) {
    if (this.subscriptions.has(key)) {
      const subscription = this.subscriptions.get(key)
      
      try {
        subscription.unsubscribe()
        log.debug(`Unsubscribed: ${key}`)
      } catch (e) {
        log.debug(`Error unsubscribing ${key}:`, e)
      }
      
      this.subscriptions.delete(key)
    }
  }

  /**
   * Check if a subscription exists
   * @param {string} key - Subscription identifier
   * @returns {boolean} - Whether the subscription exists
   */
  has(key) {
    return this.subscriptions.has(key)
  }

  /**
   * Get a subscription by key
   * @param {string} key - Subscription identifier
   * @returns {Subscription|undefined} - The subscription or undefined
   */
  get(key) {
    return this.subscriptions.get(key)
  }

  /**
   * Remove all subscriptions
   */
  removeAll() {
    for (const key of this.subscriptions.keys()) {
      this.remove(key)
    }
  }
  
  /**
   * Subscribe to an observable and manage the subscription
   * @param {string} key - Unique identifier for the subscription
   * @param {Observable} observable - The observable to subscribe to
   * @param {function} next - Handler for emitted values
   * @param {function} [error] - Error handler
   * @param {function} [complete] - Complete handler
   * @returns {Subscription} - The subscription object
   */
  subscribe(key, observable, next, error, complete) {
    if (!observable || typeof observable.subscribe !== 'function') {
      log.debug(`Cannot subscribe to invalid observable for key: ${key}`)
      return null
    }
    
    // Create a new subscription
    const subscription = observable.subscribe(
      // Next handler
      (value) => {
        try {
          if (typeof next === 'function') {
            next(value)
          }
        } catch (e) {
          log.debug(`Error in next handler for ${key}:`, e)
        }
      },
      // Error handler
      (err) => {
        log.debug(`Error in observable ${key}:`, err)
        if (typeof error === 'function') {
          error(err)
        }
      },
      // Complete handler
      () => {
        log.debug(`Observable ${key} completed`)
        if (typeof complete === 'function') {
          complete()
        }
      }
    )
    
    // Manage the subscription
    this.add(key, subscription)
    
    return subscription
  }
} 